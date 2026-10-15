import { db } from "../lib/db";
import { creators, guestCredits, momoPayments, venues } from "../models/schema";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { toRwandaMsisdn } from "../lib/pawapay";
import { CAMPAIGN_CUT_PERCENT } from "./campaign.service";

// Skuzi money. A new person a creator brought gets 25% of what Skuzi keeps on
// their first bill (its fee minus pawaPay's costs) back, to spend on a later
// Skuzi bill at any Skuzi venue. Skuzi pays it from what it keeps: the venue's
// share never changes, and a bill never uses more Skuzi money than Skuzi keeps
// on it, so Skuzi never loses money on a bill.
export const GUEST_WELCOME_SHARE = 0.25;

export const TABPRO_CUT = parseFloat(process.env.TABPRO_CUT_PERCENT || "8") / 100;
/** Skuzi's fee on a bill: 15% for a guest a campaign brought, else 8%. */
export const skuziCut = (campaignId: string | null | undefined) => (campaignId ? CAMPAIGN_CUT_PERCENT / 100 : TABPRO_CUT);

// What pawaPay and the mobile network take on one bill (Rwanda, pawapay.io/fees,
// Oct 2026), worst case = MTN on both legs: 3.1% to collect from the guest,
// 60 RWF + 1% to send the venue its share. Override with env if pawaPay's
// prices for our account differ.
const COLLECT_RATE = parseFloat(process.env.PAWAPAY_COLLECT_RATE || "0.031");
const PAYOUT_FIXED_RWF = parseFloat(process.env.PAWAPAY_PAYOUT_FIXED_RWF || "60");
const PAYOUT_RATE = parseFloat(process.env.PAWAPAY_PAYOUT_RATE || "0.01");
export const paymentCostsRwf = (billRwf: number, venuePayoutRwf: number) =>
  Math.ceil(billRwf * COLLECT_RATE + PAYOUT_FIXED_RWF + venuePayoutRwf * PAYOUT_RATE);

/** What Skuzi really keeps on a bill: its fee minus pawaPay's costs (never below 0). */
export const skuziNetRwf = (billRwf: number, skuziFeeRwf: number) =>
  Math.max(0, skuziFeeRwf - paymentCostsRwf(billRwf, billRwf - skuziFeeRwf));

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What this number has left to spend. Money held by a payment still waiting counts as spent. */
export async function walletBalance(phone: string, ex: Executor = db): Promise<number> {
  const msisdn = toRwandaMsisdn(phone);
  const [[earned], [spent]] = await Promise.all([
    ex.select({ n: sql<number>`coalesce(sum(${guestCredits.amountRwf}), 0)::int` }).from(guestCredits).where(eq(guestCredits.phone, msisdn)),
    ex
      .select({ n: sql<number>`coalesce(sum(${momoPayments.walletUsedRwf}), 0)::int` })
      .from(momoPayments)
      .where(and(eq(momoPayments.phone, msisdn), inArray(momoPayments.status, ["pending", "successful"]))),
  ]);
  return Math.max(0, (earned?.n ?? 0) - (spent?.n ?? 0));
}

/** Only one payment at a time may spend a number's Skuzi money (call inside a transaction). */
export async function lockWallet(tx: Executor, phone: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"wallet:" + toRwandaMsisdn(phone)}))`);
}

/** The welcome money a payment earned the guest (0 if none). */
export async function welcomeForPayment(momoPaymentId: string) {
  const row = await db.query.guestCredits.findFirst({ where: eq(guestCredits.momoPaymentId, momoPaymentId) });
  return row?.amountRwf ?? 0;
}

/** The guest's own page: what they have, where it came from, where they used it. */
export async function walletFor(phone: string) {
  const msisdn = toRwandaMsisdn(phone);
  const [balanceRwf, earned, used] = await Promise.all([
    walletBalance(msisdn),
    db
      .select({ amountRwf: guestCredits.amountRwf, at: guestCredits.createdAt, creator: creators.name, venue: venues.name })
      .from(guestCredits)
      .leftJoin(creators, eq(guestCredits.creatorId, creators.id))
      .leftJoin(momoPayments, eq(guestCredits.momoPaymentId, momoPayments.id))
      .leftJoin(venues, eq(momoPayments.venueId, venues.id))
      .where(eq(guestCredits.phone, msisdn))
      .orderBy(desc(guestCredits.createdAt))
      .limit(20),
    db
      .select({ amountRwf: momoPayments.walletUsedRwf, at: momoPayments.createdAt, venue: venues.name })
      .from(momoPayments)
      .leftJoin(venues, eq(momoPayments.venueId, venues.id))
      .where(and(eq(momoPayments.phone, msisdn), eq(momoPayments.status, "successful"), gt(momoPayments.walletUsedRwf, 0)))
      .orderBy(desc(momoPayments.createdAt))
      .limit(20),
  ]);
  const history = [
    ...earned.map((e) => ({ kind: "got" as const, amountRwf: e.amountRwf, at: e.at, from: e.creator?.split(" ")[0] ?? null, venue: e.venue })),
    ...used.map((u) => ({ kind: "used" as const, amountRwf: u.amountRwf, at: u.at, from: null, venue: u.venue })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  return { balanceRwf, history };
}
