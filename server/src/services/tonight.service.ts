import { db } from '../lib/db';
import { tabs, tables } from '../models/schema';
import { and, eq, gte, inArray } from 'drizzle-orm';

// Kigali has no daylight saving: UTC+2 all year. A bar's "night" runs from
// 06:00 to 06:00 local time, so a 01:30 payment counts for the evening before.
const KIGALI_MS = 2 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

function nightStart(now = new Date()) {
  const local = new Date(now.getTime() + KIGALI_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 6) - KIGALI_MS;
  return new Date(local.getUTCHours() < 6 ? start - DAY_MS : start);
}

const kigaliHour = (d: Date) => new Date(d.getTime() + KIGALI_MS).getUTCHours();
const tabTotal = (t: { orders: { items: { unitPriceRwf: number; quantity: number }[] }[] }) =>
  t.orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.unitPriceRwf * i.quantity, 0), 0);

// Tonight's money hour by hour, last week's same night, and the best night in
// the last 90 days: everything the money chart and the coin jar need.
export async function getTonight(venueId: string) {
  const start = nightStart();
  const since = new Date(start.getTime() - 90 * DAY_MS);
  const venueTables = await db.query.tables.findMany({ where: eq(tables.venueId, venueId), columns: { id: true } });
  if (venueTables.length === 0) return { total: 0, hourly: [], lastSameNight: 0, lastSameNightSoFar: 0, bestNight: 0, nightsWithData: 0 };

  const closed = await db.query.tabs.findMany({
    where: and(eq(tabs.status, 'closed'), gte(tabs.closedAt, since), inArray(tabs.tableId, venueTables.map((t) => t.id))),
    with: { orders: { with: { items: true } } },
  });

  const byNight = new Map<number, number>();
  const tonightByHour = new Map<number, number>();
  let lastWeekSoFar = 0; // same night last week, up to this time: a fair comparison mid-evening
  for (const t of closed) {
    if (!t.closedAt) continue;
    const total = tabTotal(t);
    const night = Math.floor((t.closedAt.getTime() - start.getTime()) / DAY_MS); // 0 = tonight, -7 = same night last week
    byNight.set(night, (byNight.get(night) ?? 0) + total);
    if (night === -7 && t.closedAt.getTime() <= Date.now() - 7 * DAY_MS) lastWeekSoFar += total;
    if (night === 0) {
      const h = kigaliHour(t.closedAt);
      tonightByHour.set(h, (tonightByHour.get(h) ?? 0) + total);
    }
  }

  // Cumulative curve from 17:00 (or the first sale, if earlier) to the current hour.
  const nowHour = kigaliHour(new Date());
  const order = (h: number) => (h < 6 ? h + 24 : h);
  const firstSale = Math.min(...[...tonightByHour.keys()].map(order), 17);
  const lastHour = Math.max(order(nowHour), firstSale);
  const hourly: { hour: string; cumulative: number }[] = [];
  let running = 0;
  for (let h = firstSale; h <= lastHour; h++) {
    running += tonightByHour.get(h % 24) ?? 0;
    hourly.push({ hour: `${String(h % 24).padStart(2, '0')}:00`, cumulative: running });
  }

  const past = [...byNight.entries()].filter(([n]) => n < 0);
  return {
    total: byNight.get(0) ?? 0,
    hourly,
    lastSameNight: byNight.get(-7) ?? 0,
    lastSameNightSoFar: lastWeekSoFar,
    bestNight: past.reduce((m, [, v]) => Math.max(m, v), 0),
    nightsWithData: past.length,
  };
}
