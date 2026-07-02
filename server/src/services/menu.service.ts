import { db } from '../lib/db';
import { menuItems } from '../models/schema';
import { eq } from 'drizzle-orm';

export async function getMenuForVenue(venueId: string) {
  const items = await db.query.menuItems.findMany({
    where: eq(menuItems.venueId, venueId),
  });

  // Group by category
  const grouped: Record<string, typeof items> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  return { items, grouped };
}

export async function createMenuItem(
  venueId: string,
  name: string,
  category: string,
  priceRwf: number,
  description?: string
) {
  const [item] = await db
    .insert(menuItems)
    .values({ venueId, name, category, priceRwf, description })
    .returning();
  return item;
}

export async function createMenuItemsBatch(
  venueId: string,
  items: { name: string; category: string; priceRwf: number; description?: string }[]
) {
  const rows = await db
    .insert(menuItems)
    .values(items.map((i) => ({ ...i, venueId })))
    .returning();
  return rows;
}

export async function getMenuItemById(id: string) {
  return db.query.menuItems.findFirst({
    where: eq(menuItems.id, id),
  });
}
