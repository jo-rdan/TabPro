import { db } from '../lib/db';
import { tabs, tables, venues, staff } from '../models/schema';
import { and, eq, inArray, isNotNull, isNull, lte, gte } from 'drizzle-orm';
import { broadcastToVenue } from '../lib/websocket';
import { notifyMomoConfirmers, notifyStaffMember, notifyTable, sendPushToOwner } from './push.service';
import { nightStart } from './tonight.service';
import { startPolling } from '../lib/activity';
import { HttpError } from '../middleware/error.middleware';

// MoMo to confirm. The guest pays the venue's own MoMo Pay code, which Skuzi
// can't see, so the person who receives the money confirms it: the owner,
// managers or cashiers (the owner picks, venues.momoConfirmers), never waiters.
// "Not yet" tells the table's waiter to keep an eye and reminds whoever tapped
// it every minute, 3 times; then the bill turns red for the owner and waiter.

export const MOMO_ROLES = ['owner', 'manager', 'cashier'] as const;
export type MomoRole = (typeof MOMO_ROLES)[number];
const REMIND_EVERY_MS = 60_000;
export const MAX_REMINDERS = 3;

const UNSETTLED = ['open', 'bill_requested', 'abandoned'] as const;

export type Actor = { ownerId?: string; staffId?: string };

const billTotal = (t: { orders: { isNudge: boolean | null; items: { unitPriceRwf: number; quantity: number }[] }[] }) =>
  t.orders.filter((o) => !o.isNudge).reduce((n, o) => n + o.items.reduce((s, i) => s + i.unitPriceRwf * i.quantity, 0), 0);

const rwf = (n: number) => n.toLocaleString('en-US');

function changed(venueId: string, tabId: string, tableId: string, state: string) {
  broadcastToVenue(venueId, {
    type: 'momo_check',
    payload: { tabId, tableId, state },
    venueId,
    tableId,
    timestamp: new Date().toISOString(),
  });
}

/** Who this person is when it comes to MoMo: "owner", "manager", "cashier" or null. */
export async function momoRoleOf(venueId: string, actor: Actor): Promise<MomoRole | 'waiter' | 'kitchen' | null> {
  if (actor.ownerId) {
    const v = await db.query.venues.findFirst({ where: eq(venues.id, venueId), columns: { ownerId: true } });
    return v?.ownerId === actor.ownerId ? 'owner' : null;
  }
  if (actor.staffId) {
    const m = await db.query.staff.findFirst({ where: eq(staff.id, actor.staffId), columns: { role: true, venueId: true, isActive: true } });
    return m && m.isActive && m.venueId === venueId ? m.role : null;
  }
  return null;
}

/** The owner can always confirm; managers and cashiers when the owner ticked them. */
export async function canConfirmMomo(venueId: string, actor: Actor) {
  const role = await momoRoleOf(venueId, actor);
  if (role === 'owner') return true;
  if (role !== 'manager' && role !== 'cashier') return false;
  const v = await db.query.venues.findFirst({ where: eq(venues.id, venueId), columns: { momoConfirmers: true } });
  return (v?.momoConfirmers ?? []).includes(role);
}

export async function assertCanConfirmMomo(venueId: string, actor: Actor) {
  if (!(await canConfirmMomo(venueId, actor))) {
    throw new HttpError(403, 'Only the people the owner picked can confirm MoMo payments');
  }
}

/** The guest opened MoMo or said they paid: the bill now waits for a Received. */
export async function startMomoCheck(tabId: string) {
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId), with: { table: true } });
  if (!tab || tab.status === 'closed') return;
  if (!tab.momoCheckAt) await db.update(tabs).set({ momoCheckAt: new Date() }).where(eq(tabs.id, tabId));
  changed(tab.table.venueId, tabId, tab.tableId, 'waiting');
}

export async function listMomoToConfirm(venueId: string) {
  const venueTables = await db.query.tables.findMany({ where: eq(tables.venueId, venueId), columns: { id: true } });
  if (venueTables.length === 0) return [];
  const rows = await db.query.tabs.findMany({
    where: and(
      inArray(tabs.status, [...UNSETTLED]),
      isNotNull(tabs.momoCheckAt),
      inArray(tabs.tableId, venueTables.map((t) => t.id)),
    ),
    with: { table: true, customer: true, staff: true, orders: { with: { items: true } } },
  });
  return rows
    .map((t) => ({
      tabId: t.id,
      tableLabel: t.table.label,
      totalRwf: billTotal(t),
      since: t.momoCheckAt!,
      guestSaysPaid: !!t.paidClaimAt,
      reminders: t.momoReminders,
      waiting: !!t.momoRemindAt,
      failed: !!t.momoFailedAt,
      waiterName: t.staff?.name ?? null,
      // Only once it's red: the owner may need to call.
      guestPhone: t.momoFailedAt ? t.customer?.phone ?? null : null,
    }))
    .sort((a, b) => Number(b.failed) - Number(a.failed) || a.since.getTime() - b.since.getTime());
}

