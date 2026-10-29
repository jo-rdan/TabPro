import { db } from '../lib/db';
import { tabs, tables, venues, tips, kitchenSpends } from '../models/schema';
import { and, eq, gte, lt, inArray, sql } from 'drizzle-orm';
import { nightStart, nightStartOf } from './tonight.service';
import { categoriesOf } from './kitchen.service';
import { venueAllows } from './plan.service';
import { sendPushToOwner } from './push.service';

// The night's report for the owner: what was sold, how it was paid, what's
// still unpaid, the best sellers and the waiters. A night runs 06:00 to 06:00
// Kigali time; bars close at 2am, so at 2am the owner gets "your report is
// ready" and can download it as a PDF from the Report page.

const KIGALI_MS = 2 * 3600e3;
const DAY_MS = 24 * 3600e3;
const kigaliDate = (d: Date) => new Date(d.getTime() + KIGALI_MS).toISOString().slice(0, 10);
const kigaliHour = (d: Date) => new Date(d.getTime() + KIGALI_MS).getUTCHours();

export async function getNightReport(venueId: string, night?: string) {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new Error('Venue not found');
  if (night && !/^\d{4}-\d{2}-\d{2}$/.test(night)) throw new Error('Pick a night like 2026-10-29');
  const start = night ? nightStartOf(night) : nightStart();
  const end = new Date(start.getTime() + DAY_MS);

  const venueTables = await db.query.tables.findMany({ where: eq(tables.venueId, venueId), columns: { id: true } });
  const bills = venueTables.length === 0 ? [] : await db.query.tabs.findMany({
    where: and(inArray(tabs.tableId, venueTables.map((t) => t.id)), gte(tabs.openedAt, start), lt(tabs.openedAt, end)),
    with: { table: true, staff: true, orders: { with: { items: { with: { menuItem: true } } } } },
  });

  const lines = bills.map((b) => {
    const items = b.orders.flatMap((o) => o.items);
    return { bill: b, items, total: items.reduce((n, i) => n + i.unitPriceRwf * i.quantity, 0) };
  }).filter((x) => x.total > 0);

  const paid = lines.filter((x) => x.bill.status === 'closed');
  const unpaid = lines.filter((x) => x.bill.status !== 'closed');
  const sum = (xs: typeof lines) => xs.reduce((n, x) => n + x.total, 0);
  const salesRwf = sum(lines);

  // Best sellers
  const byItem = new Map<string, { name: string; quantity: number; salesRwf: number; category: string }>();
  for (const { items } of lines) {
    for (const i of items) {
      const row = byItem.get(i.menuItem.name) ?? { name: i.menuItem.name, quantity: 0, salesRwf: 0, category: i.menuItem.category };
      row.quantity += i.quantity;
      row.salesRwf += i.unitPriceRwf * i.quantity;
      byItem.set(i.menuItem.name, row);
    }
  }
  const items = [...byItem.values()].sort((a, b) => b.salesRwf - a.salesRwf);

  // Waiters, with the tips guests told us about
  const tipRows = await db
    .select({ staffId: tips.staffId, total: sql<number>`coalesce(sum(${tips.amountRwf}), 0)::int` })
    .from(tips)
    .where(and(eq(tips.venueId, venueId), gte(tips.createdAt, start), lt(tips.createdAt, end)))
    .groupBy(tips.staffId);
  const byWaiter = new Map<string, { name: string; bills: number; salesRwf: number; tipsRwf: number }>();
  for (const { bill, total } of lines) {
    const key = bill.staff?.id ?? 'none';
    const row = byWaiter.get(key) ?? { name: bill.staff?.name ?? 'No waiter', bills: 0, salesRwf: 0, tipsRwf: 0 };
    row.bills += 1;
    row.salesRwf += total;
    byWaiter.set(key, row);
  }
  for (const t of tipRows) {
    const row = byWaiter.get(t.staffId);
    if (row) row.tipsRwf = t.total;
  }

  // Busiest hour, by money ordered
  const byHour = new Map<number, number>();
  for (const { bill } of lines) {
    for (const o of bill.orders) {
      const h = kigaliHour(o.placedAt);
      byHour.set(h, (byHour.get(h) ?? 0) + o.items.reduce((n, i) => n + i.unitPriceRwf * i.quantity, 0));
    }
  }
  const busiest = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];

  // Food stock (Bar+): food bought vs food sold
  let food: { soldRwf: number; boughtRwf: number } | null = null;
  if (venueAllows(venue, 'stock')) {
    const { kitchen } = await categoriesOf(venueId);
    const [bought] = await db
      .select({ total: sql<number>`coalesce(sum(${kitchenSpends.amountRwf}), 0)::int` })
      .from(kitchenSpends)
      .where(and(eq(kitchenSpends.venueId, venueId), gte(kitchenSpends.spentAt, start), lt(kitchenSpends.spentAt, end)));
    food = { soldRwf: items.filter((i) => kitchen.includes(i.category)).reduce((n, i) => n + i.salesRwf, 0), boughtRwf: bought?.total ?? 0 };
  }

  return {
    venueName: venue.name,
    night: kigaliDate(start),
    from: start.toISOString(),
    to: end.toISOString(),
    salesRwf,
    bills: lines.length,
    averageBillRwf: lines.length ? Math.round(salesRwf / lines.length) : 0,
    paid: {
      momoRwf: sum(paid.filter((x) => x.bill.paidWith === 'momo')),
      cashRwf: sum(paid.filter((x) => x.bill.paidWith === 'cash')),
      // Bills closed before 'paid with' was recorded, or paid in-app.
      otherRwf: sum(paid.filter((x) => x.bill.paidWith !== 'momo' && x.bill.paidWith !== 'cash')),
    },
    unpaidRwf: sum(unpaid),
    unpaidBills: unpaid
      .map((x) => ({ tableLabel: x.bill.table.label, totalRwf: x.total, openedAt: x.bill.openedAt }))
      .sort((a, b) => b.totalRwf - a.totalRwf),
    topItems: items.slice(0, 8).map(({ name, quantity, salesRwf }) => ({ name, quantity, salesRwf })),
    waiters: [...byWaiter.values()].sort((a, b) => b.salesRwf - a.salesRwf),
    busiestHour: busiest ? { hour: busiest[0], salesRwf: busiest[1] } : null,
    food,
  };
}

// ─── 2am: "your report is ready" ─────────────────────────────────────────────
// Sent once per venue per night, between 02:00 and 03:00 Kigali time, only for
// nights that had sales. (Remembered in memory: a restart in that hour could
// send it twice, which is harmless.)
const sentFor = new Set<string>();

export async function sendNightReports(now = new Date()) {
  if (kigaliHour(now) !== 2) return;
  const night = kigaliDate(nightStart(now));
  const all = await db.query.venues.findMany({ where: eq(venues.isDemo, false), columns: { id: true } });
  for (const { id } of all) {
    const key = `${id}:${night}`;
    if (sentFor.has(key)) continue;
    sentFor.add(key);
    try {
      const r = await getNightReport(id, night);
      if (r.salesRwf === 0) continue;
      const unpaid = r.unpaidBills.length ? ` · ${r.unpaidBills.length} still unpaid` : '';
      await sendPushToOwner(
        id,
        `🌙 Tonight's report: ${r.salesRwf.toLocaleString('en-US')} RWF`,
        `${r.bills} ${r.bills === 1 ? 'bill' : 'bills'}${unpaid}. Tap to see it all and download it.`,
        { url: `/report?night=${night}` },
      );
    } catch (err: any) {
      console.error('[night report]', id, err?.message);
    }
  }
}
