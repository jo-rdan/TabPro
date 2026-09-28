import { db } from '../lib/db';
import { tabs, tableAssignments, orders, orderItems, staffPoints, tables, venues } from '../models/schema';
import { eq, and, like, inArray } from 'drizzle-orm';
import { getTableByQrCode } from './qr.service';
import { findOrCreateCustomer } from './customer.service';
import { getMenuForVenue } from './menu.service';
import { broadcastToVenue } from '../lib/websocket';
import { sendPushToVenue, sendPushToStaff, sendPushToOwner } from './push.service';
import { trackReturnVisit } from './campaign.service';
import { isPawapayConfigured } from '../lib/pawapay';

// What customers may see about a venue — never the payout number, clock-in
// sticker code or PIN hash.
function publicVenue(venue: typeof venues.$inferSelect) {
  return {
    id: venue.id,
    name: venue.name,
    logoUrl: venue.logoUrl,
    acceptsMobileMoney: isPawapayConfigured() && !!venue.momoPhone,
  };
}

// The table's current unpaid tab, if any. Everyone who scans the table joins
// it (friends at the same table share one bill), and a customer who re-scans
// gets their tab back. 'abandoned' is a legacy status from when a locked phone
// froze the tab — revive those so the bill can still be collected.
async function findUnsettledTab(tableId: string) {
  const tab = await db.query.tabs.findFirst({
    where: and(eq(tabs.tableId, tableId), inArray(tabs.status, ['open', 'bill_requested', 'abandoned'])),
    with: { orders: { with: { items: { with: { menuItem: true } } } } },
  });
  if (tab?.status === 'abandoned') {
    await db.update(tabs).set({ status: 'open', lastSeenAt: new Date() }).where(eq(tabs.id, tab.id));
    tab.status = 'open';
  }
  return tab;
}

export async function openTab(qrCode: string, phone: string, name?: string) {
  const table = await getTableByQrCode(qrCode);
  if (!table) throw new Error('QR code not found or not linked to a table');
  if (!table.venue) throw new Error('Venue not found');

  const existingTab = await findUnsettledTab(table.id);

  const customer = await findOrCreateCustomer(phone, name);

  if (existingTab) {
    const { grouped } = await getMenuForVenue(table.venue.id);
    return {
      tab: existingTab,
      isExisting: true,
      venue: publicVenue(table.venue),
      table: { id: table.id, label: table.label },
      customer,
      menuGrouped: grouped,
    };
  }

  const assignment = await db.query.tableAssignments.findFirst({
    where: and(
      eq(tableAssignments.tableId, table.id),
      
    ),
  });

  const [tab] = await db
    .insert(tabs)
    .values({
      tableId: table.id,
      customerId: customer.id,
      staffId: assignment?.staffId ?? null,
      status: 'open',
    })
    .returning();

  const { grouped } = await getMenuForVenue(table.venue.id);

  return {
    tab,
    isExisting: false,
    venue: publicVenue(table.venue),
    table: { id: table.id, label: table.label },
    customer,
    menuGrouped: grouped,
  };
}

// Used by waiter for walk-in customers without smartphones
export async function openTabByTableId(tableId: string, phone?: string) {
  const table = await db.query.tables.findFirst({
    where: eq(tables.id, tableId),
    with: { venue: true },
  });
  if (!table) throw new Error('Table not found');
  if (!table.venue) throw new Error('Venue not found');

  // Re-use existing unsettled tab if there is one
  const existingTab = await findUnsettledTab(tableId);
  if (existingTab) {
    return { tab: existingTab, isExisting: true, venue: publicVenue(table.venue), table: { id: table.id, label: table.label } };
  }

  // Walk-in: use provided phone or a placeholder
  const guestPhone = phone?.trim() || `walkin-${tableId.slice(0, 8)}-${Date.now()}`;
  const customer = await findOrCreateCustomer(guestPhone);

  const assignment = await db.query.tableAssignments.findFirst({
    where: and(
      eq(tableAssignments.tableId, tableId),
      
    ),
  });

  const [tab] = await db
    .insert(tabs)
    .values({
      tableId,
      customerId: customer.id,
      staffId: assignment?.staffId ?? null,
      status: 'open',
    })
    .returning();

  // Track return visit for campaign analytics (fire-and-forget)
  trackReturnVisit(table.venue.id, customer.id).catch(() => {});

  return { tab, isExisting: false, venue: publicVenue(table.venue), table: { id: table.id, label: table.label } };
}

export async function getTab(tabId: string) {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: {
      orders: {
        with: { items: { with: { menuItem: true } } },
      },
      table: { with: { venue: true } },
    },
  });
  if (!tab) return tab;
  const { table, ...rest } = tab;
  return { ...rest, table: { id: table.id, label: table.label, venue: publicVenue(table.venue) } };
}


export async function getActiveTabForTable(tableId: string) {
  return db.query.tabs.findFirst({
    where: and(eq(tabs.tableId, tableId), eq(tabs.status, 'open')),
    with: { orders: { with: { items: { with: { menuItem: true } } } } },
  });
}

