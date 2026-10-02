// Creates the "Demo Lounge" venue used to show TabPro to prospects.
// Payments there are simulated: no pawaPay call, no real money.
//
//   yarn workspace @tabpro/server demo:create <owner-email>
//
// Runs against DATABASE_URL. The owner must have signed in once at the
// website with that Google account. Safe to re-run: it reuses an existing
// demo venue and only prints its details.
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db';
import { owners, venues, tables, staff } from '../models/schema';
import { createVenue } from '../services/venue.service';
import { createTable } from '../services/table.service';
import { createMenuItemsBatch } from '../services/menu.service';
import { normalizeStaffPhone, setPin } from '../services/staff.service';
import { autoAssignTablesForVenue, autoAssignShiftsForVenue } from '../services/autoAssign.service';

const MENU = [
  { name: 'Goat Brochette', category: 'Grill', priceRwf: 3500 },
  { name: 'Beef Brochette', category: 'Grill', priceRwf: 3000 },
  { name: 'Grilled Tilapia', category: 'Grill', priceRwf: 8000 },
  { name: 'Isombe', category: 'Local dishes', priceRwf: 2500 },
  { name: 'Chips Mayai', category: 'Local dishes', priceRwf: 2000 },
  { name: 'Primus', category: 'Beers', priceRwf: 1500 },
  { name: 'Mützig', category: 'Beers', priceRwf: 1800 },
  { name: 'Virunga Mist', category: 'Beers', priceRwf: 2000 },
  { name: 'Fanta Citron', category: 'Soft drinks', priceRwf: 800 },
  { name: 'Ikivuguto', category: 'Soft drinks', priceRwf: 1000 },
];
const DEMO_WAITER = { name: 'Demo Waiter', phone: '0780000001', pin: '1234' };

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('Usage: demo:create <owner-email>');

  const owner = await db.query.owners.findFirst({ where: eq(owners.email, email.toLowerCase()) });
  if (!owner) {
    throw new Error(`No owner with email ${email}. Sign in once at the website with that Google account, then re-run.`);
  }

  let venue = await db.query.venues.findFirst({ where: and(eq(venues.ownerId, owner.id), eq(venues.isDemo, true)) });
  if (venue) {
    console.log('Demo venue already exists — reusing it.');
  } else {
    venue = await createVenue(owner.id, 'Demo Lounge', 'Kigali');
    await db.update(venues).set({ isDemo: true }).where(eq(venues.id, venue.id));
    await createMenuItemsBatch(venue.id, MENU);
    for (let i = 1; i <= 4; i++) await createTable(venue.id, `Table ${i}`);
    // Added directly (not via createStaff) so no invite SMS goes to the number.
    const [waiter] = await db.insert(staff)
      .values({ venueId: venue.id, name: DEMO_WAITER.name, phone: normalizeStaffPhone(DEMO_WAITER.phone), role: 'waiter' })
      .returning();
    await setPin(waiter.id, DEMO_WAITER.pin);
    await autoAssignTablesForVenue(venue.id);
    await autoAssignShiftsForVenue(venue.id);
    console.log('Demo venue created.');
  }

  const site = (process.env.CLIENT_URL || 'https://tabpro.lol').replace(/\/$/, '');
  const venueTables = await db.query.tables.findMany({ where: eq(tables.venueId, venue.id), with: { qrSticker: true } });
  console.log(`\nVenue: ${venue.name} (${venue.id})`);
  console.log('Table QR links:');
  for (const t of venueTables.sort((a, b) => a.label.localeCompare(b.label))) {
    if (t.qrSticker) console.log(`  ${t.label}: ${site}/t/${t.qrSticker.code}`);
  }
  const waiter = await db.query.staff.findFirst({ where: and(eq(staff.venueId, venue.id), eq(staff.name, DEMO_WAITER.name)) });
  if (waiter) console.log(`Waiter login: ${site}/waiter  phone ${DEMO_WAITER.phone}  PIN ${DEMO_WAITER.pin}`);
  console.log(`Owner view: sign in at ${site}/login as ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err.message); process.exit(1); });
