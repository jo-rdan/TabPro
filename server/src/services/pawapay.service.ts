import { v4 as uuidv4 } from "uuid";
import { db } from "../lib/db";
import { momoPayments, venues, tabs } from "../models/schema";
import { eq, and, isNull, or, lt, desc } from "drizzle-orm";
import { getTabBill, closeTab } from "./tab.service";
import { notifyTable, notifyGuest, sendPushToOwner } from "./push.service";
import { broadcastToVenue } from "../lib/websocket";
import {
  isPawapayConfigured,
  predictProvider,
  initiateDeposit,
  initiatePayout,
  getDeposit,
  getPayout,
  failureMessage,
  toRwandaMsisdn,
  PaymentRefusedError,
  PawapayError,
} from "../lib/pawapay";

const TABPRO_CUT = parseFloat(process.env.TABPRO_CUT_PERCENT || "8") / 100;

// A customer who taps "pay" again while their phone prompt is still live gets
// the same request back instead of a second charge.
const PENDING_DEPOSIT_REUSE_MS = 3 * 60_000;

// A transfer pawaPay still doesn't know about after this long never reached it.
const NOT_FOUND_GIVE_UP_MS = 10 * 60_000;

// Demo venues never touch pawaPay: the payment "approves" itself after this.
const DEMO_APPROVAL_MS = 4000;

type Outcome = "pending" | "successful" | "failed";

// Shown on the customer's statement: 4–22 letters, digits or spaces.
function statementText(venueName: string): string {
  const clean = venueName.replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return clean.length >= 4 ? clean.slice(0, 22).trim() : "TabPro payment";
}

// momoStatus holds pawaPay's raw status, plus the failure code when failed
// (e.g. "FAILED:PAYMENT_NOT_APPROVED").
const failureCodeOf = (momoStatus: string | null) => momoStatus?.split(":")[1];

/** Can customers of this venue pay through the app right now? */
export function venueAcceptsMobileMoney(venue: { momoPhone: string | null; isDemo?: boolean }): boolean {
  return !!venue.isDemo || (isPawapayConfigured() && !!venue.momoPhone);
}

// ─── Collect from customer (tab payment) ──────────────────────────────────────

export async function requestTabPayment(
  tabId: string,
  customerPhone: string,
): Promise<{ depositId: string; grandTotal: number; commission: number; venuePayout: number }> {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: { table: { with: { venue: true } } },
  });
  if (!tab) throw new Error("Tab not found");
  if (tab.status === "closed") throw new Error("This tab has already been paid");
  const venue = tab.table.venue;
  if (!venueAcceptsMobileMoney(venue)) {
    throw new Error("This venue isn't set up for Mobile Money payments yet. Please pay your waiter.");
  }

  const bill = await getTabBill(tabId);
  const { grandTotal } = bill;
  if (grandTotal <= 0) throw new Error("There is nothing to pay on this tab");

  // Re-use a recent pending request for the same tab and amount.
  const recent = await db.query.momoPayments.findFirst({
    where: and(eq(momoPayments.tabId, tabId), eq(momoPayments.status, "pending")),
    orderBy: [desc(momoPayments.createdAt)],
  });
  if (recent && recent.amountRwf === grandTotal && Date.now() - recent.createdAt.getTime() < PENDING_DEPOSIT_REUSE_MS) {
    return {
      depositId: recent.referenceId,
      grandTotal,
      commission: recent.tabproCommissionRwf ?? 0,
      venuePayout: recent.venuePayoutRwf ?? 0,
    };
  }

  // Demo venue: record a simulated payment, never call pawaPay.
  if (venue.isDemo) {
    const depositId = uuidv4();
    await db.insert(momoPayments).values({
      venueId: venue.id,
      type: "demo",
      tabId,
      referenceId: depositId,
      phone: toRwandaMsisdn(customerPhone),
      amountRwf: grandTotal,
      tabproCommissionRwf: 0,
      venuePayoutRwf: 0,
      status: "pending",
    });
    return { depositId, grandTotal, commission: 0, venuePayout: 0 };
  }

  // Validates the number and works out MTN vs Airtel (throws PaymentRefusedError).
  const payer = await predictProvider(customerPhone);

  const commission = Math.round(grandTotal * TABPRO_CUT);
  const venuePayout = grandTotal - commission;
  const depositId = uuidv4();

  // pawaPay: store the id before initiating, so a webhook or a timeout can
  // always be reconciled.
  await db.insert(momoPayments).values({
    venueId: venue.id,
    type: "tab",
    tabId,
    referenceId: depositId,
    phone: payer.phoneNumber,
    amountRwf: grandTotal,
    tabproCommissionRwf: commission,
    venuePayoutRwf: venuePayout,
    status: "pending",
  });

  try {
    await initiateDeposit({
      id: depositId,
      phoneNumber: payer.phoneNumber,
      provider: payer.provider,
      amountRwf: grandTotal,
      customerMessage: statementText(venue.name),
      metadata: { tabId, venueId: venue.id },
    });
  } catch (err: any) {
    const code = err instanceof PaymentRefusedError || err instanceof PawapayError ? err.failureCode : undefined;
    await db.update(momoPayments)
      .set({ status: "failed", momoStatus: `REJECTED:${code ?? "UNKNOWN_ERROR"}`, resolvedAt: new Date() })
      .where(eq(momoPayments.referenceId, depositId));
    throw err;
  }

  return { depositId, grandTotal, commission, venuePayout };
}

