import { db } from '../lib/db';
import { tabs, orders } from '../models/schema';
import { eq, and, lt, inArray, isNull } from 'drizzle-orm';
import { broadcastToVenue } from '../lib/websocket';
import { notifyTable } from './push.service';

// A locked phone stops pinging, so silence alone is normal at a bar. Flag a
// tab after a while, and never change its status: the bill must stay open
// and collectable until a waiter closes it.
const AWAY_ALERT_AFTER_MS = 5 * 60_000;

// When the customer's page reports that it's closing, wait this long for it to
// come back (a reload, a quick app switch) before raising the alarm.
const LEFT_GRACE_MS = 20_000;

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

type WatchedTab = NonNullable<Awaited<ReturnType<typeof loadTab>>>;

function loadTab(tabId: string) {
  return db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: { table: { with: { venue: true } }, orders: { with: { items: true } } },
  });
}

// Waiter-opened walk-in tabs never send heartbeats; only watch tabs the
// customer is driving from their own phone, and only if they owe money.
function owesMoney(tab: WatchedTab) {
  return ['open', 'bill_requested'].includes(tab.status) && tab.orders.some((o) => o.source === 'customer');
}

function unpaidTotal(tab: WatchedTab) {
  return tab.orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.unitPriceRwf * i.quantity, 0), 0);
}

async function raiseAway(tab: WatchedTab, reason: 'closed' | 'silent') {
  if (alertedTabs.has(tab.id)) return;
  alertedTabs.add(tab.id);

  const venueId = tab.table.venueId;
  const tableLabel = tab.table.label;
  const total = unpaidTotal(tab);
  const owed = total > 0 ? `${total.toLocaleString('en-US')} RWF` : 'the bill';

  broadcastToVenue(venueId, {
    type: 'customer_away',
    payload: { tabId: tab.id, tableId: tab.tableId, tableLabel, lastSeenAt: tab.lastSeenAt, reason, total },
    venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });

  const title =
    reason === 'closed'
      ? `🚪 ${tableLabel} closed TabPro with ${owed} unpaid`
      : `👀 ${tableLabel}: customer may have left`;
  const detail =
    reason === 'closed'
      ? 'Their page was just closed. Check they are still at the table.'
      : `No sign of them for 5 minutes and ${owed} is still unpaid.`;
  await notifyTable(
    venueId,
    tab.tableId,
    tab.staffId,
    { title, body: `${detail} Go check now.` },
    { title, body: `${detail} Their waiter has been told.` },
  );
}

// ─── The customer's page says it's closing ───────────────────────────────────
// Sent by the browser as the tab closes. A reload or app switch pings again
// within seconds, so only alert if they stay gone.
export function recordCustomerLeft(tabId: string) {
  const leftAt = Date.now();
  setTimeout(async () => {
    try {
      const tab = await loadTab(tabId);
      if (!tab?.table?.venue || !owesMoney(tab)) return;
      if (tab.lastSeenAt && tab.lastSeenAt.getTime() > leftAt) return; // came back
      await raiseAway(tab, 'closed');
    } catch (err) {
      console.error('[heartbeat] left', err);
    }
  }, LEFT_GRACE_MS);
}

// ─── Alert staff about tabs whose customer has gone quiet ────────────────────
export async function checkAbandonedTabs() {
  const cutoff = new Date(Date.now() - AWAY_ALERT_AFTER_MS);

  const staleTabs = await db.query.tabs.findMany({
    where: and(inArray(tabs.status, ['open', 'bill_requested']), lt(tabs.lastSeenAt, cutoff)),
    columns: { id: true },
  });

  for (const { id } of staleTabs) {
    if (alertedTabs.has(id)) continue;
    const tab = await loadTab(id);
    if (!tab?.table?.venue || !owesMoney(tab)) continue;
    await raiseAway(tab, 'silent');
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
