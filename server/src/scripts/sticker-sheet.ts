// Creates blank sticker codes for a printable sheet:
//   yarn workspace @tabpro/server stickers:create <tableCount>
// Table stickers are stored as unclaimed, each with the big number printed on
// it (1, 2, 3…): scanning one in Tables names the table "Table 5".
//   …stickers:create <tableCount> [firstNumber]   (e.g. 16 17 → stickers 17–32) The clock-in code needs no row: the owner claims it
// by scanning the sticker. Prints JSON for the PDF generator. Runs against
// DATABASE_URL.
import { randomBytes } from 'crypto';
import { createUnclaimedSticker } from '../services/qr.service';
import { db } from '../lib/db';
import { qrStickers } from '../models/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const count = Number(process.argv[2] ?? 16);
  const first = Number(process.argv[3] ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('Usage: stickers:create <1-200>');
  const site = (process.env.CLIENT_URL || 'https://tabpro.lol').replace(/\/$/, '');

  const tables: { code: string; number: number }[] = [];
  for (let i = 0; i < count; i++) {
    const number = first + i;
    const { code } = await createUnclaimedSticker();
    await db.update(qrStickers).set({ printedLabel: String(number) }).where(eq(qrStickers.code, code));
    tables.push({ code, number });
  }
  const clockIn = randomBytes(4).toString('hex').toUpperCase();

  console.log(JSON.stringify({
    tables: tables.map(({ code, number }) => ({ code, number, url: `${site}/t/${code}` })),
    clockIn: { code: clockIn, url: `${site}/clock-in?code=${clockIn}` },
  }));
}

main().then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1); });