// ─── Settle a deposit: record it, close the tab, pay the venue ───────────────
// Called from the customer's status polling, the pawaPay webhook and the
// background reconciler — possibly at the same moment — so every step is
// idempotent.

export async function checkTabPaymentAndMaybeDisburse(depositId: string): Promise<{
  status: Outcome;
  disbursementStatus: string | null;
  failureMessage?: string;
}> {
  const payment = await db.query.momoPayments.findFirst({
    where: eq(momoPayments.referenceId, depositId),
  });
  if (!payment) throw new Error("Payment record not found");

  if (payment.type === "demo") return settleDemoPayment(payment);

  let status: Outcome = payment.status;
  let momoStatus = payment.momoStatus;
  if (status === "pending") {
    const result = await getDeposit(depositId);
    if (result.status === "not_found") {
      if (Date.now() - payment.createdAt.getTime() < NOT_FOUND_GIVE_UP_MS) return { status: "pending", disbursementStatus: null };
      status = "failed";
      momoStatus = "NOT_FOUND";
    } else if (result.status === "pending") {
      return { status: "pending", disbursementStatus: null };
    } else {
      status = result.status;
      momoStatus = result.failureCode ? `${result.rawStatus}:${result.failureCode}` : result.rawStatus;
    }

    await db.update(momoPayments)
      .set({ status, momoStatus, resolvedAt: new Date() })
      .where(and(eq(momoPayments.referenceId, depositId), eq(momoPayments.status, "pending")));
  }

  if (status === "failed") {
    return { status, disbursementStatus: null, failureMessage: failureMessage(failureCodeOf(momoStatus)) };
  }

  // The customer has paid — settle the tab now, whatever happens with the payout.
  await markTabPaid(payment);

  await disburseToVenue(depositId);

  const updated = await db.query.momoPayments.findFirst({
    where: eq(momoPayments.referenceId, depositId),
  });
  return { status, disbursementStatus: updated?.disbursementStatus ?? null };
}

