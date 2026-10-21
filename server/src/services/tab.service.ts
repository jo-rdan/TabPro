import { db } from '../lib/db';
import { tabs, tableAssignments, orders, orderItems, staffPoints, tables, venues, staff, customers } from '../models/schema';
import { eq, and, like, inArray } from 'drizzle-orm';
import { getTableByQrCode } from './qr.service';
import { planAllows } from '@tabpro/shared';
import { findOrCreateCustomer } from './customer.service';
import { getMenuForVenue } from './menu.service';
import { broadcastToVenue } from '../lib/websocket';
import { notifyTable, sendPushToOwner } from './push.service';
import { attributeVisit, offerForTab } from './campaign.service';
import { onGuestSeated } from './booking.service';
import { isPawapayConfigured } from '../lib/pawapay';
import { skuziCut, skuziNetRwf, walletBalance } from './wallet.service';

// What customers may see about a venue — never the payout number, clock-in
// sticker code or PIN hash.
function publicVenue(venue: typeof venues.$inferSelect) {
  return {
    id: venue.id,
    name: venue.name,
    logoUrl: venue.logoUrl,
    isDemo: venue.isDemo,
    // Guests pay the venue's own MoMo Pay code (Pro and Bar+); Skuzi never holds
    // the money. The demo venue shows a pretend code.
    momoPayCode: planAllows(venue.plan, 'momo') ? venue.momoPayCode ?? (venue.isDemo ? '000000' : null) : null,
    acceptsMobileMoney: planAllows(venue.plan, 'momo') && (venue.isDemo || !!venue.momoPayCode),
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

// The guest sees their waiter's first name ("Eric is your waiter"), nothing else.
async function waiterFor(staffId: string | null) {
  if (!staffId) return null;
  const member = await db.query.staff.findFirst({ where: eq(staff.id, staffId) });
  return member ? { name: member.name.split(' ')[0] } : null;
}

// Tells the venue's screens that guests just sat down and opened a tab.
function announceTabOpened(venueId: string, tab: { id: string; tableId: string; staffId: string | null }, tableLabel: string) {
  broadcastToVenue(venueId, {
    type: 'tab_opened',
    payload: { tabId: tab.id, tableId: tab.tableId, tableLabel },
    venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });
  // The waiter can greet them before they even order; the owner sees the room filling up.
  notifyTable(
    venueId,
    tab.tableId,
    tab.staffId,
    { title: `🪑 ${tableLabel}: new guests seated`, body: 'Go say hello. They can order from their phone.' },
    { title: `🪑 ${tableLabel}: new guests seated`, body: 'Their waiter has been told.' },
  )
    .catch((err) => console.error('[push] seated', err));
}

// Guests just sat down: did a campaign bring them, and is it a booking?
// Never blocks opening the tab.
async function afterNewTab(venueId: string, tableId: string, tableLabel: string, customerId: string, tabId: string) {
  await attributeVisit(venueId, customerId, tabId).catch((err) => console.error('[campaign] attribution', err.message));
  await onGuestSeated(venueId, tableId, customerId, tableLabel).catch((err) => console.error('[booking] seated', err.message));
}

export async function openTab(qrCode: string, phone: string, name?: string) {
  const table = await getTableByQrCode(qrCode);
  if (!table) throw new Error("This table isn't set up in Skuzi yet. Please ask a waiter.");
  if (!table.venue) throw new Error('Venue not found');

  const existingTab = await findUnsettledTab(table.id);

  const customer = await findOrCreateCustomer(phone, name);

  if (existingTab) {
    // A friend joining the table may be the one the campaign brought.
    if (!existingTab.campaignId) {
      await attributeVisit(table.venue.id, customer.id, existingTab.id).catch(() => {});
    }
    const { grouped } = await getMenuForVenue(table.venue.id);
    return {
      tab: existingTab,
      isExisting: true,
      offer: await offerForTab(existingTab.id),
      venue: publicVenue(table.venue),
      table: { id: table.id, label: table.label },
      waiter: await waiterFor(existingTab.staffId),
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

  announceTabOpened(table.venue.id, tab, table.label);
  await afterNewTab(table.venue.id, table.id, table.label, customer.id, tab.id);
  const { grouped } = await getMenuForVenue(table.venue.id);

  return {
    tab,
    isExisting: false,
    offer: await offerForTab(tab.id),
    venue: publicVenue(table.venue),
    table: { id: table.id, label: table.label },
    waiter: await waiterFor(tab.staffId),
    customer,
    menuGrouped: grouped,
  };
}

// Used by waiter for walk-in customers without smartphones
/**
 * What a guest sees right after scanning, before giving their number: the
 * venue, the table, its waiter and the menu. Opens nothing; the tab opens
 * when they send their first order.
 */
export async function previewTable(qrCode: string) {
  const table = await getTableByQrCode(qrCode);
  if (!table || !table.venue) return null;
  const [assignment, existingTab, { grouped }] = await Promise.all([
    db.query.tableAssignments.findFirst({ where: eq(tableAssignments.tableId, table.id) }),
    findUnsettledTab(table.id),
    getMenuForVenue(table.venue.id),
  ]);
  return {
    venue: publicVenue(table.venue),
    table: { id: table.id, label: table.label },
    waiter: await waiterFor(existingTab?.staffId ?? assignment?.staffId ?? null),
    menuGrouped: grouped,
  };
}

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
    return { tab: existingTab, isExisting: true, venue: publicVenue(table.venue), table: { id: table.id, label: table.label }, waiter: await waiterFor(existingTab.staffId) };
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

  announceTabOpened(table.venue.id, tab, table.label);

  await afterNewTab(table.venue.id, table.id, table.label, customer.id, tab.id);

  return { tab, isExisting: false, venue: publicVenue(table.venue), table: { id: table.id, label: table.label }, waiter: await waiterFor(tab.staffId) };
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

  await notifyTable(
    tab.table.venueId,
    tab.tableId,
    tab.staffId,
    { title: `👋 ${tab.table.label} needs you`, body: 'A guest would love a hand 👋' },
    { title: `👋 ${tab.table.label} called a waiter`, body: 'Their waiter has been notified' },
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

// Skuzi! before the guest has ordered: there's no tab yet, so alert the
// table's waiter straight from the sticker. Once a tab is open it goes through
// nudgeWaiter like any other call. One call per table every 30 seconds, so a
// photo of a sticker can't be used to spam the staff.
const lastTableNudge = new Map<string, number>();
const TABLE_NUDGE_GAP_MS = 30_000;

export async function nudgeTable(qrCode: string) {
  const table = await getTableByQrCode(qrCode);
  if (!table || !table.venue) throw new Error('Table not found');
  const openTab = await findUnsettledTab(table.id);
  if (openTab && openTab.status === 'open') return nudgeWaiter(openTab.id);

  const last = lastTableNudge.get(table.id) ?? 0;
  if (Date.now() - last < TABLE_NUDGE_GAP_MS) return { tabId: null, tableLabel: table.label };
  lastTableNudge.set(table.id, Date.now());

  broadcastToVenue(table.venue.id, {
    type: 'new_nudge',
    payload: { tabId: null, tableId: table.id, tableLabel: table.label },
    venueId: table.venue.id,
    tableId: table.id,
    timestamp: new Date().toISOString(),
  });
  const assignment = await db.query.tableAssignments.findFirst({ where: eq(tableAssignments.tableId, table.id) });
  await notifyTable(
    table.venue.id,
    table.id,
    assignment?.staffId ?? null,
    { title: `👋 ${table.label} needs you`, body: 'A guest would love a hand 👋' },
    { title: `👋 ${table.label} called a waiter`, body: 'Their waiter has been notified' },
  );
  return { tabId: null, tableLabel: table.label };
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

  // Waiter: action-oriented, they need to move fast. Owner: calm, informative.
  await notifyTable(
    tab.table.venueId,
    tab.tableId,
    tab.staffId,
    { title: `💳 ${tab.table.label} is ready to pay`, body: 'Head over — the customer wants to settle up' },
    { title: `💰 ${tab.table.label} payment incoming`, body: 'A customer is about to pay their tab' },
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

  // A campaign guest's offer: 10% off applies when they pay with Skuzi.
  const offer = tab.campaignId ? await offerForTab(tabId) : null;
  const skuziDiscountRwf = offer?.offerType === 'discount_10' ? Math.round(grandTotal * 0.1) : 0;
  const payWithSkuziTotal = grandTotal - skuziDiscountRwf;

  // The guest's Skuzi money (from a creator's welcome): it can cover up to what
  // Skuzi keeps on this bill after pawaPay's costs. The payment works out the
  // final amount by the number that actually pays.
  let walletRwf = 0;
  if (!tab.table.venue.isDemo && tab.customerId && payWithSkuziTotal > 0) {
    const customer = await db.query.customers.findFirst({ where: eq(customers.id, tab.customerId) });
    if (customer) walletRwf = Math.min(await walletBalance(customer.phone), skuziNetRwf(payWithSkuziTotal, Math.round(payWithSkuziTotal * skuziCut(tab.campaignId))));
  }

  return {
    tabId,
    status: tab.status,
    tableLabel: tab.table.label,
    venueName: tab.table.venue.name,
    lineItems,
    grandTotal,
    offer,
    skuziDiscountRwf,
    payWithSkuziTotal,
    walletRwf,
    openedAt: tab.openedAt,
  };
}

// paidByMomo: closed because the guest paid in the app (that alert is sent by the payment code).
// The guest says they paid the venue's MoMo Pay code. Skuzi can't see that
// payment (it goes straight to the venue), so the waiter checks their MoMo and
// taps "Paid": we tell them now, with the amount.
export async function claimPaidByMomo(tabId: string) {
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId), with: { table: { with: { venue: true } } } });
  if (!tab) throw new Error('Tab not found');
  if (tab.status === 'closed') return { alreadyClosed: true };
  await db.update(tabs).set({ paidClaimAt: new Date() }).where(eq(tabs.id, tabId));
  const bill = await getTabBill(tabId).catch(() => null);
  const total = bill?.grandTotal ?? 0;
  broadcastToVenue(tab.table.venueId, {
    type: 'payment_claimed',
    payload: { tabId, tableId: tab.tableId, tableLabel: tab.table.label, total },
    venueId: tab.table.venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });
  const msg = {
    title: `💰 ${tab.table.label} paid by MoMo`,
    body: `${total.toLocaleString('en-US')} RWF to your MoMo Pay. Check your MoMo, then tap Paid.`,
  };
  await notifyTable(tab.table.venueId, tab.tableId, tab.staffId, msg, msg);
  return { alreadyClosed: false };
}

export async function closeTab(tabId: string, { paidByMomo = false, paidWith }: { paidByMomo?: boolean; paidWith?: "cash" | "momo" } = {}) {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: { table: { with: { venue: true } } },
  });

  if (!tab) throw new Error('Tab not found');
  if (tab.status === 'closed') throw new Error('Tab is already closed');

  const [updated] = await db
    .update(tabs)
    .set({ status: 'closed', closedAt: new Date(), ...(paidWith ? { paidWith } : {}) })
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

  if (!paidByMomo) {
    // Owners want to know every franc: a bill closed by staff was paid outside the app.
    const bill = await getTabBill(tabId).catch(() => null);
    const total = bill?.grandTotal ?? 0;
    await sendPushToOwner(
      tab.table.venueId,
      `🧾 ${tab.table.label} closed${total ? ` · ${total.toLocaleString('en-US')} RWF` : ''}`,
      paidWith === 'momo' ? 'Paid by MoMo, straight to your MoMo Pay' : paidWith === 'cash' ? 'Paid in cash' : 'Closed by staff (paid in cash or outside Skuzi)',
    );
  }

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