export async function nudgeWaiter(tabId: string) {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: { table: { with: { venue: true } } },
  });

  if (!tab) throw new Error('Tab not found');
  if (tab.status !== 'open') throw new Error('Tab is not open');

  broadcastToVenue(tab.table.venueId, {
    type: 'new_nudge',
    payload: {
      tabId,
      tableId: tab.tableId,
      tableLabel: tab.table.label,
    },
    venueId: tab.table.venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });

  await sendPushToVenue(
    tab.table.venueId,
    `👋 ${tab.table.label} needs you`,
    'A customer is nudging for attention'
  );

  // Deduct points from assigned waiter: −2 first nudge, −5 on repeat
  const resolvedStaffId = tab.staffId ?? (await db.query.tableAssignments.findFirst({
    where: eq(tableAssignments.tableId, tab.tableId),
  }))?.staffId ?? null;

  if (resolvedStaffId) {
    const prevNudges = await db.query.staffPoints.findMany({
      where: and(eq(staffPoints.staffId, resolvedStaffId), like(staffPoints.reason, `Nudge penalty [${tabId}]%`)),
    });
    const penalty = prevNudges.length === 0 ? -2 : -5;
    await db.insert(staffPoints).values({
      staffId: resolvedStaffId,
      points: penalty,
      reason: `Nudge penalty [${tabId}]`,
    });
  }

  return { tabId, tableLabel: tab.table.label };
}

export async function requestBill(tabId: string) {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: { table: { with: { venue: true } } },
  });

  if (!tab) throw new Error('Tab not found');
  if (tab.status !== 'open') throw new Error('Tab is not open');

  const [updated] = await db
    .update(tabs)
    .set({ status: 'bill_requested' })
    .where(eq(tabs.id, tabId))
    .returning();

  broadcastToVenue(tab.table.venueId, {
    type: 'bill_requested',
    payload: { tabId, tableId: tab.tableId, tableLabel: tab.table.label },
    venueId: tab.table.venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });

  // Waiter notification — action-oriented, they need to move fast
  await sendPushToStaff(
    tab.table.venueId,
    tab.tableId,
    `💳 ${tab.table.label} is ready to pay`,
    'Head over — the customer wants to settle up'
  );

  // Owner notification — financial awareness, calm and informative
  await sendPushToOwner(
    tab.table.venueId,
    `💰 ${tab.table.label} payment incoming`,
    'A customer is about to pay their tab'
  );

  return updated;
}

export async function getTabBill(tabId: string) {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: {
      orders: {
        with: { items: { with: { menuItem: true } } },
      },
      table: { with: { venue: true } },
    },
  });

  if (!tab) throw new Error('Tab not found');

  // Build itemized bill
  const lineItems: { name: string; quantity: number; unitPriceRwf: number; subtotal: number }[] = [];

  for (const order of tab.orders) {
    if (order.isNudge) continue;
    for (const item of order.items) {
      const existing = lineItems.find((l) => l.name === item.menuItem.name);
      if (existing) {
        existing.quantity += item.quantity;
        existing.subtotal += item.unitPriceRwf * item.quantity;
      } else {
        lineItems.push({
          name: item.menuItem.name,
          quantity: item.quantity,
          unitPriceRwf: item.unitPriceRwf,
          subtotal: item.unitPriceRwf * item.quantity,
        });
      }
    }
  }

  const grandTotal = lineItems.reduce((sum, l) => sum + l.subtotal, 0);

  return {
    tabId,
    status: tab.status,
    tableLabel: tab.table.label,
    venueName: tab.table.venue.name,
    lineItems,
    grandTotal,
    openedAt: tab.openedAt,
  };
}

export async function closeTab(tabId: string) {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: { table: { with: { venue: true } } },
  });

  if (!tab) throw new Error('Tab not found');
  if (tab.status === 'closed') throw new Error('Tab is already closed');

  const [updated] = await db
    .update(tabs)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(tabs.id, tabId))
    .returning();

  broadcastToVenue(tab.table.venueId, {
    type: 'tab_closed',
    payload: {
      tabId,
      tableId: tab.tableId,
      tableLabel: tab.table.label,
    },
    venueId: tab.table.venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });

  // Zero-nudge bonus: +5 pts if waiter had no nudge penalties on this tab
  const resolvedStaffId = tab.staffId ?? (await db.query.tableAssignments.findFirst({
    where: eq(tableAssignments.tableId, tab.tableId),
  }))?.staffId ?? null;

  if (resolvedStaffId) {
    const nudgePenalties = await db.query.staffPoints.findFirst({
      where: and(eq(staffPoints.staffId, resolvedStaffId), like(staffPoints.reason, `Nudge penalty [${tabId}]%`)),
    });
    if (!nudgePenalties) {
      await db.insert(staffPoints).values({
        staffId: resolvedStaffId,
        points: 5,
        reason: `Zero-nudge shift bonus`,
      });
    }
  }

  return updated;
}

