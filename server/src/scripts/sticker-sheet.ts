// Creates blank sticker codes for a printable sheet:
//   yarn workspace @tabpro/server stickers:create <tableCount>
// Table stickers are stored as unclaimed (the owner names each table by
// scanning it in Tables). The clock-in code needs no row: the owner claims it
// by scanning the sticker. Prints JSON for the PDF generator. Runs against
// DATABASE_URL.
import { randomBytes } from 'crypto';
import { createUnclaimedSticker } from '../services/qr.service';

async function main() {
  const count = Number(process.argv[2] ?? 16);
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('Usage: stickers:create <1-200>');
  const site = (process.env.CLIENT_URL || 'https://tabpro.lol').replace(/\/$/, '');

  const tables: string[] = [];
  for (let i = 0; i < count; i++) tables.push((await createUnclaimedSticker()).code);
  const clockIn = randomBytes(4).toString('hex').toUpperCase();

  console.log(JSON.stringify({
    tables: tables.map((code) => ({ code, url: `${site}/t/${code}` })),
    clockIn: { code: clockIn, url: `${site}/clock-in?code=${clockIn}` },
  }));
}

main().then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1); });
