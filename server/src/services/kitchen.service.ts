import { db } from '../lib/db';
import { kitchenSpends, menuItems, orderItems, orders, tabs, tables, venues } from '../models/schema';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { startOfBusinessDay } from './stock.service';

// Kitchen, in money: the owner logs what she spends on food (market, butcher…)
// and Skuzi sets it against the food it sold, so she sees her food profit
// without counting kilograms. Drinks are left out: the bar has its own stock.

const DRINK = /drink|boisson|beer|bi[eè]re|wine|\bvin\b|cocktail|spirit|liqu|soft|soda|juice|\bjus\b|water|\beau\b|coffee|caf[eé]|\btea\b|th[eé]|beverage|shot|whisk|vodka|\bgin\b|\brum\b/i;

export type KitchenRange = 'tonight' | 'week';

async function categoriesOf(venueId: string) {
  const [venue, rows] = await Promise.all([
    db.query.venues.findFirst({ where: eq(venues.id, venueId) }),
    db.selectDistinct({ category: menuItems.category }).from(menuItems).where(eq(menuItems.venueId, venueId)),
  ]);
  const all = rows.map((r) => r.category).sort((a, b) => a.localeCompare(b));
  const kitchen = venue?.kitchenCategories?.length ? venue.kitchenCategories.filter((c) => all.includes(c)) : all.filter((c) => !DRINK.test(c));
  return { all, kitchen };
}

export async function getKitchen(venueId: string, range: KitchenRange) {
  const since = range === 'tonight' ? startOfBusinessDay() : new Date(Date.now() - 7 * 24 * 3600e3);
  const categories = await categoriesOf(venueId);
  const [sold, spent, spends] = await Promise.all([
    categories.kitchen.length === 0
      ? Promise.resolve([{ total: 0 }])
      : db
          .select({ total: sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPriceRwf}), 0)::int` })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .innerJoin(tabs, eq(tabs.id, orders.tabId))
          .innerJoin(tables, eq(tables.id, tabs.tableId))
          .innerJoin(menuItems, eq(menuItems.id, orderItems.menuItemId))
          .where(and(eq(tables.venueId, venueId), gte(orders.placedAt, since), inArray(menuItems.category, categories.kitchen))),
    db
      .select({ total: sql<number>`coalesce(sum(${kitchenSpends.amountRwf}), 0)::int` })
      .from(kitchenSpends)
      .where(and(eq(kitchenSpends.venueId, venueId), gte(kitchenSpends.spentAt, since))),
    db.query.kitchenSpends.findMany({
      where: and(eq(kitchenSpends.venueId, venueId), gte(kitchenSpends.spentAt, since)),
      orderBy: [desc(kitchenSpends.spentAt)],
      limit: 60,
    }),
  ]);
  const soldRwf = sold[0]?.total ?? 0;
  const spentRwf = spent[0]?.total ?? 0;
  return {
    range,
    soldRwf,
    spentRwf,
    profitRwf: soldRwf - spentRwf,
    spentPct: soldRwf > 0 ? Math.round((spentRwf / soldRwf) * 100) : null,
    spends: spends.map((s) => ({ id: s.id, amountRwf: s.amountRwf, note: s.note, spentAt: s.spentAt })),
    categories,
  };
}

export async function addSpend(venueId: string, input: { amountRwf: unknown; note?: unknown }) {
  const amount = Math.round(Number(input.amountRwf));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 50_000_000) throw new Error('Type how much was spent, in RWF');
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 80) : null;
  const [row] = await db.insert(kitchenSpends).values({ venueId, amountRwf: amount, note }).returning();
  return row;
}

export async function deleteSpend(venueId: string, spendId: string) {
  const [row] = await db.delete(kitchenSpends).where(and(eq(kitchenSpends.id, spendId), eq(kitchenSpends.venueId, venueId))).returning();
  if (!row) throw new Error('Not found');
}

export async function setKitchenCategories(venueId: string, input: unknown) {
  if (!Array.isArray(input)) throw new Error('Pick the food categories');
  const { all } = await categoriesOf(venueId);
  const picked = input.filter((c): c is string => typeof c === 'string' && all.includes(c));
  await db.update(venues).set({ kitchenCategories: picked }).where(eq(venues.id, venueId));
}
