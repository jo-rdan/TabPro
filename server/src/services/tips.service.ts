import { db } from '../lib/db';
import { staff, staffPoints, tips, tabs, tableAssignments, ratings } from '../models/schema';
import { and, eq, gte, ne, sql } from 'drizzle-orm';
import { broadcastToVenue } from '../lib/websocket';
import { notifyTable } from './push.service';

// Waiters' points work FOR them: guests see a badge ("Top waiter this week")
// next to a Tip button that sends MoMo straight to the waiter. Points only go
// up; a guest tapping Skuzi! is counted for the owner but costs nothing.

const WEEK_MS = 7 * 24 * 3600e3;
const MIN_TIP = 100;
const MAX_TIP = 100_000;
const MAX_TIPS_PER_TAB = 3;
// A guest can still tip a while after the bill is closed (from the rating screen).
const TIP_AFTER_CLOSE_MS = 6 * 3600e3;

/** A Skuzi! call on a tab: recorded at 0 points (older ones were penalties). */
export const skuziCallReason = (tabId: string) => `Skuzi! call [${tabId}]`;
export const isSkuziCall = (reason: string) => reason.startsWith('Skuzi! call') || reason.startsWith('Nudge penalty');

/** Points a waiter earned: penalties from before 2026-10-21 no longer count. */
export const earnedPoints = (rows: { points: number }[]) => rows.reduce((sum, p) => sum + Math.max(0, p.points), 0);

/** 07XXXXXXXX, or throws. */
export function normaliseMomo(raw: unknown): string {
  const p = String(raw ?? '').replace(/\D/g, '').replace(/^250/, '0');
  if (!/^07[2389]\d{7}$/.test(p)) throw new Error('Enter a Rwandan MTN or Airtel number, e.g. 0788123456');
  return p;
}

/** This week, for each of the venue's floor staff: points, rank, tips, Skuzi! calls. */
export async function weeklyStanding(venueId: string) {
  const since = new Date(Date.now() - WEEK_MS);
  const [members, tipRows] = await Promise.all([
    db.query.staff.findMany({
      where: and(eq(staff.venueId, venueId), ne(staff.role, 'kitchen')),
      with: { points: { where: gte(staffPoints.createdAt, since) } },
    }),
    db
      .select({ staffId: tips.staffId, total: sql<number>`coalesce(sum(${tips.amountRwf}), 0)::int` })
      .from(tips)
      .where(and(eq(tips.venueId, venueId), gte(tips.createdAt, since)))
      .groupBy(tips.staffId),
  ]);
  const rows = members.map((m) => ({
    staffId: m.id,
    weekPoints: earnedPoints(m.points),
    fastWeek: m.points.filter((p) => p.reason.startsWith('Fast delivery')).length,
    skuziCallsWeek: m.points.filter((p) => isSkuziCall(p.reason)).length,
    tipsWeekRwf: tipRows.find((t) => t.staffId === m.id)?.total ?? 0,
    weekRank: null as number | null,
  }));
  rows
    .filter((r) => r.weekPoints > 0)
    .sort((a, b) => b.weekPoints - a.weekPoints)
    .forEach((r, i) => (r.weekRank = i + 1));
  return new Map(rows.map((r) => [r.staffId, r]));
}

async function waiterOfTab(tabId: string) {
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId), with: { table: true } });
  if (!tab) return null;
  const staffId = tab.staffId ?? (await db.query.tableAssignments.findFirst({ where: eq(tableAssignments.tableId, tab.tableId) }))?.staffId ?? null;
  const member = staffId ? await db.query.staff.findFirst({ where: eq(staff.id, staffId) }) : null;
  if (!member || !member.isActive || member.role === 'kitchen') return { tab, member: null };
  return { tab, member };
}

/** What the guest sees on their bill: who served them, their badges, and whether they take tips. */
export async function waiterCard(tabId: string) {
  const found = await waiterOfTab(tabId);
  if (!found?.member) return null;
  const { tab, member } = found;
  const [standing, rated] = await Promise.all([
    weeklyStanding(tab.table.venueId),
    db
      .select({ avg: sql<number>`avg(${ratings.waiterScore})::float`, n: sql<number>`count(*)::int` })
      .from(ratings)
      .where(eq(ratings.staffId, member.id)),
  ]);
  const me = standing.get(member.id);
  const n = rated[0]?.n ?? 0;
  return {
    name: member.name.split(' ')[0],
    topThisWeek: me?.weekRank === 1,
    fastService: (me?.fastWeek ?? 0) >= 5,
    // Only once a few guests have rated, so one bad night doesn't stick.
    rating: n >= 3 ? { avg: Math.round((rated[0].avg ?? 0) * 10) / 10, count: n } : null,
    tipMomo: member.tipMomo,
  };
}

/** The guest says they sent a tip: the waiter is told straight away. */
export async function recordTip(tabId: string, rawAmount: unknown) {
  const amountRwf = Number(rawAmount);
  if (!Number.isInteger(amountRwf) || amountRwf < MIN_TIP || amountRwf > MAX_TIP) {
    throw new Error(`A tip is between ${MIN_TIP} and ${MAX_TIP.toLocaleString('en-US')} RWF`);
  }
  const found = await waiterOfTab(tabId);
  if (!found) throw new Error('Tab not found');
  const { tab, member } = found;
  if (!member?.tipMomo) throw new Error("Your waiter doesn't take tips through Skuzi");
  if (tab.status === 'closed' && (!tab.closedAt || Date.now() - new Date(tab.closedAt).getTime() > TIP_AFTER_CLOSE_MS)) {
    throw new Error('This bill was closed a while ago');
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(tips).where(eq(tips.tabId, tabId));
  if (n >= MAX_TIPS_PER_TAB) throw new Error('Thank you! Your tips are already on their way');

  const venueId = tab.table.venueId;
  const [tip] = await db.insert(tips).values({ venueId, staffId: member.id, tabId, amountRwf }).returning();
  const amount = amountRwf.toLocaleString('en-US');
  broadcastToVenue(venueId, {
    type: 'tip_sent',
    payload: { tabId, staffId: member.id, tableLabel: tab.table.label, amountRwf },
    venueId,
    tableId: tab.tableId,
    timestamp: new Date().toISOString(),
  });
  await notifyTable(venueId, tab.tableId, member.id, {
    title: `💸 ${tab.table.label} sent you a ${amount} RWF tip`,
    body: 'Straight to your MoMo. Check it, and thank them!',
  }, null).catch(() => {});
  return { id: tip.id, amountRwf, name: member.name.split(' ')[0] };
}

/** The waiter turns tips on (with the MoMo number guests send to) or off. */
export async function setTipMomo(staffId: string, raw: unknown) {
  const tipMomo = raw === null || raw === '' ? null : normaliseMomo(raw);
  const [m] = await db.update(staff).set({ tipMomo }).where(eq(staff.id, staffId)).returning();
  if (!m) throw new Error('Staff not found');
  return { tipMomo: m.tipMomo };
}