/** MoMo bills confirmed since 06:00 tonight (the cashier's "Confirmed tonight"). */
export async function momoConfirmedTonight(venueId: string) {
  const venueTables = await db.query.tables.findMany({ where: eq(tables.venueId, venueId), columns: { id: true } });
  if (venueTables.length === 0) return { bills: 0, totalRwf: 0 };
  const rows = await db.query.tabs.findMany({
    where: and(
      eq(tabs.status, 'closed'),
      eq(tabs.paidWith, 'momo'),
      gte(tabs.closedAt, nightStart()),
      inArray(tabs.tableId, venueTables.map((t) => t.id)),
    ),
    with: { orders: { with: { items: true } } },
  });
  return { bills: rows.length, totalRwf: rows.reduce((n, t) => n + billTotal(t), 0) };
}

/** "Not yet": the waiter keeps an eye; whoever tapped gets a reminder every minute. */
export async function momoNotYet(tabId: string, actor: Actor) {
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId), with: { table: true, orders: { with: { items: true } } } });
  if (!tab) throw new Error('Tab not found');
  if (tab.status === 'closed') return { closed: true };
  if (tab.momoFailedAt) return { failed: true };
  const remindTo = actor.ownerId ? 'owner' : actor.staffId!;
  const first = !tab.momoRemindAt;
  await db
    .update(tabs)
    .set({
      momoCheckAt: tab.momoCheckAt ?? new Date(),
      momoRemindTo: remindTo,
      // Tapping again doesn't restart the count: still 3 reminders in all.
      ...(first ? { momoRemindAt: new Date(Date.now() + REMIND_EVERY_MS) } : {}),
    })
    .where(eq(tabs.id, tabId));
  if (first) {
    const total = billTotal(tab);
    await notifyTable(
      tab.table.venueId,
      tab.tableId,
      tab.staffId,
      { title: `👀 Keep an eye on ${tab.table.label}`, body: `They're paying ${rwf(total)} RWF by MoMo, but it hasn't arrived yet. Don't let them leave before it's confirmed.` },
      null,
    );
    broadcastToVenue(tab.table.venueId, {
      type: 'momo_watch',
      payload: { tabId, tableId: tab.tableId, tableLabel: tab.table.label, total },
      venueId: tab.table.venueId,
      tableId: tab.tableId,
      timestamp: new Date().toISOString(),
    });
  }
  changed(tab.table.venueId, tabId, tab.tableId, 'waiting');
  return { reminders: tab.momoReminders };
}

async function remind(to: string, venueId: string, message: { title: string; body: string }) {
  if (to === 'owner') await sendPushToOwner(venueId, message.title, message.body);
  else await notifyStaffMember(venueId, to, message);
}

/** Due reminders: 3 a minute apart, then red. Runs every 15 seconds while Skuzi is in use. */
export async function sendMomoReminders(now = new Date()) {
  const due = await db.query.tabs.findMany({
    where: and(lte(tabs.momoRemindAt, now), isNull(tabs.momoFailedAt), inArray(tabs.status, [...UNSETTLED])),
    with: { table: true, staff: true, orders: { with: { items: true } } },
  });
  for (const tab of due) {
    const venueId = tab.table.venueId;
    const total = billTotal(tab);
    if (tab.momoReminders < MAX_REMINDERS) {
      const n = tab.momoReminders + 1;
      await db
        .update(tabs)
        .set({ momoReminders: n, momoRemindAt: new Date(now.getTime() + REMIND_EVERY_MS) })
        .where(eq(tabs.id, tab.id));
      await remind(tab.momoRemindTo ?? 'owner', venueId, {
        title: `⏱ ${tab.table.label} · ${rwf(total)} · arrived yet?`,
        body: `Reminder ${n} of ${MAX_REMINDERS}. Check your MoMo.`,
      });
      changed(venueId, tab.id, tab.tableId, 'waiting');
      continue;
    }
    // Asked 3 times, still nothing: red for the owner (and the confirmers) and the waiter.
    await db.update(tabs).set({ momoFailedAt: now, momoRemindAt: null }).where(eq(tabs.id, tab.id));
    const waiter = tab.staff?.name ? ` · ${tab.staff.name}'s table` : '';
    await notifyMomoConfirmers(venueId, {
      title: `⚠️ ${tab.table.label}: MoMo didn't arrive`,
      body: `${rwf(total)} RWF, asked ${MAX_REMINDERS} times${waiter}. Open Skuzi to call the guest.`,
    });
    await notifyTable(venueId, tab.tableId, tab.staffId, {
      title: `⚠️ ${tab.table.label}: MoMo didn't arrive`,
      body: `${rwf(total)} RWF never reached the MoMo Pay. Go to the table.`,
    }, null);
    broadcastToVenue(venueId, {
      type: 'momo_failed',
      payload: { tabId: tab.id, tableId: tab.tableId, tableLabel: tab.table.label, total },
      venueId,
      tableId: tab.tableId,
      timestamp: now.toISOString(),
    });
    changed(venueId, tab.id, tab.tableId, 'failed');
  }
}

/** The bill closed (Received, cash, anything): no more reminders for it. */
export async function endMomoCheck(tabId: string) {
  await db.update(tabs).set({ momoRemindAt: null }).where(eq(tabs.id, tabId));
}

export function startMomoReminders() {
  startPolling('momo', 15_000, () => sendMomoReminders());
}

export async function setMomoConfirmers(venueId: string, roles: string[]) {
  const clean = MOMO_ROLES.filter((r) => roles.includes(r));
  if (clean.length === 0) throw new Error('Keep at least one person who confirms MoMo');
  await db.update(venues).set({ momoConfirmers: clean }).where(eq(venues.id, venueId));
  return clean;
}
