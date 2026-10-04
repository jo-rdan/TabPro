import { db } from '../lib/db';
import { tabs, tables } from '../models/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { sendPushToOwner } from './push.service';

// A bill counts as "left open" once nobody has touched it for a long while,
// or it's from much earlier (e.g. last night). It's not an accusation: the
// owner sees the table, the amount and the guest's number, and decides.
const QUIET_FOR_MS = 2 * 60 * 60_000;
const OPEN_FOR_MS = 6 * 60 * 60_000;

export async function getLeftOpenBills(venueId: string) {
  const venueTables = await db.query.tables.findMany({ where: eq(tables.venueId, venueId), columns: { id: true } });
  if (venueTables.length === 0) return [];

  const open = await db.query.tabs.findMany({
    // 'abandoned' is how older versions marked a quiet bill: still unpaid.
    where: and(inArray(tabs.status, ['open', 'bill_requested', 'abandoned']), inArray(tabs.tableId, venueTables.map((t) => t.id))),
    with: { table: true, customer: true, orders: { with: { items: true } } },
  });

  const now = Date.now();
  return open
    .filter((t) => t.orders.some((o) => o.source === 'customer'))
    .map((t) => ({
      tabId: t.id,
      tableLabel: t.table.label,
      total: t.orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.unitPriceRwf * i.quantity, 0), 0),
      phone: t.customer?.phone ?? null,
      name: t.customer?.name ?? null,
      openedAt: t.openedAt,
      lastSeenAt: t.lastSeenAt,
    }))
    .filter((b) => b.total > 0)
    .filter((b) => now - (b.lastSeenAt ?? b.openedAt).getTime() > QUIET_FOR_MS || now - b.openedAt.getTime() > OPEN_FOR_MS)
    .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
}

// ─── Morning summary for owners ───────────────────────────────────────────────
// Bars in Kigali are closed by 04:00, so that's when we sum up what's still
// open. The alert has amounts only; guests' numbers stay inside the app.
const SUMMARY_HOUR_KIGALI = 4;
let lastSummaryDay = '';

export async function checkUnpaidBills(now = new Date()) {
  const kigali = new Date(now.getTime() + 2 * 60 * 60_000); // UTC+2, no daylight saving
  const day = kigali.toISOString().slice(0, 10);
  if (kigali.getUTCHours() !== SUMMARY_HOUR_KIGALI || lastSummaryDay === day) return;
  lastSummaryDay = day;
  await sendUnpaidSummaries();
}

export async function sendUnpaidSummaries() {
  const allVenues = await db.query.venues.findMany({ columns: { id: true } });
  for (const venue of allVenues) {
    const bills = await getLeftOpenBills(venue.id);
    if (bills.length === 0) continue;
    const sum = bills.reduce((s, b) => s + b.total, 0);
    await sendPushToOwner(
      venue.id,
      `🧾 ${bills.length} ${bills.length === 1 ? 'bill was' : 'bills were'} left open · ${sum.toLocaleString('en-US')} RWF`,
      'Open TabPro to see the tables and the guests’ phone numbers.',
    );
  }
}

export function startUnpaidBillsChecker() {
  setInterval(() => checkUnpaidBills().catch((err) => console.error('[unpaid]', err)), 10 * 60_000);
}

