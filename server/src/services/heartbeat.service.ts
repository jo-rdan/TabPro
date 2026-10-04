import { db } from '../lib/db';
import { tabs, orders } from '../models/schema';
import { eq, and, lt, inArray, isNull } from 'drizzle-orm';
import { broadcastToVenue } from '../lib/websocket';
import { notifyTable } from './push.service';

// A locked phone stops pinging, so silence alone is normal at a bar. Only
// flag a tab once it has gone quiet for a long time, and never change its
// status: the bill must stay open and collectable.
const AWAY_ALERT_AFTER_MS = 10 * 60_000;

// Tabs we've already alerted about (cleared when the customer pings again),
// so staff get one alert per absence instead of one every 30 seconds.
const alertedTabs = new Set<string>();

// ─── Update last seen timestamp ───────────────────────────────────────────────
export async function recordHeartbeat(tabId: string) {
  alertedTabs.delete(tabId);
  await db
    .update(tabs)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(tabs.id, tabId), inArray(tabs.status, ['open', 'bill_requested'])));
}

// ─── Alert staff about tabs whose customer seems to have left ────────────────
export async function checkAbandonedTabs() {
  const cutoff = new Date(Date.now() - AWAY_ALERT_AFTER_MS);

  const staleTabs = await db.query.tabs.findMany({
    where: and(
      inArray(tabs.status, ['open', 'bill_requested']),
      lt(tabs.lastSeenAt, cutoff),
    ),
    with: { table: { with: { venue: true } }, orders: true },
  });

  for (const tab of staleTabs) {
    if (!tab.table?.venue || alertedTabs.has(tab.id)) continue;
    // Waiter-opened walk-in tabs never send heartbeats; only watch tabs the
    // customer is driving from their own phone, and only if they owe money.
    if (!tab.orders.some((o) => o.source === 'customer')) continue;
    alertedTabs.add(tab.id);

    const venueId = tab.table.venueId;
    const tableLabel = tab.table.label;

    // Soft websocket nudge to waiter and owner
    broadcastToVenue(venueId, {
      type: 'customer_away',
      payload: {
        tabId: tab.id,
        tableId: tab.tableId,
        tableLabel,
        lastSeenAt: tab.lastSeenAt,
      },
      venueId,
      tableId: tab.tableId,
      timestamp: new Date().toISOString(),
    });

    // Push notification — soft tone, not alarming
    await notifyTable(
      venueId,
      tab.tableId,
      tab.staffId,
      {
        title: `👀 ${tableLabel} — customer may have stepped away`,
        body: 'No activity for 10 minutes and the bill is still open. Worth a quick check.',
      },
      {
        title: `👀 ${tableLabel} — customer may have stepped away`,
        body: 'No activity for 10 minutes and the bill is still open. Staff have been notified.',
      },
    );
  }
}

// ─── Orders nobody has started ───────────────────────────────────────────────
// A guest waiting 10 minutes for a drink nobody saw is the worst night out.
// Tell the waiter and the owner once per order.
const ORDER_WAIT_ALERT_MS = 10 * 60_000;

export async function checkWaitingOrders() {
  const cutoff = new Date(Date.now() - ORDER_WAIT_ALERT_MS);
  const waiting = await db.query.orders.findMany({
    where: and(eq(orders.status, 'pending'), eq(orders.isNudge, false), lt(orders.placedAt, cutoff), isNull(orders.waitAlertAt)),
    with: { tab: { with: { table: true } } },
  });

  for (const order of waiting) {
    // Claim it first so two checkers never alert twice.
    const [claimed] = await db
      .update(orders)
      .set({ waitAlertAt: new Date() })
      .where(and(eq(orders.id, order.id), isNull(orders.waitAlertAt)))
      .returning();
    if (!claimed || !order.tab || order.tab.status === 'closed') continue;

    const label = order.tab.table.label;
    const minutes = Math.round((Date.now() - order.placedAt.getTime()) / 60_000);
    await notifyTable(
      order.tab.table.venueId,
      order.tab.tableId,
      order.tab.staffId,
      { title: `⏰ ${label}: order waiting ${minutes} min`, body: 'Nobody has started it yet. Mark it "preparing" once it is.' },
      { title: `⏰ ${label}: an order has waited ${minutes} min`, body: 'Their waiter has been reminded.' },
    );
  }
}

// ─── Start the background checker ────────────────────────────────────────────
export function startHeartbeatChecker() {
  setInterval(() => checkAbandonedTabs().catch((err) => console.error('[heartbeat]', err)), 30_000);
  setInterval(() => checkWaitingOrders().catch((err) => console.error('[order-wait]', err)), 60_000);
  console.log('[heartbeat] Abandoned tab checker started');
}
