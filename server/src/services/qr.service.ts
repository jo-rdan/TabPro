import { db } from '../lib/db';
import { qrStickers, tables } from '../models/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export function generateQrCode(): string {
  return randomBytes(5).toString('hex'); // e.g. "a3f9c2b1e4"
}

export async function createUnclaimedSticker() {
  const code = generateQrCode();
  const [sticker] = await db
    .insert(qrStickers)
    .values({ code, status: 'unclaimed' })
    .returning();
  return sticker;
}

export async function claimSticker(code: string, tableId: string) {
  const sticker = await db.query.qrStickers.findFirst({
    where: eq(qrStickers.code, code),
  });

  if (!sticker) throw new Error('QR sticker not found');
  if (sticker.status === 'claimed') throw new Error('QR sticker already claimed');

  const [updated] = await db
    .update(qrStickers)
    .set({ tableId, status: 'claimed', claimedAt: new Date() })
    .where(eq(qrStickers.code, code))
    .returning();

  return updated;
}

export async function getStickerByCode(code: string) {
  return db.query.qrStickers.findFirst({
    where: eq(qrStickers.code, code),
    with: {
      // We need the table and venue — join manually
    },
  });
}

export async function getTableByQrCode(code: string) {
  const sticker = await db.query.qrStickers.findFirst({
    where: eq(qrStickers.code, code),
  });

  if (!sticker || !sticker.tableId) return null;

  const table = await db.query.tables.findFirst({
    where: eq(tables.id, sticker.tableId),
    with: { venue: true },
  });

  return table;
}
