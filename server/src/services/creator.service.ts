import crypto from "crypto";
import { db } from "../lib/db";
import { creators, creatorPayouts, creatorReferrals, guestCredits, momoPayments, venues } from "../models/schema";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { HttpError } from "../middleware/error.middleware";
import { normalizeGuestPhone, isRwandaMobile } from "./customer.service";
import { notifyAdmin } from "./push.service";
import { sendEmail, isEmailConfigured } from "../lib/email";
import { GUEST_WELCOME_SHARE, skuziNetRwf } from "./wallet.service";

// Skuzi Creators: anyone with an audience gets a code. When a NEW person pays
// with Skuzi using it (their first Skuzi payment ever), what Skuzi keeps on
// that bill (its fee minus pawaPay's costs) is shared: 25% to the creator, 25%
// back to the guest as Skuzi money, 50% stays with Skuzi. The venue's share
// never changes. Creators are paid monthly from money already in hand.
export const CREATOR_SHARE = 0.25;
export const CREATOR_MIN_PAYOUT_RWF = 5_000;

/** The creator's part of what Skuzi keeps on a new person's first bill. */
export const earningFor = (billRwf: number, skuziFeeRwf: number) => Math.floor(skuziNetRwf(billRwf, skuziFeeRwf) * CREATOR_SHARE);
/** The guest's welcome money on that same bill. */
export const welcomeFor = (billRwf: number, skuziFeeRwf: number) => Math.floor(skuziNetRwf(billRwf, skuziFeeRwf) * GUEST_WELCOME_SHARE);

const CODE = /^[A-Z0-9]{3,16}$/;
export const cleanCode = (raw: string) => raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const msisdnToLocal = (msisdn: string) => normalizeGuestPhone(msisdn);

/** A creator's sign-up from the "Become a Skuzi creator" page. */
export async function applyAsCreator(input: { name: string; handle?: string | null; phone: string; wantedCode?: string | null }, { silent = false } = {}) {
  if (!isRwandaMobile(input.phone)) throw new HttpError(400, "Please enter your MoMo number, e.g. 0788 123 456");
  const phone = normalizeGuestPhone(input.phone);
  const existing = await db.query.creators.findFirst({ where: eq(creators.phone, phone) });
  if (existing && existing.status !== "declined") {
    throw new HttpError(409, existing.status === "applied" ? "You've already applied. We'll be in touch on WhatsApp soon." : "This number already has a Skuzi creator account.");
  }
  const wanted = input.wantedCode ? cleanCode(input.wantedCode) : null;
  const [c] = await db
    .insert(creators)
    .values({
      name: input.name.trim(),
      handle: input.handle?.trim().replace(/^@?/, "@") || null,
      phone,
      wantedCode: wanted && CODE.test(wanted) ? wanted : null,
      accessToken: crypto.randomBytes(18).toString("base64url"),
    })
    .returning();
  if (silent) return { ok: true };
  const line = `${c.name}${c.handle ? ` (${c.handle})` : ""} · ${c.phone}${c.wantedCode ? ` · wants ${c.wantedCode}` : ""}`;
  await notifyAdmin(`🎬 New creator: ${c.name}`, `${line}. Approve them in Skuzi → Creators.`).catch(() => {});
  if (isEmailConfigured()) {
    await sendEmail({
      subject: `🎬 New Skuzi creator: ${c.name}`,
      text: `New creator sign-up\n\nName: ${c.name}\nAccount: ${c.handle ?? "-"}\nMoMo: ${c.phone}\nWanted code: ${c.wantedCode ?? "-"}\n\nApprove them in Skuzi → Creators.`,
    }).catch(() => false);
  }
  return { ok: true };
}

