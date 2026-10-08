import { db } from "../lib/db";
import { campaigns, campaignRecipients, customers, pushSubscriptions, tabs, tables, venues, momoPayments, orders, orderItems } from "../models/schema";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { HttpError } from "../middleware/error.middleware";
import { notifyCustomer, sendPushToOwner } from "./push.service";

// "We already have the right people." A campaign is a notification to guests who
// said yes to invites, plus an event on Explore and the venue's page. Sending is
// free; when a guest comes because of it (within 7 days) and pays with Skuzi,
// Skuzi's fee on that bill is 15% instead of 8%.
export const CAMPAIGN_WINDOW_DAYS = 7;
export const CAMPAIGN_CUT_PERCENT = 15;
const REGULAR_DAYS = 90;
// Guests get at most 2 invites a week, from all venues together.
const GUEST_WEEKLY_CAP = 2;
// A venue can send 2 campaigns a week, so invites stay special.
const VENUE_WEEKLY_CAP = 2;

const DAY = 86_400_000;
export type OfferType = "none" | "free_item" | "discount_10";
export type Audience = "regulars" | "everyone";

export function offerText(c: { offerType: string; offerLabel: string | null }): string | null {
  if (c.offerType === "discount_10") return "10% off when you pay with Skuzi";
  if (c.offerType === "free_item" && c.offerLabel) return `${c.offerLabel} when you pay with Skuzi`;
  return null;
}

/** Guests who had a tab at this venue (since `since`, if given). */
async function visitorIds(venueId: string, since?: Date): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ id: tabs.customerId })
    .from(tabs)
    .innerJoin(tables, eq(tabs.tableId, tables.id))
    .where(since ? and(eq(tables.venueId, venueId), gte(tabs.openedAt, since)) : eq(tables.venueId, venueId));
  return new Set(rows.map((r) => r.id));
}

/** Guests who said yes to invites and have a device to receive them. */
async function reachableIds(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ id: customers.id })
    .from(customers)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.customerId, customers.id))
    .where(eq(customers.invitesOptIn, true));
  return new Set(rows.map((r) => r.id));
}

export async function getAudience(venueId: string) {
  const [reachable, regularsSet] = await Promise.all([
    reachableIds(),
    visitorIds(venueId, new Date(Date.now() - REGULAR_DAYS * DAY)),
  ]);
  let regulars = 0;
  for (const id of reachable) if (regularsSet.has(id)) regulars++;
  return { regulars, others: reachable.size - regulars, total: reachable.size };
}

type NewCampaign = {
  title: string;
  message: string;
  offerType: OfferType;
  offerLabel?: string | null;
  eventAt?: Date | null;
  audience: Audience;
  sendAt?: Date | null;
};

export async function createCampaign(venueId: string, input: NewCampaign) {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new HttpError(404, "Venue not found");
  const now = Date.now();
  if (input.offerType === "free_item" && !input.offerLabel?.trim()) throw new HttpError(400, "Say what the free item is, e.g. Free shot");
  if (input.eventAt && input.eventAt.getTime() < now - 60 * 60_000) throw new HttpError(400, "The event date is in the past");
  if (input.eventAt && input.eventAt.getTime() > now + 60 * DAY) throw new HttpError(400, "Events can be up to 2 months ahead");
  const sendAt = input.sendAt && input.sendAt.getTime() > now + 60_000 ? input.sendAt : null;
  if (sendAt && sendAt.getTime() > now + 30 * DAY) throw new HttpError(400, "Campaigns can be scheduled up to 30 days ahead");
  if (sendAt && input.eventAt && sendAt > input.eventAt) throw new HttpError(400, "Send it before the event starts");

  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(and(eq(campaigns.venueId, venueId), inArray(campaigns.status, ["scheduled", "sent"]), gte(campaigns.createdAt, new Date(now - 7 * DAY))));
  if ((recent[0]?.n ?? 0) >= VENUE_WEEKLY_CAP) {
    throw new HttpError(429, "You can send 2 campaigns a week, so guests keep loving them. Try again in a few days.");
  }

  const [campaign] = await db
    .insert(campaigns)
    .values({
      venueId,
      title: input.title.trim(),
      message: input.message.trim(),
      offerType: input.offerType,
      offerLabel: input.offerType === "free_item" ? input.offerLabel!.trim() : null,
      eventAt: input.eventAt ?? null,
      audience: input.audience,
      status: "scheduled",
      sendAt: sendAt ?? new Date(now),
    })
    .returning();
  if (!sendAt) return sendCampaign(campaign.id);
  return campaign;
}

