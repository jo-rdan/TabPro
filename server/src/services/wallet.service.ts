import { db } from "../lib/db";
import { creators, guestCredits, momoPayments, venues } from "../models/schema";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { toRwandaMsisdn } from "../lib/pawapay";
import { CAMPAIGN_CUT_PERCENT } from "./campaign.service";

// Skuzi money. A new person a creator brought gets 25% of Skuzi's fee on their
// first bill back, to spend on a later Skuzi bill at any Skuzi venue. Skuzi
// pays it from its own fee: the venue's share of a bill never changes, and a
// bill can never use more Skuzi money than Skuzi's fee on it.
export const GUEST_WELCOME_SHARE = 0.25;

export const TABPRO_CUT = parseFloat(process.env.TABPRO_CUT_PERCENT || "8") / 100;
/** Skuzi's fee on a bill: 15% for a guest a campaign brought, else 8%. */
export const skuziCut = (campaignId: string | null | undefined) => (campaignId ? CAMPAIGN_CUT_PERCENT / 100 : TABPRO_CUT);

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
