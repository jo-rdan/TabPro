import { db } from '../lib/db';
import { orders, orderItems, tabs, menuItems, staffPoints, tableAssignments } from '../models/schema';
import { eq, and } from 'drizzle-orm';
import { broadcastToVenue } from '../lib/websocket';
import { notifyTable, notifyGuest } from './push.service';
import { offerForTab } from './campaign.service';
import { takeStockForOrder, sendStockAlerts } from './stock.service';
import { categoriesOf } from './kitchen.service';
import { planStatus, venueAllows } from './plan.service';

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
  // The venue's package went unpaid 10+ days: guests order through the waiter.
  if (source === 'customer' && planStatus(tab.table.venue).orderingPaused) {
    throw new Error('Ordering from your phone is paused here. Please call your waiter.');
  }

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

  // Bar+ venues: an order with food also becomes a ticket on the kitchen screen.
  let kitchenStatus: 'new' | null = null;
  if (venueAllows(tab.table.venue, 'kitchen')) {
    const { kitchen } = await categoriesOf(tab.table.venueId);
    if (menuItemRecords.some((m) => kitchen.includes(m!.category))) kitchenStatus = 'new';
  }

  // Create the order and take tracked items off the stock in one go: if there
  // aren't enough bottles left, nothing is saved and the guest is told.
  const { order, createdItems, stockAlerts } = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({ tabId, source, status: 'pending', kitchenStatus })
      .returning();

    const stockAlerts = await takeStockForOrder(
      tx,
      tab.table.venueId,
      order.id,
      items.map((item, i) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        name: menuItemRecords[i]!.name,
        stockTracked: menuItemRecords[i]!.stockTracked,
      })),
    );

    const createdItems = await tx
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
    return { order, createdItems, stockAlerts };
  });
  await sendStockAlerts(tab.table.venueId, stockAlerts);

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
    kitchen: kitchenStatus,
    placedAt: order.placedAt,
    items: items.map((item, i) => ({
      menuItemId: item.menuItemId,
      name: menuItemRecords[i]!.name,
      quantity: item.quantity,
      unitPriceRwf: menuItemRecords[i]!.priceRwf,
    })),
    total,
    // A campaign guest's offer, so the waiter knows (e.g. "Free shot").
    offer: tab.campaignId ? (await offerForTab(tabId))?.text ?? null : null,
  };

  // Broadcast to all venue connections (waiter + owner)
  broadcastToVenue(tab.table.venueId, {
    type: 'new_order',
    payload: orderPayload,
    venueId: tab.table.venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });

  // Push notification to the table's waiter and the owner
  const itemSummary = items.map((item, i) => `${menuItemRecords[i]!.name} ×${item.quantity}`).join(', ');
  const message = { title: `New order — ${tab.table.label}`, body: itemSummary };
  await notifyTable(tab.table.venueId, tab.tableId, tab.staffId, message, message);

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
    await notifyGuest(
      updated.tabId,
      status === 'preparing'
        ? { title: '👨‍🍳 Your order is being prepared', body: `${tab.table.label}: it's on its way soon.` }
        : { title: '🍽️ Your order has been served', body: 'Enjoy! Need anything else? Order from your phone.' },
    );

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

  // Filter to this venue's tables only, with any campaign offer for the waiter.
  const mine = openTabs.filter((tab) => tab.table.venueId === venueId);
  return Promise.all(mine.map(async (tab) => ({ ...tab, offer: tab.campaignId ? (await offerForTab(tab.id))?.text ?? null : null })));
}