/** For the payment screen: is this code a live creator's? */
export async function lookupCode(raw: string) {
  const code = cleanCode(raw);
  if (!CODE.test(code)) return null;
  const c = await db.query.creators.findFirst({ where: and(eq(creators.code, code), eq(creators.status, "active")) });
  return c ? { code: c.code!, name: c.name.split(" ")[0] } : null;
}
export async function activeCreatorId(raw?: string | null) {
  if (!raw) return null;
  const code = cleanCode(raw);
  if (!CODE.test(code)) return null;
  const c = await db.query.creators.findFirst({ where: and(eq(creators.code, code), eq(creators.status, "active")) });
  return c?.id ?? null;
}

/**
 * A payment just succeeded. If the guest typed a creator's code and they're a
 * new person to Skuzi (this number never paid with Skuzi before), the creator
 * earns and the guest gets Skuzi money back. Demo venues and the creator's own
 * number never count. Safe to repeat.
 */
export async function creditCreator(payment: typeof momoPayments.$inferSelect) {
  if (!payment.creatorId || payment.status !== "successful" || payment.type !== "tab") return null;
  const creator = await db.query.creators.findFirst({ where: eq(creators.id, payment.creatorId) });
  if (!creator || creator.status !== "active") return null;
  const payer = msisdnToLocal(payment.phone);
  if (payer === creator.phone) return null;
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, payment.venueId) });
  if (!venue || venue.isDemo) return null;
  // New to Skuzi: no earlier successful payment from this number.
  const earlier = await db.query.momoPayments.findFirst({
    where: and(
      eq(momoPayments.phone, payment.phone),
      eq(momoPayments.status, "successful"),
      eq(momoPayments.type, "tab"),
      ne(momoPayments.id, payment.id),
      sql`${momoPayments.createdAt} < ${payment.createdAt}`,
    ),
  });
  if (earlier) return null;
  const [row] = await db
    .insert(creatorReferrals)
    .values({
      creatorId: creator.id,
      payerPhone: payer,
      momoPaymentId: payment.id,
      venueId: venue.id,
      billRwf: payment.amountRwf,
      earningRwf: earningFor(payment.amountRwf, payment.tabproCommissionRwf ?? 0),
    })
    .onConflictDoNothing()
    .returning();
  // A retry after a crash finds the referral already there: still make sure the guest got their money.
  const referral = row ?? (await db.query.creatorReferrals.findFirst({ where: eq(creatorReferrals.momoPaymentId, payment.id) }));
  const welcome = welcomeFor(payment.amountRwf, payment.tabproCommissionRwf ?? 0);
  if (referral && welcome > 0) {
    await db
      .insert(guestCredits)
      .values({ phone: payment.phone, amountRwf: welcome, creatorId: creator.id, momoPaymentId: payment.id })
      .onConflictDoNothing();
  }
  return row ?? null;
}

async function totals(creatorId: string) {
  const [r] = await db
    .select({
      people: sql<number>`count(*)::int`,
      earned: sql<number>`coalesce(sum(${creatorReferrals.earningRwf}), 0)::int`,
      unpaid: sql<number>`coalesce(sum(${creatorReferrals.earningRwf}) filter (where ${creatorReferrals.payoutId} is null), 0)::int`,
      unpaidPeople: sql<number>`(count(*) filter (where ${creatorReferrals.payoutId} is null))::int`,
      thisMonth: sql<number>`(count(*) filter (where ${creatorReferrals.createdAt} >= date_trunc('month', now() + interval '2 hours') - interval '2 hours'))::int`,
    })
    .from(creatorReferrals)
    .where(eq(creatorReferrals.creatorId, creatorId));
  return { people: r?.people ?? 0, earnedRwf: r?.earned ?? 0, unpaidRwf: r?.unpaid ?? 0, unpaidPeople: r?.unpaidPeople ?? 0, peopleThisMonth: r?.thisMonth ?? 0 };
}

