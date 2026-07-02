import { db } from '../lib/db';
import { orders, tabs, tables } from '../models/schema';
import { eq, gte, and } from 'drizzle-orm';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]; // 11 AM – 10 PM

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export async function getBusyHoursHeatmap(venueId: string) {
  // Last 4 weeks
  const since = new Date();
  since.setDate(since.getDate() - 28);
  since.setHours(0, 0, 0, 0);

  // Get all venue table ids
  const venueTables = await db.query.tables.findMany({
    where: eq(tables.venueId, venueId),
  });
  const tableIds = venueTables.map((t) => t.id);
  if (tableIds.length === 0) return emptyResult();

  // Get all tabs opened since 4 weeks ago for this venue
  const recentTabs = await db.query.tabs.findMany({
    where: gte(tabs.openedAt, since),
    with: {
      orders: true,
      table: true,
    },
  });

  const venueTabs = recentTabs.filter((t) => tableIds.includes(t.tableId));

  // Build day×hour grid: [dayIndex 0-6][hour 0-23] = order count
  // dayIndex: 0=Mon ... 6=Sun
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  // Per-day totals
  const dayTotals: number[] = Array(7).fill(0);

  for (const tab of venueTabs) {
    for (const order of tab.orders) {
      const d = new Date(order.placedAt);
      const jsDay = d.getDay(); // 0=Sun, 1=Mon...
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0...Sun=6
      const hour = d.getHours();
      grid[dayIdx][hour]++;
      dayTotals[dayIdx]++;
    }
  }

  // Build heatmap cells for visible hours only
  const cells = DAYS.map((day, di) =>
    HOURS.map((hour) => ({
      day,
      hour,
      count: grid[di][hour],
    }))
  );

  const maxCount = Math.max(...cells.flat().map((c) => c.count), 1);

  // Summary stats
  const busiestDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
  const busiestDay = DAYS[busiestDayIdx];

  // Peak hour: find hour with most total orders across all days
  const hourTotals: number[] = Array(24).fill(0);
  for (let h = 0; h < 24; h++) {
    for (let d = 0; d < 7; d++) {
      hourTotals[h] += grid[d][h];
    }
  }
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  const peakHourLabel = `${formatHour(peakHour)}–${formatHour(peakHour + 1)}`;

  // Avg orders per hour (over hours with at least 1 order, across 4 weeks)
  const totalOrders = dayTotals.reduce((s, v) => s + v, 0);
  const activeHours = hourTotals.filter((v) => v > 0).length || 1;
  const avgOrdersPerHour = Math.round(totalOrders / activeHours);

  // Peak days ranked
  const peakDays = DAYS.map((day, i) => ({ day, orders: dayTotals[i] }))
    .filter((d) => d.orders > 0)
    .sort((a, b) => b.orders - a.orders);

  // Staffing suggestion
  const top2 = peakDays.slice(0, 2).map((d) => d.day);
  const staffingSuggestion =
    top2.length > 0
      ? `${top2.join(' & ')} ${peakHourLabel} are your busiest windows. Consider adding 1 extra waiter during those hours to avoid delays.`
      : 'Not enough data yet to make a staffing suggestion.';

  return {
    cells,
    maxCount,
    busiestDay,
    peakHourLabel,
    avgOrdersPerHour,
    peakDays,
    staffingSuggestion,
    hours: HOURS,
    days: DAYS,
  };
}

function formatHour(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display} ${ampm}`;
}

function emptyResult() {
  return {
    cells: DAYS.map((day) => HOURS.map((hour) => ({ day, hour, count: 0 }))),
    maxCount: 1,
    busiestDay: null,
    peakHourLabel: null,
    avgOrdersPerHour: 0,
    peakDays: [],
    staffingSuggestion: 'Not enough data yet to make a staffing suggestion.',
    hours: HOURS,
    days: DAYS,
  };
}