export async function cancelCampaign(campaignId: string) {
  const [c] = await db
    .update(campaigns)
    .set({ status: "cancelled" })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "scheduled")))
    .returning();
  if (!c) throw new HttpError(400, "Only a campaign that hasn't gone out yet can be cancelled");
  return c;
}

/** Sends a scheduled campaign now. Safe to call twice: only one call claims it. */
export async function sendCampaign(campaignId: string) {
  const [claimed] = await db
    .update(campaigns)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "scheduled")))
    .returning();
  if (!claimed) {
    const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
    if (!c) throw new HttpError(404, "Campaign not found");
    return c;
  }
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, claimed.venueId) });
  if (!venue) return claimed;

  const [reachable, ever, recentRegulars] = await Promise.all([
    reachableIds(),
    visitorIds(venue.id),
    visitorIds(venue.id, new Date(Date.now() - REGULAR_DAYS * DAY)),
  ]);
  let audience = [...reachable].filter((id) => claimed.audience === "everyone" || recentRegulars.has(id));

  // Respect the 2-invites-a-week promise to guests.
  if (audience.length) {
    const busy = await db
      .select({ id: campaignRecipients.customerId, n: sql<number>`count(*)::int` })
      .from(campaignRecipients)
      .where(and(inArray(campaignRecipients.customerId, audience), gte(campaignRecipients.sentAt, new Date(Date.now() - 7 * DAY))))
      .groupBy(campaignRecipients.customerId);
    const capped = new Set(busy.filter((b) => b.n >= GUEST_WEEKLY_CAP).map((b) => b.id));
    audience = audience.filter((id) => !capped.has(id));
  }

  const title = `${claimed.title ?? "Tonight"} at ${venue.name}`;
  const offer = offerText(claimed);
  const body = offer ? `${claimed.message} ${offer}.` : claimed.message;
  const url = `/v/${venue.slug}?c=${claimed.id}`;
  let reached = 0;
  for (const customerId of audience) {
    const inserted = await db
      .insert(campaignRecipients)
      .values({ campaignId: claimed.id, customerId, wasRegular: ever.has(customerId) })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) continue;
    if (await notifyCustomer(customerId, title, body, url).catch(() => false)) reached++;
  }
  const [done] = await db.update(campaigns).set({ recipientCount: reached }).where(eq(campaigns.id, claimed.id)).returning();
  await sendPushToOwner(
    venue.id,
    `📣 "${claimed.title}" went out`,
    reached ? `${reached} guest${reached === 1 ? "" : "s"} got it. It's also on Explore and your Skuzi page.` : "It's on Explore and your Skuzi page. Your audience grows every time a guest pays with Skuzi.",
    { url: `/campaigns/${claimed.id}` },
  ).catch(() => {});
  return done;
}

/** The scheduler's job: send campaigns whose time has come. */
export async function sendDueCampaigns() {
  const due = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.status, "scheduled"), lte(campaigns.sendAt, new Date())));
  for (const c of due) await sendCampaign(c.id).catch((err) => console.error("[campaign] send failed", c.id, err.message));
}

/**
 * A guest just sat down (new tab): if a campaign from this venue reached them in
 * the last 7 days, they came because of it.
 */
export async function attributeVisit(venueId: string, customerId: string, tabId: string) {
  const since = new Date(Date.now() - CAMPAIGN_WINDOW_DAYS * DAY);
  const [hit] = await db
    .select({ id: campaignRecipients.id, campaignId: campaignRecipients.campaignId })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(and(
      eq(campaignRecipients.customerId, customerId),
      eq(campaigns.venueId, venueId),
      isNull(campaignRecipients.cameAt),
      gte(campaignRecipients.sentAt, since),
    ))
    .orderBy(desc(campaignRecipients.sentAt))
    .limit(1);
  if (!hit) return null;
  await db.update(campaignRecipients).set({ cameAt: new Date(), cameTabId: tabId }).where(eq(campaignRecipients.id, hit.id));
  await db.update(tabs).set({ campaignId: hit.campaignId }).where(eq(tabs.id, tabId));
  await db.update(campaigns).set({ returnVisits: sql`${campaigns.returnVisits} + 1` }).where(eq(campaigns.id, hit.campaignId));
  return hit.campaignId;
}