/** A creator's own page (private link). Never shows who the people are. */
export async function creatorHome(token: string) {
  const c = await db.query.creators.findFirst({ where: eq(creators.accessToken, token) });
  if (!c) throw new HttpError(404, "We couldn't find this page");
  const [t, recent, payouts] = await Promise.all([
    totals(c.id),
    db
      .select({ createdAt: creatorReferrals.createdAt, earningRwf: creatorReferrals.earningRwf, venue: venues.name })
      .from(creatorReferrals)
      .leftJoin(venues, eq(creatorReferrals.venueId, venues.id))
      .where(eq(creatorReferrals.creatorId, c.id))
      .orderBy(desc(creatorReferrals.createdAt))
      .limit(20),
    db.query.creatorPayouts.findMany({ where: eq(creatorPayouts.creatorId, c.id), orderBy: [desc(creatorPayouts.paidAt)], limit: 12 }),
  ]);
  return {
    name: c.name, handle: c.handle, status: c.status, code: c.code,
    ...t, paidRwf: t.earnedRwf - t.unpaidRwf, minPayoutRwf: CREATOR_MIN_PAYOUT_RWF,
    recent, payouts: payouts.map((p) => ({ amountRwf: p.amountRwf, people: p.people, paidAt: p.paidAt })),
  };
}

// ─── The founder's side ────────────────────────────────────────────────────────
export async function listCreators() {
  const list = await db.query.creators.findMany({ orderBy: [desc(creators.createdAt)] });
  return Promise.all(list.map(async (c) => ({
    id: c.id, name: c.name, handle: c.handle, phone: c.phone, wantedCode: c.wantedCode, code: c.code,
    status: c.status, accessToken: c.accessToken, createdAt: c.createdAt, approvedAt: c.approvedAt,
    ...(await totals(c.id)),
  })));
}

export async function addCreator(input: { name: string; handle?: string | null; phone: string; code: string }) {
  await applyAsCreator({ ...input, wantedCode: input.code }, { silent: true }).catch((e) => { if (e.status !== 409) throw e; });
  const c = await db.query.creators.findFirst({ where: eq(creators.phone, normalizeGuestPhone(input.phone)) });
  if (!c) throw new HttpError(400, "Couldn't add this creator");
  return approveCreator(c.id, input.code);
}

export async function approveCreator(id: string, rawCode: string) {
  const code = cleanCode(rawCode);
  if (!CODE.test(code)) throw new HttpError(400, "A code is 3 to 16 letters or numbers, e.g. ALINE");
  const taken = await db.query.creators.findFirst({ where: and(eq(creators.code, code), ne(creators.id, id)) });
  if (taken) throw new HttpError(409, `${code} is already ${taken.name}'s code. Pick another.`);
  const [c] = await db
    .update(creators)
    .set({ code, status: "active", approvedAt: sql`coalesce(${creators.approvedAt}, now())` })
    .where(eq(creators.id, id))
    .returning();
  if (!c) throw new HttpError(404, "Creator not found");
  return c;
}

export async function setCreatorStatus(id: string, status: "paused" | "active" | "declined") {
  const c = await db.query.creators.findFirst({ where: eq(creators.id, id) });
  if (!c) throw new HttpError(404, "Creator not found");
  if (status === "active" && !c.code) throw new HttpError(400, "Approve them with a code first");
  const [u] = await db.update(creators).set({ status }).where(eq(creators.id, id)).returning();
  return u;
}

/** The founder sent the money by MoMo: everything unpaid so far becomes paid. */
export async function markPaid(id: string) {
  return db.transaction(async (tx) => {
    const unpaid = await tx
      .select({ id: creatorReferrals.id, earningRwf: creatorReferrals.earningRwf })
      .from(creatorReferrals)
      .where(and(eq(creatorReferrals.creatorId, id), isNull(creatorReferrals.payoutId)))
      .for("update");
    const amount = unpaid.reduce((n, r) => n + r.earningRwf, 0);
    if (amount <= 0) throw new HttpError(400, "Nothing to pay right now");
    const [p] = await tx.insert(creatorPayouts).values({ creatorId: id, amountRwf: amount, people: unpaid.length }).returning();
    await tx.update(creatorReferrals).set({ payoutId: p.id }).where(inArray(creatorReferrals.id, unpaid.map((r) => r.id)));
    return p;
  });
}
