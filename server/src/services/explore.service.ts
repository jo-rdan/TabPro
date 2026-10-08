import { db } from "../lib/db";
import { menuItems, orderItems, orders, tables, tabs, venues } from "../models/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { HttpError } from "../middleware/error.middleware";
import { DAY_KEYS, hoursOf, kigaliTime, openStatus, parseHours } from "../lib/hours";
import { offerText, upcomingEvents } from "./campaign.service";

// Guests' own Skuzi: Explore ("Where to tonight?") and each venue's page.
// Everything shown is real: the venue's menu, its picks, its events. With few
// venues it leads with tonight's events and dishes, never with a count.
type Venue = typeof venues.$inferSelect;
type Item = typeof menuItems.$inferSelect;

const publicItem = (i: Item) => ({ id: i.id, name: i.name, description: i.description, category: i.category, priceRwf: i.priceRwf, featured: i.featured });

/** Up to 3 dishes to show: the owner's picks, else the most ordered lately, else the first ones. */
async function picksFor(venueIds: string[], items: Item[]) {
  const byVenue = new Map<string, Item[]>();
  for (const i of items) (byVenue.get(i.venueId) ?? byVenue.set(i.venueId, []).get(i.venueId)!).push(i);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const popular = venueIds.length
    ? await db
        .select({ itemId: orderItems.menuItemId, n: sql<number>`sum(${orderItems.quantity})::int` })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(tabs, eq(orders.tabId, tabs.id))
        .innerJoin(tables, eq(tabs.tableId, tables.id))
        .where(and(inArray(tables.venueId, venueIds), gte(orders.placedAt, since)))
        .groupBy(orderItems.menuItemId)
        .orderBy(desc(sql`sum(${orderItems.quantity})`))
    : [];
  const rank = new Map(popular.map((p, i) => [p.itemId, i]));
  const out = new Map<string, { label: "Chef's picks" | "Popular" | "On the menu"; items: ReturnType<typeof publicItem>[] }>();
  for (const id of venueIds) {
    const list = byVenue.get(id) ?? [];
    const featured = list.filter((i) => i.featured).slice(0, 3);
    if (featured.length) { out.set(id, { label: "Chef's picks", items: featured.map(publicItem) }); continue; }
    const ordered = list.filter((i) => rank.has(i.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!).slice(0, 3);
    if (ordered.length >= 2) { out.set(id, { label: "Popular", items: ordered.map(publicItem) }); continue; }
    out.set(id, { label: "On the menu", items: list.slice(0, 3).map(publicItem) });
  }
  return out;
}

function eventView(e: Awaited<ReturnType<typeof upcomingEvents>>[number], venue: Venue) {
  return {
    id: e.id,
    title: e.title,
    message: e.message,
    eventAt: e.eventAt,
    time: e.eventAt ? kigaliTime(e.eventAt) : null,
    offer: offerText(e),
    venue: { slug: venue.slug, name: venue.name, location: venue.location },
  };
}

function venueSummary(v: Venue) {
  const hours = hoursOf(v.openingHours);
  return {
    slug: v.slug,
    name: v.name,
    location: v.location,
    logoUrl: v.logoUrl,
    bookingsEnabled: v.bookingsEnabled,
    hoursSet: !!parseHours(v.openingHours),
    status: openStatus(hours),
  };
}

export async function explore() {
  const list = await db.query.venues.findMany({
    where: and(eq(venues.listed, true), eq(venues.isDemo, false), eq(venues.isActive, true)),
  });
  const ids = list.map((v) => v.id);
  const items = ids.length
    ? await db.query.menuItems.findMany({ where: and(inArray(menuItems.venueId, ids), eq(menuItems.isAvailable, true)) })
    : [];
  // Only venues with a menu: nothing half set-up on Explore.
  const ready = list.filter((v) => items.some((i) => i.venueId === v.id));
  const readyIds = ready.map((v) => v.id);
  const [picks, events] = await Promise.all([picksFor(readyIds, items), upcomingEvents(readyIds)]);
  const byId = new Map(ready.map((v) => [v.id, v]));
  // Open places first, then the rest.
  ready.sort((a, b) => Number(openStatus(hoursOf(b.openingHours)).open) - Number(openStatus(hoursOf(a.openingHours)).open));
  return {
    venues: ready.map((v) => ({ ...venueSummary(v), picks: picks.get(v.id)! })),
    events: events.map((e) => eventView(e, byId.get(e.venueId)!)),
  };
}

export async function venuePage(slug: string) {
  const v = await db.query.venues.findFirst({ where: eq(venues.slug, slug) });
  if (!v || !v.isActive) throw new HttpError(404, "We couldn't find this restaurant");
  const items = await db.query.menuItems.findMany({
    where: and(eq(menuItems.venueId, v.id), eq(menuItems.isAvailable, true)),
    orderBy: (m, { asc }) => [asc(m.category), asc(m.name)],
  });
  const [picks, events] = await Promise.all([picksFor([v.id], items), upcomingEvents([v.id])]);
  const hours = hoursOf(v.openingHours);
  const menu: Record<string, ReturnType<typeof publicItem>[]> = {};
  for (const i of items) (menu[i.category] ??= []).push(publicItem(i));
  return {
    ...venueSummary(v),
    isDemo: v.isDemo,
    hours: DAY_KEYS.map((k) => ({ day: k, hours: hours[k] })),
    picks: picks.get(v.id)!,
    events: events.map((e) => eventView(e, v)),
    menu,
  };
}
