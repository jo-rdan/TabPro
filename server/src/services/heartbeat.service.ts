import { db } from '../lib/db';
import { tabs } from '../models/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
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

// ─── Start the background checker ────────────────────────────────────────────
export function startHeartbeatChecker() {
  setInterval(() => checkAbandonedTabs().catch((err) => console.error('[heartbeat]', err)), 30_000);
  console.log('[heartbeat] Abandoned tab checker started');
}