// Simulated payment for demo venues: approves itself, closes the tab, no payout.
async function settleDemoPayment(payment: typeof momoPayments.$inferSelect) {
  if (payment.status === "pending" && Date.now() - payment.createdAt.getTime() < DEMO_APPROVAL_MS) {
    return { status: "pending" as Outcome, disbursementStatus: null };
  }
  if (payment.status === "pending") {
    await db.update(momoPayments)
      .set({ status: "successful", momoStatus: "DEMO", resolvedAt: new Date() })
      .where(and(eq(momoPayments.referenceId, payment.referenceId), eq(momoPayments.status, "pending")));
  }
  await markTabPaid(payment);
  return { status: "successful" as Outcome, disbursementStatus: null };
}

async function markTabPaid(payment: typeof momoPayments.$inferSelect) {
  if (!payment.tabId) return;
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, payment.tabId) });
  if (!tab || tab.status === "closed") return;

  try {
    await closeTab(payment.tabId, { paidByMomo: true });
  } catch (err: any) {
    // Lost a race with another settler — the tab is closed either way.
    if (!/already closed/i.test(err.message)) throw err;
    return;
  }

  const bill = await getTabBill(payment.tabId).catch(() => null);
  broadcastToVenue(payment.venueId, {
    type: "tab_paid",
    payload: {
      tabId: payment.tabId,
      tableLabel: bill?.tableLabel ?? "",
      grandTotal: payment.amountRwf,
      commission: payment.tabproCommissionRwf,
      venuePayout: payment.venuePayoutRwf,
    },
    venueId: payment.venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });

  const label = bill?.tableLabel ?? "A table";
  const amount = (n: number | null) => `${(n ?? 0).toLocaleString("en-US")} RWF`;
  await notifyTable(
    payment.venueId,
    tab.tableId,
    tab.staffId,
    { title: `✅ ${label} paid ${amount(payment.amountRwf)}`, body: "Paid by Mobile Money. You can clear the table." },
    {
      title: `💰 ${label} paid ${amount(payment.amountRwf)}`,
      body: payment.type === "demo" ? "Demo payment, no real money." : `${amount(payment.venuePayoutRwf)} is on its way to your Mobile Money.`,
    },
  );
  await notifyGuest(payment.tabId, { title: "✅ Payment received", body: `Thank you! ${amount(payment.amountRwf)} paid. Tap to see your receipt.` }, `/receipt/${payment.tabId}`);
}