/** The offer on a tab, if its guest came because of a campaign. */
export async function offerForTab(tabId: string) {
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId) });
  if (!tab?.campaignId) return null;
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, tab.campaignId) });
  if (!c) return null;
  return { campaignId: c.id, title: c.title, offerType: c.offerType as OfferType, offerLabel: c.offerLabel, text: offerText(c) };
}

async function resultsFor(campaignIds: string[]) {
  const out = new Map<string, { came: number; regulars: number; newFaces: number; spentRwf: number; paidWithSkuzi: number; skuziFeeRwf: number }>();
  for (const id of campaignIds) out.set(id, { came: 0, regulars: 0, newFaces: 0, spentRwf: 0, paidWithSkuzi: 0, skuziFeeRwf: 0 });
  if (!campaignIds.length) return out;
  const came = await db
    .select({ campaignId: campaignRecipients.campaignId, tabId: campaignRecipients.cameTabId, wasRegular: campaignRecipients.wasRegular })
    .from(campaignRecipients)
    .where(and(inArray(campaignRecipients.campaignId, campaignIds), sql`${campaignRecipients.cameAt} is not null`));
  const tabIds = came.map((c) => c.tabId).filter(Boolean) as string[];
  const spent = new Map<string, number>();
  const paid = new Map<string, { amount: number; fee: number }>();
  if (tabIds.length) {
    const s = await db
      .select({ tabId: orders.tabId, total: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPriceRwf}), 0)::int` })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(inArray(orders.tabId, tabIds), eq(orders.isNudge, false)))
      .groupBy(orders.tabId);
    for (const r of s) spent.set(r.tabId, r.total);
    const p = await db
      .select({ tabId: momoPayments.tabId, amount: momoPayments.amountRwf, fee: momoPayments.tabproCommissionRwf })
      .from(momoPayments)
      .where(and(inArray(momoPayments.tabId, tabIds), eq(momoPayments.status, "successful")));
    for (const r of p) if (r.tabId) paid.set(r.tabId, { amount: r.amount, fee: r.fee ?? 0 });
  }
  for (const c of came) {
    const r = out.get(c.campaignId)!;
    r.came++;
    c.wasRegular ? r.regulars++ : r.newFaces++;
    if (c.tabId) {
      r.spentRwf += spent.get(c.tabId) ?? 0;
      const pay = paid.get(c.tabId);
      if (pay) { r.paidWithSkuzi++; r.skuziFeeRwf += pay.fee; }
    }
  }
  return out;
}

export async function getCampaigns(venueId: string) {
  const list = await db.query.campaigns.findMany({
    where: eq(campaigns.venueId, venueId),
    orderBy: [desc(campaigns.createdAt)],
  });
  const results = await resultsFor(list.map((c) => c.id));
  return list.map((c) => ({ ...c, offerText: offerText(c), results: results.get(c.id)! }));
}

export async function getCampaign(campaignId: string) {
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  if (!c) throw new HttpError(404, "Campaign not found");
  const results = await resultsFor([c.id]);
  return { ...c, offerText: offerText(c), results: results.get(c.id)! };
}

/** Upcoming events (campaigns with a date) for Explore and venue pages. */
export async function upcomingEvents(venueIds: string[]) {
  if (!venueIds.length) return [];
  const now = Date.now();
  return db.query.campaigns.findMany({
    where: and(
      inArray(campaigns.venueId, venueIds),
      inArray(campaigns.status, ["scheduled", "sent"]),
      gte(campaigns.eventAt, new Date(now - 4 * 60 * 60_000)),
      lte(campaigns.eventAt, new Date(now + 7 * DAY)),
    ),
    orderBy: (c, { asc }) => [asc(c.eventAt)],
  });
}
