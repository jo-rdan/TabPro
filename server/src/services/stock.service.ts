import { db } from '../lib/db';
import { menuItems, stockMovements } from '../models/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { sendPushToOwner } from './push.service';
import { broadcastToVenue } from '../lib/websocket';

// Stock for bars: an item the owner switched to "track stock" is counted down by
// every order (guest or waiter), counted up by deliveries, and reset by a count,
// which records how many went missing. At 0 the item is sold out automatically;
// a delivery or a count above 0 puts it back on the menu.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type StockAlert = { name: string; left: number };

/** Kigali business day: "tonight" starts at 05:00 local (03:00 UTC). */
export function startOfBusinessDay(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(3, 0, 0, 0);
  if (now < start) start.setUTCDate(start.getUTCDate() - 1);
  return start;
}

/**
 * Inside the order's transaction: take the ordered quantities off every tracked
 * item. Throws (rolling the order back) if there isn't enough left, so a guest
 * can't order the last bottle twice. Returns the alerts to send after commit.
 */
export async function takeStockForOrder(
  tx: Tx,
  venueId: string,
  orderId: string,
  lines: { menuItemId: string; quantity: number; name: string; stockTracked: boolean }[],
): Promise<StockAlert[]> {
  const alerts: StockAlert[] = [];
  const merged = new Map<string, { quantity: number; name: string }>();
  for (const l of lines) {
    if (!l.stockTracked) continue;
    const m = merged.get(l.menuItemId);
    merged.set(l.menuItemId, { quantity: (m?.quantity ?? 0) + l.quantity, name: l.name });
  }
  for (const [menuItemId, { quantity, name }] of merged) {
    const [row] = await tx
      .update(menuItems)
      .set({
        stockQty: sql`${menuItems.stockQty} - ${quantity}`,
        isAvailable: sql`CASE WHEN ${menuItems.stockQty} - ${quantity} <= 0 THEN false ELSE ${menuItems.isAvailable} END`,
      })
      .where(and(eq(menuItems.id, menuItemId), eq(menuItems.stockTracked, true), gte(menuItems.stockQty, quantity)))
      .returning({ qty: menuItems.stockQty, alertAt: menuItems.stockAlertAt });
    if (!row) {
      const item = await tx.query.menuItems.findFirst({ where: eq(menuItems.id, menuItemId) });
      const left = Math.max(0, item?.stockQty ?? 0);
      throw new Error(left === 0 ? `"${name}" is sold out` : `Only ${left} "${name}" left`);
    }
    const after = row.qty ?? 0;
    await tx.insert(stockMovements).values({ venueId, menuItemId, kind: 'sale', qtyChange: -quantity, qtyAfter: after, orderId });
    const before = after + quantity;
    if (after === 0 || (row.alertAt != null && before > row.alertAt && after <= row.alertAt)) alerts.push({ name, left: after });
  }
  return alerts;
}

/** After the order is saved: tell the owner what's running low or ran out. */
export async function sendStockAlerts(venueId: string, alerts: StockAlert[]) {
  for (const a of alerts) {
    await sendPushToOwner(
      venueId,
      a.left === 0 ? `🍺 ${a.name} is sold out` : `🍺 ${a.name}: ${a.left} left`,
      a.left === 0 ? 'Guests can no longer order it. Add a delivery to bring it back.' : 'Time to order more.',
    ).catch(() => {});
  }
  if (alerts.length) {
    broadcastToVenue(venueId, { type: 'stock_update', payload: {}, venueId, timestamp: new Date().toISOString() });
  }
}

