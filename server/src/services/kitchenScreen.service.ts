import { db } from '../lib/db';
import { menuItems, orderItems, orders, stockMovements, tabs, tables } from '../models/schema';
import { and, asc, eq, gte, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import { broadcastToVenue } from '../lib/websocket';
import { notifyGuest, notifyTable } from './push.service';
import { categoriesOf } from './kitchen.service';

// The kitchen screen: food tickets for the chef. Drinks stay with the waiters.
// "Start" tells the guest it's being prepared; "Ready" tells the waiter to pick
// it up and the guest it's on its way; "Not available" takes an item off the
// order (and so off the bill), and tells the guest and the waiter.

/** Open food tickets, oldest first, plus ones marked ready in the last 15 minutes. */
export async function getTickets(venueId: string) {
  const { kitchen } = await categoriesOf(venueId);
  const recent = new Date(Date.now() - 15 * 60_000);
  const rows = await db
    .select({ order: orders, tableLabel: tables.label, tabStatus: tabs.status })
    .from(orders)
    .innerJoin(tabs, eq(tabs.id, orders.tabId))
    .innerJoin(tables, eq(tables.id, tabs.tableId))
    .where(and(
      eq(tables.venueId, venueId),
      isNotNull(orders.kitchenStatus),
      ne(tabs.status, 'closed'),
      or(inArray(orders.kitchenStatus, ['new', 'preparing']), and(eq(orders.kitchenStatus, 'ready'), gte(orders.kitchenReadyAt, recent))),
    ))
    .orderBy(asc(orders.placedAt));
  if (rows.length === 0) return [];
  const items = await db
    .select({ id: orderItems.id, orderId: orderItems.orderId, quantity: orderItems.quantity, name: menuItems.name, category: menuItems.category })
    .from(orderItems)
    .innerJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
    .where(inArray(orderItems.orderId, rows.map((r) => r.order.id)));
  return rows
    .map(({ order, tableLabel }) => ({
      orderId: order.id,
      tabId: order.tabId,
      tableLabel,
      status: order.kitchenStatus as 'new' | 'preparing' | 'ready',
      placedAt: order.placedAt,
      items: items.filter((i) => i.orderId === order.id && kitchen.includes(i.category)).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
    }))
    .filter((t) => t.items.length > 0);
}

async function orderWithTable(orderId: string) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { tab: { with: { table: true } } } });
  if (!order) throw new Error('Order not found');
  return order;
}

// Tells the kitchen screen to reload, and the waiters which order moved.
const changed = (venueId: string, payload: { orderId?: string; status?: 'preparing' | 'ready' } = {}) =>
  broadcastToVenue(venueId, { type: 'kitchen_update', payload, venueId, timestamp: new Date().toISOString() });

export async function startTicket(orderId: string) {
  const order = await orderWithTable(orderId);
  const venueId = order.tab.table.venueId;
  await db.update(orders)
    .set({ kitchenStatus: 'preparing', ...(order.status === 'pending' ? { status: 'preparing' as const } : {}) })
    .where(eq(orders.id, orderId));
  if (order.status === 'pending') {
    // Same event the waiter's "preparing" sends: the guest sees "Being prepared".
    broadcastToVenue(venueId, {
      type: 'order_status_update',
      payload: { orderId, tabId: order.tabId, status: 'preparing' },
      venueId,
      tableId: order.tab.tableId,
      timestamp: new Date().toISOString(),
    });
  }
  changed(venueId, { orderId, status: 'preparing' });
}

export async function readyTicket(orderId: string) {
  const order = await orderWithTable(orderId);
  const venueId = order.tab.table.venueId;
  const label = order.tab.table.label;
  await db.update(orders).set({ kitchenStatus: 'ready', kitchenReadyAt: new Date() }).where(eq(orders.id, orderId));
  const ticket = (await getTickets(venueId)).find((t) => t.orderId === orderId);
  const food = ticket?.items.map((i) => `${i.quantity} ${i.name}`).join(', ') || 'The food';
  broadcastToVenue(venueId, {
    type: 'food_ready',
    payload: { orderId, tabId: order.tabId, tableLabel: label, food },
    venueId,
    tableId: order.tab.tableId,
    timestamp: new Date().toISOString(),
  });
  changed(venueId, { orderId, status: 'ready' });
  await notifyTable(venueId, order.tab.tableId, order.tab.staffId, { title: `🍽️ ${label}: food is ready`, body: `${food}. Pick it up at the kitchen.` }, null);
  await notifyGuest(order.tabId, { title: 'Your food is ready 🍽️', body: 'Your waiter is bringing it to you.' }).catch(() => {});
}

/**
 * The kitchen can't make an item: take it off the order (so off the bill), put
 * any counted stock back, optionally sell it out for the night, and tell the
 * guest and the waiter.
 */
export async function itemUnavailable(orderItemId: string, { soldOut = false }: { soldOut?: boolean } = {}) {
  const line = await db.query.orderItems.findFirst({ where: eq(orderItems.id, orderItemId), with: { menuItem: true } });
  if (!line) throw new Error('Item not found');
  const order = await orderWithTable(line.orderId);
  const venueId = order.tab.table.venueId;
  const name = line.menuItem.name;
  await db.transaction(async (tx) => {
    await tx.delete(orderItems).where(eq(orderItems.id, orderItemId));
    if (line.menuItem.stockTracked) {
      const [row] = await tx.update(menuItems)
        .set({ stockQty: sql`coalesce(${menuItems.stockQty}, 0) + ${line.quantity}` })
        .where(eq(menuItems.id, line.menuItemId))
        .returning({ qty: menuItems.stockQty });
      await tx.insert(stockMovements).values({
        venueId, menuItemId: line.menuItemId, kind: 'sale', qtyChange: line.quantity, qtyAfter: row?.qty ?? 0, note: 'Taken off: not available',
      });
    }
    if (soldOut) await tx.update(menuItems).set({ isAvailable: false }).where(eq(menuItems.id, line.menuItemId));
    const left = await tx.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(eq(orderItems.orderId, line.orderId));
    if ((left[0]?.n ?? 0) === 0) await tx.delete(orders).where(eq(orders.id, line.orderId));
  });
  broadcastToVenue(venueId, {
    type: 'item_unavailable',
    payload: { tabId: order.tabId, orderId: line.orderId, orderItemId, name, quantity: line.quantity },
    venueId,
    tableId: order.tab.tableId,
    timestamp: new Date().toISOString(),
  });
  changed(venueId);
  const label = order.tab.table.label;
  await notifyTable(venueId, order.tab.tableId, order.tab.staffId, { title: `⚠️ ${label}: ${name} not available`, body: 'The kitchen took it off the bill. Maybe suggest something else.' }, null);
  await notifyGuest(order.tabId, { title: `Sorry, ${name} isn't available tonight`, body: "It's off your bill. Your waiter can suggest something else." }).catch(() => {});
}
