import { db } from '../lib/db';
import { orders, orderItems, tabs, menuItems, staffPoints, tableAssignments } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { broadcastToVenue } from '../lib/websocket';
import { sendPushToVenue } from './push.service';

interface OrderItemInput {
  menuItemId: string;
  quantity: number;
}

export async function placeOrder(
  tabId: string,
  items: OrderItemInput[],
  source: 'customer' | 'staff' = 'customer'
) {
  // Validate tab is open
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: { table: { with: { venue: true } } },
  });

  if (!tab) throw new Error('Tab not found');
  if (tab.status !== 'open') throw new Error('Tab is not open');

  // Fetch menu items to get current prices
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItemRecords = await Promise.all(
    menuItemIds.map((id) =>
      db.query.menuItems.findFirst({ where: eq(menuItems.id, id) })
    )
  );

  // Validate all menu items exist and belong to the venue
  for (const item of menuItemRecords) {
    if (!item) throw new Error('Menu item not found');
    if (item.venueId !== tab.table.venueId) throw new Error('Menu item does not belong to this venue');
    if (!item.isAvailable) throw new Error(`"${item.name}" is not available`);
  }

  // Create order
  const [order] = await db
    .insert(orders)
    .values({ tabId, source, status: 'pending' })
    .returning();

  // Create order items
  const createdItems = await db
    .insert(orderItems)
    .values(
      items.map((item, i) => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPriceRwf: menuItemRecords[i]!.priceRwf,
      }))
    )
    .returning();

  // Calculate total for this order
  const total = createdItems.reduce(
    (sum, item) => sum + item.unitPriceRwf * item.quantity,
    0
  );

  // Build full order payload for WebSocket broadcast
  const orderPayload = {
    orderId: order.id,
    tabId,
    tableId: tab.tableId,
    tableLabel: tab.table.label,
    venueId: tab.table.venueId,
    source,
    status: 'pending',
    placedAt: order.placedAt,
    items: items.map((item, i) => ({
      menuItemId: item.menuItemId,
      name: menuItemRecords[i]!.name,
      quantity: item.quantity,
      unitPriceRwf: menuItemRecords[i]!.priceRwf,
    })),
    total,
  };

  // Broadcast to all venue connections (waiter + owner)
  broadcastToVenue(tab.table.venueId, {
    type: 'new_order',
    payload: orderPayload,
    venueId: tab.table.venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });

  // Push notification to waiter
  const itemSummary = items.map((item, i) => `${menuItemRecords[i]!.name} ×${item.quantity}`).join(', ');
  await sendPushToVenue(
    tab.table.venueId,
    `New order — ${tab.table.label}`,
    itemSummary
  );

  return { order, items: createdItems, total, orderPayload };
}

export async function updateOrderStatus(
  orderId: string,
  status: 'preparing' | 'delivered'
) {
  const [updated] = await db
    .update(orders)
    .set({ status })
    .where(eq(orders.id, orderId))
    .returning();

  if (!updated) throw new Error('Order not found');

  // Get tab and venue for broadcast
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, updated.tabId),
    with: { table: true },
  });

  if (tab) {
    broadcastToVenue(tab.table.venueId, {
      type: 'order_status_update',
      payload: { orderId, status, tabId: updated.tabId, tableId: tab.tableId },
      venueId: tab.table.venueId,
      tableId: tab.tableId,
      timestamp: new Date().toISOString(),
    });

    // Resolve staffId: use tab's staffId, or fall back to today's table assignment
    let resolvedStaffId = tab.staffId ?? null;
    if (!resolvedStaffId) {
      const today = new Date().toISOString().split('T')[0];
      const assignment = await db.query.tableAssignments.findFirst({
        where: and(
          eq(tableAssignments.tableId, tab.tableId),
          eq(tableAssignments.shiftDate, today)
        ),
      });
      resolvedStaffId = assignment?.staffId ?? null;
    }

    // Delivery-time bonus: +3 pts if delivered within 5 minutes of order creation
    if (status === 'delivered' && resolvedStaffId) {
      const minutesSinceOrder =
        (Date.now() - new Date(updated.placedAt).getTime()) / 60_000;
      if (minutesSinceOrder <= 5) {
        await db.insert(staffPoints).values({
          staffId: resolvedStaffId,
          points: 3,
          reason: `Fast delivery bonus (${Math.round(minutesSinceOrder)}m)`,
        });
      }
    }
  }

  return updated;
}

export async function getOrdersForVenue(venueId: string) {
  // Get all open tabs for this venue, with their orders
  const openTabs = await db.query.tabs.findMany({
    where: eq(tabs.status, 'open'),
    with: {
      table: true,
      orders: {
        with: {
          items: { with: { menuItem: true } },
        },
      },
    },
  });

  // Filter to this venue's tables only
  return openTabs.filter((tab) => tab.table.venueId === venueId);
}