/** The Stock page: every menu item, with what's left and what sold tonight. */
export async function getStock(venueId: string) {
  const since = startOfBusinessDay();
  const [items, sold] = await Promise.all([
    db.query.menuItems.findMany({ where: eq(menuItems.venueId, venueId) }),
    db
      .select({ menuItemId: stockMovements.menuItemId, sold: sql<number>`coalesce(-sum(${stockMovements.qtyChange}), 0)::int` })
      .from(stockMovements)
      .where(and(eq(stockMovements.venueId, venueId), eq(stockMovements.kind, 'sale'), gte(stockMovements.createdAt, since)))
      .groupBy(stockMovements.menuItemId),
  ]);
  const soldBy = new Map(sold.map((s) => [s.menuItemId, s.sold]));
  const list = items
    .map((i) => {
      const qty = i.stockQty ?? 0;
      const status = !i.stockTracked ? 'off' : qty <= 0 ? 'out' : i.stockAlertAt != null && qty <= i.stockAlertAt ? 'low' : 'ok';
      return {
        id: i.id, name: i.name, category: i.category, priceRwf: i.priceRwf,
        tracked: i.stockTracked, qty, alertAt: i.stockAlertAt, soldTonight: soldBy.get(i.id) ?? 0, status,
      };
    })
    .sort((a, b) => Number(b.tracked) - Number(a.tracked) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const tracked = list.filter((i) => i.tracked);
  return {
    items: list,
    summary: {
      soldTonight: tracked.reduce((n, i) => n + i.soldTonight, 0),
      low: tracked.filter((i) => i.status === 'low').length,
      out: tracked.filter((i) => i.status === 'out').length,
    },
  };
}

/** Switch tracking on/off for an item, with its starting count and warning level. */
export async function setTracking(menuItemId: string, input: { tracked: boolean; qty?: number; alertAt?: number | null }) {
  const item = await db.query.menuItems.findFirst({ where: eq(menuItems.id, menuItemId) });
  if (!item) throw new Error('Menu item not found');
  if (!input.tracked) {
    // Stop tracking; if stock had sold it out, it goes back on the menu.
    await db.update(menuItems).set({ stockTracked: false, ...((item.stockQty ?? 0) <= 0 ? { isAvailable: true } : {}) }).where(eq(menuItems.id, menuItemId));
    return;
  }
  const qty = Math.max(0, Math.floor(input.qty ?? item.stockQty ?? 0));
  const alertAt = input.alertAt == null ? item.stockAlertAt : Math.max(0, Math.floor(input.alertAt));
  await db.transaction(async (tx) => {
    await tx.update(menuItems)
      .set({ stockTracked: true, stockQty: qty, stockAlertAt: alertAt, isAvailable: qty > 0 })
      .where(eq(menuItems.id, menuItemId));
    if (!item.stockTracked || qty !== (item.stockQty ?? 0)) {
      await tx.insert(stockMovements).values({
        venueId: item.venueId, menuItemId, kind: 'count', qtyChange: 0, qtyAfter: qty, expectedQty: qty, note: 'Starting count',
      });
    }
  });
}

/** A delivery arrived: add bottles; anything above 0 is back on the menu. */
export async function addDelivery(venueId: string, lines: { menuItemId: string; qty: number }[], supplier?: string | null) {
  const note = supplier?.trim() ? supplier.trim().slice(0, 80) : null;
  await db.transaction(async (tx) => {
    for (const l of lines) {
      const qty = Math.floor(l.qty);
      if (!(qty > 0)) continue;
      const [row] = await tx.update(menuItems)
        .set({ stockQty: sql`coalesce(${menuItems.stockQty}, 0) + ${qty}`, isAvailable: true })
        .where(and(eq(menuItems.id, l.menuItemId), eq(menuItems.venueId, venueId), eq(menuItems.stockTracked, true)))
        .returning({ qty: menuItems.stockQty });
      if (!row) throw new Error('Switch on stock for this item first');
      await tx.insert(stockMovements).values({ venueId, menuItemId: l.menuItemId, kind: 'delivery', qtyChange: qty, qtyAfter: row.qty ?? qty, note });
    }
  });
  broadcastToVenue(venueId, { type: 'stock_update', payload: {}, venueId, timestamp: new Date().toISOString() });
}

/** The closing count: set the real numbers and report what went missing. */
export async function saveCount(venueId: string, lines: { menuItemId: string; counted: number }[]) {
  const missing: { name: string; qty: number; valueRwf: number }[] = [];
  const extra: { name: string; qty: number }[] = [];
  await db.transaction(async (tx) => {
    for (const l of lines) {
      const counted = Math.floor(l.counted);
      if (!(counted >= 0)) continue;
      const item = await tx.query.menuItems.findFirst({ where: and(eq(menuItems.id, l.menuItemId), eq(menuItems.venueId, venueId)) });
      if (!item || !item.stockTracked) continue;
      const expected = item.stockQty ?? 0;
      await tx.update(menuItems).set({ stockQty: counted, isAvailable: counted > 0 }).where(eq(menuItems.id, item.id));
      await tx.insert(stockMovements).values({
        venueId, menuItemId: item.id, kind: 'count', qtyChange: counted - expected, qtyAfter: counted, expectedQty: expected,
      });
      if (counted < expected) missing.push({ name: item.name, qty: expected - counted, valueRwf: (expected - counted) * item.priceRwf });
      if (counted > expected) extra.push({ name: item.name, qty: counted - expected });
    }
  });
  broadcastToVenue(venueId, { type: 'stock_update', payload: {}, venueId, timestamp: new Date().toISOString() });
  return { missing, extra, missingValueRwf: missing.reduce((n, m) => n + m.valueRwf, 0) };
}

/** One item's story: recent movements and this week's totals. */
export async function getItemHistory(menuItemId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600e3);
  const [movements, week] = await Promise.all([
    db.query.stockMovements.findMany({
      where: eq(stockMovements.menuItemId, menuItemId),
      orderBy: [desc(stockMovements.createdAt)],
      limit: 60,
      with: { order: { with: { tab: { with: { table: true } } } } },
    }),
    db
      .select({
        sold: sql<number>`coalesce(-sum(${stockMovements.qtyChange}) filter (where ${stockMovements.kind} = 'sale'), 0)::int`,
        delivered: sql<number>`coalesce(sum(${stockMovements.qtyChange}) filter (where ${stockMovements.kind} = 'delivery'), 0)::int`,
        missing: sql<number>`coalesce(-sum(${stockMovements.qtyChange}) filter (where ${stockMovements.kind} = 'count' and ${stockMovements.qtyChange} < 0), 0)::int`,
      })
      .from(stockMovements)
      .where(and(eq(stockMovements.menuItemId, menuItemId), gte(stockMovements.createdAt, weekAgo))),
  ]);
  return {
    movements: movements.map((m) => ({
      id: m.id, kind: m.kind, qtyChange: m.qtyChange, qtyAfter: m.qtyAfter, expectedQty: m.expectedQty,
      note: m.note, createdAt: m.createdAt, tableLabel: m.order?.tab?.table?.label ?? null,
    })),
    week: week[0] ?? { sold: 0, delivered: 0, missing: 0 },
  };
}
