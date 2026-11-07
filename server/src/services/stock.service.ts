import { db } from '../lib/db';
import { menuItems, stockMovements } from '../models/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { sendPushToOwner } from './push.service';
import { broadcastToVenue } from '../lib/websocket';
import { readPackFromImage } from './menuExtract.service';

// Stock for bars: an item the owner switched to "track stock" is counted down by
// every order (guest or waiter), counted up by deliveries, and reset by a count,
// which records how many went missing. At 0 the item is sold out automatically;
// a delivery or a count above 0 puts it back on the menu.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const PACK_KINDS = ['crate', 'tray', 'box'] as const;
export type PackKind = (typeof PACK_KINDS)[number];
export type Pack = { kind: PackKind; size: number } | null;
export type StockAlert = { name: string; left: number; pack: Pack };

export const packOf = (i: { packKind: string | null; packSize: number | null }): Pack =>
  i.packKind && (PACK_KINDS as readonly string[]).includes(i.packKind) && i.packSize && i.packSize >= 2
    ? { kind: i.packKind as PackKind, size: i.packSize }
    : null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : word === 'box' ? 'es' : 's'}`;

/** "3 crates + 4", "1 tray", "5 bottles": how staff talk about stock. */
export function stockWords(qty: number, pack: Pack) {
  if (!pack) return plural(qty, 'bottle');
  if (qty <= 0) return plural(0, pack.kind);
  const packs = Math.floor(qty / pack.size);
  const rest = qty % pack.size;
  if (packs === 0) return plural(rest, pack.kind === 'tray' ? 'can' : 'bottle');
  return rest ? `${plural(packs, pack.kind)} + ${rest}` : plural(packs, pack.kind);
}

/** A crate, tray or box of 2 to 100, or none (single bottles). */
export function cleanPack(kind: unknown, size: unknown): Pack {
  if (kind == null || kind === '' || kind === 'single') return null;
  if (!(PACK_KINDS as readonly string[]).includes(String(kind))) throw new Error('Pick crate, tray, box or single bottles');
  const n = Math.floor(Number(size));
  if (!Number.isFinite(n) || n < 2 || n > 100) throw new Error(`A ${kind} holds between 2 and 100`);
  return { kind: kind as PackKind, size: n };
}

/** Kigali business day: "tonight" starts at 05:00 local (03:00 UTC). */
export function startOfBusinessDay(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(3, 0, 0, 0);
  if (now < start) start.setUTCDate(start.getUTCDate() - 1);
  return start;
}

/**
 * Inside the order's transaction: take the ordered quantities off every tracked
 * item. Throws (rolling the order back) if there isn't enough left, so a guest
 * can't order the last bottle twice. Returns the alerts to send after commit.
 */
export async function takeStockForOrder(
  tx: Tx,
  venueId: string,
  orderId: string,
  lines: { menuItemId: string; quantity: number; name: string; stockTracked: boolean }[],
): Promise<StockAlert[]> {
  const alerts: StockAlert[] = [];
  const merged = new Map<string, { quantity: number; name: string }>();
  for (const l of lines) {
    if (!l.stockTracked) continue;
    const m = merged.get(l.menuItemId);
    merged.set(l.menuItemId, { quantity: (m?.quantity ?? 0) + l.quantity, name: l.name });
  }
  for (const [menuItemId, { quantity, name }] of merged) {
    const [row] = await tx
      .update(menuItems)
      .set({
        stockQty: sql`${menuItems.stockQty} - ${quantity}`,
        isAvailable: sql`CASE WHEN ${menuItems.stockQty} - ${quantity} <= 0 THEN false ELSE ${menuItems.isAvailable} END`,
      })
      .where(and(eq(menuItems.id, menuItemId), eq(menuItems.stockTracked, true), gte(menuItems.stockQty, quantity)))
      .returning({ qty: menuItems.stockQty, alertAt: menuItems.stockAlertAt, packKind: menuItems.packKind, packSize: menuItems.packSize });
    if (!row) {
      const item = await tx.query.menuItems.findFirst({ where: eq(menuItems.id, menuItemId) });
      const left = Math.max(0, item?.stockQty ?? 0);
      throw new Error(left === 0 ? `"${name}" is sold out` : `Only ${left} "${name}" left`);
    }
    const after = row.qty ?? 0;
    await tx.insert(stockMovements).values({ venueId, menuItemId, kind: 'sale', qtyChange: -quantity, qtyAfter: after, orderId });
    const before = after + quantity;
    if (after === 0 || (row.alertAt != null && before > row.alertAt && after <= row.alertAt)) alerts.push({ name, left: after, pack: packOf(row) });
  }
  return alerts;
}

/** After the order is saved: tell the owner what's running low or ran out. */
export async function sendStockAlerts(venueId: string, alerts: StockAlert[]) {
  for (const a of alerts) {
    await sendPushToOwner(
      venueId,
      a.left === 0 ? `🍺 ${a.name} is sold out` : `🍺 ${a.name}: ${stockWords(a.left, a.pack)} left`,
      a.left === 0 ? 'It shows as sold out on the menu. Add a delivery to bring it back.' : 'Time to order more.',
    ).catch(() => {});
  }
  if (alerts.length) {
    broadcastToVenue(venueId, { type: 'stock_update', payload: {}, venueId, timestamp: new Date().toISOString() });
  }
}

/** The Stock page: every menu item, with what's left and what sold tonight. */
export async function getStock(venueId: string) {
  const since = startOfBusinessDay();
  const [items, sold] = await Promise.all([
    db.query.menuItems.findMany({ where: eq(menuItems.venueId, venueId) }),
    db
      .select({ menuItemId: stockMovements.menuItemId, sold: sql<number>`coalesce(-sum(${stockMovements.qtyChange}), 0)::int` })
      .from(stockMovements)
      .where(and(eq(stockMovements.venueId, venueId), eq(stockMovements.kind, 'sale'), gte(stockMovements.createdAt, since)))
      .groupBy(stockMovements.menuItemId),
  ]);
  const soldBy = new Map(sold.map((s) => [s.menuItemId, s.sold]));
  const list = items
    .map((i) => {
      const qty = i.stockQty ?? 0;
      const status = !i.stockTracked ? 'off' : qty <= 0 ? 'out' : i.stockAlertAt != null && qty <= i.stockAlertAt ? 'low' : 'ok';
      return {
        id: i.id, name: i.name, category: i.category, priceRwf: i.priceRwf,
        tracked: i.stockTracked, qty, alertAt: i.stockAlertAt, pack: packOf(i), soldTonight: soldBy.get(i.id) ?? 0, status,
      };
    })
    .sort((a, b) => Number(b.tracked) - Number(a.tracked) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const tracked = list.filter((i) => i.tracked);
  return {
    items: list,
    summary: {
      soldTonight: tracked.reduce((n, i) => n + i.soldTonight, 0),
      low: tracked.filter((i) => i.status === 'low').length,
      out: tracked.filter((i) => i.status === 'out').length,
    },
  };
}

/** Switch tracking on/off for an item, with its starting count and warning level. */
export async function setTracking(menuItemId: string, input: { tracked: boolean; qty?: number; alertAt?: number | null; packKind?: unknown; packSize?: unknown }) {
  const item = await db.query.menuItems.findFirst({ where: eq(menuItems.id, menuItemId) });
  if (!item) throw new Error('Menu item not found');
  if (!input.tracked) {
    // Stop tracking; if stock had sold it out, it goes back on the menu.
    await db.update(menuItems).set({ stockTracked: false, ...((item.stockQty ?? 0) <= 0 ? { isAvailable: true } : {}) }).where(eq(menuItems.id, menuItemId));
    return;
  }
  const qty = Math.max(0, Math.floor(input.qty ?? item.stockQty ?? 0));
  const alertAt = input.alertAt == null ? item.stockAlertAt : Math.max(0, Math.floor(input.alertAt));
  const pack = input.packKind === undefined ? packOf(item) : cleanPack(input.packKind, input.packSize);
  await db.transaction(async (tx) => {
    await tx.update(menuItems)
      .set({ stockTracked: true, stockQty: qty, stockAlertAt: alertAt, packKind: pack?.kind ?? null, packSize: pack?.size ?? null, isAvailable: qty > 0 })
      .where(eq(menuItems.id, menuItemId));
    if (!item.stockTracked || qty !== (item.stockQty ?? 0)) {
      await tx.insert(stockMovements).values({
        venueId: item.venueId, menuItemId, kind: 'count', qtyChange: 0, qtyAfter: qty, expectedQty: qty, note: 'Starting count',
      });
    }
  });
}

/** A delivery arrived: add bottles; anything above 0 is back on the menu. */
export async function addDelivery(venueId: string, lines: { menuItemId: string; qty: number }[], supplier?: string | null) {
  const note = supplier?.trim() ? supplier.trim().slice(0, 80) : null;
  await db.transaction(async (tx) => {
    for (const l of lines) {
      const qty = Math.floor(l.qty);
      if (!(qty > 0)) continue;
      const [row] = await tx.update(menuItems)
        .set({ stockQty: sql`coalesce(${menuItems.stockQty}, 0) + ${qty}`, isAvailable: true })
        .where(and(eq(menuItems.id, l.menuItemId), eq(menuItems.venueId, venueId), eq(menuItems.stockTracked, true)))
        .returning({ qty: menuItems.stockQty });
      if (!row) throw new Error('Switch on stock for this item first');
      await tx.insert(stockMovements).values({ venueId, menuItemId: l.menuItemId, kind: 'delivery', qtyChange: qty, qtyAfter: row.qty ?? qty, note });
    }
  });
  broadcastToVenue(venueId, { type: 'stock_update', payload: {}, venueId, timestamp: new Date().toISOString() });
}

/** The closing count: set the real numbers and report what went missing. */
export async function saveCount(venueId: string, lines: { menuItemId: string; counted: number }[]) {
  const missing: { name: string; qty: number; valueRwf: number }[] = [];
  const extra: { name: string; qty: number }[] = [];
  await db.transaction(async (tx) => {
    for (const l of lines) {
      const counted = Math.floor(l.counted);
      if (!(counted >= 0)) continue;
      const item = await tx.query.menuItems.findFirst({ where: and(eq(menuItems.id, l.menuItemId), eq(menuItems.venueId, venueId)) });
      if (!item || !item.stockTracked) continue;
      const expected = item.stockQty ?? 0;
      await tx.update(menuItems).set({ stockQty: counted, isAvailable: counted > 0 }).where(eq(menuItems.id, item.id));
      await tx.insert(stockMovements).values({
        venueId, menuItemId: item.id, kind: 'count', qtyChange: counted - expected, qtyAfter: counted, expectedQty: expected,
      });
      if (counted < expected) missing.push({ name: item.name, qty: expected - counted, valueRwf: (expected - counted) * item.priceRwf });
      if (counted > expected) extra.push({ name: item.name, qty: counted - expected });
    }
  });
  broadcastToVenue(venueId, { type: 'stock_update', payload: {}, venueId, timestamp: new Date().toISOString() });
  return { missing, extra, missingValueRwf: missing.reduce((n, m) => n + m.valueRwf, 0) };
}

/** One item's story: recent movements and this week's totals. */
export async function getItemHistory(menuItemId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600e3);
  const [movements, week] = await Promise.all([
    db.query.stockMovements.findMany({
      where: eq(stockMovements.menuItemId, menuItemId),
      orderBy: [desc(stockMovements.createdAt)],
      limit: 60,
      with: { order: { with: { tab: { with: { table: true } } } } },
    }),
    db
      .select({
        sold: sql<number>`coalesce(-sum(${stockMovements.qtyChange}) filter (where ${stockMovements.kind} = 'sale'), 0)::int`,
        delivered: sql<number>`coalesce(sum(${stockMovements.qtyChange}) filter (where ${stockMovements.kind} = 'delivery'), 0)::int`,
        missing: sql<number>`coalesce(-sum(${stockMovements.qtyChange}) filter (where ${stockMovements.kind} = 'count' and ${stockMovements.qtyChange} < 0), 0)::int`,
      })
      .from(stockMovements)
      .where(and(eq(stockMovements.menuItemId, menuItemId), gte(stockMovements.createdAt, weekAgo))),
  ]);
  return {
    movements: movements.map((m) => ({
      id: m.id, kind: m.kind, qtyChange: m.qtyChange, qtyAfter: m.qtyAfter, expectedQty: m.expectedQty,
      note: m.note, createdAt: m.createdAt, tableLabel: m.order?.tab?.table?.label ?? null,
    })),
    week: week[0] ?? { sold: 0, delivered: 0, missing: 0 },
  };
}

// ─── A delivery by photo or typed in: any drink, any pack ────────────────────
const SIZE_WORDS: Record<'small' | 'medium' | 'big', RegExp> = {
  small: /\b(small|petit|petite|mini|33\s?cl)\b/i,
  medium: /\b(medium|moyen|moyenne|50\s?cl)\b/i,
  big: /\b(big|grand|grande|large|65\s?cl|72\s?cl)\b/i,
};
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** The menu item that best fits what the photo shows (brand, then size), or null. */
export function matchDrink<T extends { id: string; name: string }>(items: T[], drink: string | null, size: 'small' | 'medium' | 'big' | null): T | null {
  if (!drink) return null;
  const brand = plain(drink).split(/[\s-]+/)[0];
  if (!brand) return null;
  const sameBrand = items.filter((i) => plain(i.name).includes(brand));
  if (sameBrand.length <= 1) return sameBrand[0] ?? null;
  const sized = size ? sameBrand.filter((i) => SIZE_WORDS[size].test(i.name)) : [];
  return sized[0] ?? sameBrand[0];
}

export async function readDeliveryPhoto(venueId: string, base64: string, mimeType: string) {
  const reading = await readPackFromImage(base64, mimeType).catch((err: Error) => {
    throw new Error(/menu/.test(err.message) ? "Couldn't read the photo right now. Type it in instead." : err.message);
  });
  const items = await db.query.menuItems.findMany({ where: eq(menuItems.venueId, venueId) });
  const match = matchDrink(items, reading.drink, reading.size);
  return { ...reading, menuItemId: match?.id ?? null, name: match?.name ?? null, priceRwf: match?.priceRwf ?? null };
}

/**
 * A delivery from the review screen: an existing drink (by id or exact name) or
 * a new one added to the menu, its pack remembered, tracking switched on, and
 * packs × size + loose bottles added. Only the owner adds drinks or changes prices.
 */
export async function receiveDelivery(
  venueId: string,
  input: { menuItemId?: unknown; name?: unknown; priceRwf?: unknown; packKind?: unknown; packSize?: unknown; packs?: unknown; loose?: unknown; supplier?: unknown },
  { canEditMenu }: { canEditMenu: boolean },
) {
  const pack = cleanPack(input.packKind, input.packSize);
  const whole = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  const added = whole(input.packs) * (pack?.size ?? 1) + whole(input.loose);
  if (added <= 0 || added > 100000) throw new Error('Say how many came');
  const price = input.priceRwf == null || input.priceRwf === '' ? null : Math.round(Number(input.priceRwf));
  if (price != null && (!Number.isFinite(price) || price <= 0)) throw new Error('Type a price');
  const name = String(input.name ?? '').trim().slice(0, 80);
  const note = typeof input.supplier === 'string' && input.supplier.trim() ? input.supplier.trim().slice(0, 80) : null;

  const venueItems = await db.query.menuItems.findMany({ where: eq(menuItems.venueId, venueId) });
  let item = typeof input.menuItemId === 'string' ? venueItems.find((i) => i.id === input.menuItemId) : undefined;
  if (!item && name) item = venueItems.find((i) => plain(i.name) === plain(name));
  if (!item && !name) throw new Error('Type the name of the drink');
  if (!canEditMenu && (!item || (price != null && price !== item.priceRwf))) {
    throw new Error('Only the owner can add a drink to the menu or change its price');
  }

  const result = await db.transaction(async (tx) => {
    let row = item;
    if (!row) {
      if (price == null) throw new Error('Type the price for the menu');
      [row] = await tx.insert(menuItems).values({ venueId, name, category: 'Drinks', priceRwf: price }).returning();
    } else if (price != null && price !== row.priceRwf) {
      await tx.update(menuItems).set({ priceRwf: price }).where(eq(menuItems.id, row.id));
    }
    const before = row.stockTracked ? row.stockQty ?? 0 : 0;
    const [after] = await tx.update(menuItems)
      .set({
        stockTracked: true,
        stockQty: before + added,
        isAvailable: true,
        packKind: pack?.kind ?? null,
        packSize: pack?.size ?? null,
        ...(row.stockTracked ? {} : { stockAlertAt: pack ? pack.size * 2 : 6 }),
      })
      .where(eq(menuItems.id, row.id))
      .returning();
    await tx.insert(stockMovements).values({ venueId, menuItemId: row.id, kind: 'delivery', qtyChange: added, qtyAfter: after.stockQty ?? added, note });
    return { id: row.id, name: row.name, added, qty: after.stockQty ?? added, left: stockWords(after.stockQty ?? added, pack) };
  });
  broadcastToVenue(venueId, { type: 'stock_update', payload: {}, venueId, timestamp: new Date().toISOString() });
  return result;
}
