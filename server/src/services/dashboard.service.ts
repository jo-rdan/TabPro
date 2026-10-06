import { db } from '../lib/db';
import { tabs, orders, orderItems, tables, ratings, staff, staffPoints, momoPayments } from '../models/schema';
import { eq, and, gte, lt, sql, desc, inArray } from 'drizzle-orm';
import { nightStart, nightStartOf } from './tonight.service';

// "Tonight" for a bar runs 06:00 to 06:00 Kigali time, so a 01:00 payment
// still counts for the evening it belongs to.
function startOfToday() {
  return nightStart();
}

export async function getDashboardStats(venueId: string) {
  const today = startOfToday();

  // All tables for this venue
  const venueTables = await db.query.tables.findMany({
    where: eq(tables.venueId, venueId),
  });
  const tableIds = venueTables.map((t) => t.id);

  if (tableIds.length === 0) {
    return { revenueTonight: 0, activeTables: 0, pendingOrders: 0, avgRatingToday: null };
  }

  // Tonight's revenue — sum of order items on closed tabs today
  const closedTabsToday = await db.query.tabs.findMany({
    where: and(eq(tabs.status, 'closed'), gte(tabs.closedAt, today)),
    with: { orders: { with: { items: true } }, table: true },
  });

  const revenueTonight = closedTabsToday
    .filter((t) => tableIds.includes(t.tableId))
    .flatMap((t) => t.orders)
    .flatMap((o) => o.items)
    .reduce((sum, item) => sum + item.unitPriceRwf * item.quantity, 0);

  // Active tables — open or bill_requested tabs
  const activeTabs = await db.query.tabs.findMany({
    where: and(
      sql`status IN ('open', 'bill_requested')`
    ),
    with: { table: true },
  });
  const activeTables = activeTabs.filter((t) => tableIds.includes(t.tableId)).length;

  // Pending orders
  const openTabs = await db.query.tabs.findMany({
    where: eq(tabs.status, 'open'),
    with: { orders: true, table: true },
  });
  const pendingOrders = openTabs
    .filter((t) => tableIds.includes(t.tableId))
    .flatMap((t) => t.orders)
    .filter((o) => o.status === 'pending').length;

  // Avg rating today
  const todayRatings = await db.query.ratings.findMany({
    where: and(eq(ratings.venueId, venueId), gte(ratings.createdAt, today)),
  });
  const avgRatingToday = todayRatings.length > 0
    ? Math.round((todayRatings.reduce((s, r) => s + r.overallScore, 0) / todayRatings.length) * 10) / 10
    : null;

  return { revenueTonight, activeTables, pendingOrders, avgRatingToday, ratingCount: todayRatings.length };
}

// One night of bills (tonight by default, or any past night as "YYYY-MM-DD"),
// each with how it was paid and whether the owner's payout arrived.
export async function getActivityLog(venueId: string, limit = 100, night?: string) {
  const venueTables = await db.query.tables.findMany({
    where: eq(tables.venueId, venueId),
  });
  const tableIds = venueTables.map((t) => t.id);
  const start = night ? nightStartOf(night) : startOfToday();
  const end = new Date(start.getTime() + 24 * 60 * 60_000);

  const allTabs = await db.query.tabs.findMany({
    where: and(gte(tabs.openedAt, start), lt(tabs.openedAt, end)),
    with: {
      table: true,
      orders: {
        with: { items: { with: { menuItem: true } } },
        orderBy: [desc(orders.placedAt)],
      },
    },
    orderBy: [desc(tabs.openedAt)],
  });

  const venueTabs = allTabs.filter((t) => tableIds.includes(t.tableId));
  const payments = venueTabs.length
    ? await db.query.momoPayments.findMany({
        where: and(inArray(momoPayments.tabId, venueTabs.map((t) => t.id)), eq(momoPayments.type, 'tab'), eq(momoPayments.status, 'successful')),
      })
    : [];
  const paymentByTab = new Map(payments.map((p) => [p.tabId, p]));

  return venueTabs
    .map((tab) => ({
      payment: (() => {
        const p = paymentByTab.get(tab.id);
        if (p) {
          return {
            method: 'momo' as const,
            amountRwf: p.amountRwf,
            payoutRwf: p.venuePayoutRwf,
            // 'successful' = on the owner's MoMo; 'failed' is retried automatically
            payoutStatus: (p.disbursementStatus ?? 'pending') as 'pending' | 'successful' | 'failed',
            paidAt: p.resolvedAt ?? p.createdAt,
          };
        }
        return tab.status === 'closed' ? { method: 'other' as const } : null;
      })(),
      tabId: tab.id,
      tableLabel: tab.table.label,
      tabStatus: tab.status,
      openedAt: tab.openedAt,
      closedAt: tab.closedAt,
      orders: tab.orders.map((order) => ({
        orderId: order.id,
        source: order.source,
        status: order.status,
        placedAt: order.placedAt,
        items: order.items.map((i) => ({
          name: i.menuItem.name,
          quantity: i.quantity,
          unitPriceRwf: i.unitPriceRwf,
          subtotal: i.unitPriceRwf * i.quantity,
        })),
        total: order.items.reduce((s, i) => s + i.unitPriceRwf * i.quantity, 0),
      })),
      tabTotal: tab.orders
        .flatMap((o) => o.items)
        .reduce((s, i) => s + i.unitPriceRwf * i.quantity, 0),
    }));
}

export async function getEndOfNightReport(venueId: string) {
  const stats = await getDashboardStats(venueId);
  const activity = await getActivityLog(venueId);

  const closedTabs = activity.filter((t) => t.tabStatus === 'closed');
  const totalOrders = activity.flatMap((t) => t.orders).length;
  const customerOrders = activity.flatMap((t) => t.orders).filter((o) => o.source === 'customer').length;
  const staffOrders = activity.flatMap((t) => t.orders).filter((o) => o.source === 'staff').length;

  return {
    ...stats,
    closedTabs: closedTabs.length,
    totalOrders,
    customerOrders,
    staffOrders,
    activity,
  };
}