// Sends the venue its share exactly once. The payout id is claimed in the DB
// before calling pawaPay, so two concurrent settlers can't both pay out; if
// pawaPay refuses, the claim is released so the reconciler can retry.
async function disburseToVenue(depositId: string) {
  const payment = await db.query.momoPayments.findFirst({
    where: eq(momoPayments.referenceId, depositId),
  });
  if (!payment?.venuePayoutRwf || payment.status !== "successful") return;
  if (payment.disbursementReferenceId) return; // already sent (or in flight)

  const venue = await db.query.venues.findFirst({ where: eq(venues.id, payment.venueId) });
  if (!venue?.momoPhone) {
    await db.update(momoPayments).set({ disbursementStatus: "failed" }).where(eq(momoPayments.referenceId, depositId));
    return;
  }

  const payoutId = uuidv4();
  const [claimed] = await db.update(momoPayments)
    .set({ disbursementReferenceId: payoutId, disbursementStatus: "pending" })
    .where(and(eq(momoPayments.referenceId, depositId), isNull(momoPayments.disbursementReferenceId)))
    .returning();
  if (!claimed) return; // someone else is paying out

  try {
    const recipient = await predictProvider(venue.momoPhone);
    await initiatePayout({
      id: payoutId,
      phoneNumber: recipient.phoneNumber,
      provider: recipient.provider,
      amountRwf: payment.venuePayoutRwf,
      customerMessage: "TabPro payout",
      metadata: { depositId, venueId: venue.id },
    });
  } catch (err: any) {
    console.error("pawaPay payout failed:", err.message);
    // Tell the owner on the first failure only: the reconciler retries every minute.
    if (payment.disbursementStatus !== "failed") {
      await sendPushToOwner(
        payment.venueId,
        "⚠️ A payout to your Mobile Money is delayed",
        `${(payment.venuePayoutRwf ?? 0).toLocaleString("en-US")} RWF didn't go through yet. TabPro is retrying automatically.`,
      ).catch(() => {});
    }
    await db.update(momoPayments)
      .set({ disbursementReferenceId: null, disbursementStatus: "failed" })
      .where(eq(momoPayments.disbursementReferenceId, payoutId));
    broadcastToVenue(payment.venueId, {
      type: "disbursement_failed",
      payload: { tabId: payment.tabId, depositId },
      venueId: payment.venueId,
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── Check disbursement status ────────────────────────────────────────────────

export async function checkDisbursementStatus(payoutId: string): Promise<{
  disbursementStatus: Outcome;
}> {
  const result = await getPayout(payoutId);
  let disbursementStatus: Outcome = result.status === "not_found" ? "pending" : result.status;

  if (result.status === "not_found") {
    const payment = await db.query.momoPayments.findFirst({ where: eq(momoPayments.disbursementReferenceId, payoutId) });
    // Claimed but never reached pawaPay (e.g. crash between claim and call).
    if (payment && Date.now() - payment.createdAt.getTime() > NOT_FOUND_GIVE_UP_MS) disbursementStatus = "failed";
  }

  if (disbursementStatus === "successful") {
    await db.update(momoPayments)
      .set({ disbursementStatus, disbursedAt: new Date() })
      .where(eq(momoPayments.disbursementReferenceId, payoutId));
  } else if (disbursementStatus === "failed") {
    // Release the payout id so the reconciler sends a fresh payout.
    await db.update(momoPayments)
      .set({ disbursementStatus, disbursementReferenceId: null })
      .where(eq(momoPayments.disbursementReferenceId, payoutId));
  }

  return { disbursementStatus };
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────
// We never trust the callback body: it only tells us which id to re-check
// against the pawaPay API.

export async function handleDepositCallback(depositId: string) {
  const known = await db.query.momoPayments.findFirst({ where: eq(momoPayments.referenceId, depositId) });
  if (!known) return;
  await checkTabPaymentAndMaybeDisburse(depositId);
}

export async function handlePayoutCallback(payoutId: string) {
  const known = await db.query.momoPayments.findFirst({ where: eq(momoPayments.disbursementReferenceId, payoutId) });
  if (!known) return;
  const { disbursementStatus } = await checkDisbursementStatus(payoutId);
  if (disbursementStatus === "failed") await disburseToVenue(known.referenceId);
}

// ─── Reconciler ───────────────────────────────────────────────────────────────
// Safety net for missed webhooks and customers who closed the page: settles
// pending deposits, retries failed payouts, and follows up in-flight payouts.

export async function reconcileTabPayments() {
  if (!isPawapayConfigured()) return;
  const settledFor = new Date(Date.now() - 60_000);

  const open = await db.query.momoPayments.findMany({
    where: and(
      eq(momoPayments.type, "tab"),
      lt(momoPayments.createdAt, settledFor),
      or(
        eq(momoPayments.status, "pending"),
        and(eq(momoPayments.status, "successful"), isNull(momoPayments.disbursementReferenceId)),
        and(eq(momoPayments.status, "successful"), eq(momoPayments.disbursementStatus, "pending")),
      ),
    ),
    limit: 50,
  });

  for (const p of open) {
    try {
      if (p.status === "pending" || !p.disbursementReferenceId) {
        await checkTabPaymentAndMaybeDisburse(p.referenceId);
      } else {
        await handlePayoutCallback(p.disbursementReferenceId);
      }
    } catch (err: any) {
      console.error(`[reconcile] ${p.referenceId}:`, err.message);
    }
  }
}

export function startPaymentReconciler() {
  setInterval(() => reconcileTabPayments().catch((err) => console.error("[reconcile]", err)), 60_000);
}
