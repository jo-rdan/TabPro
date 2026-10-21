import { db } from '../lib/db';
import { venues, subscriptions, owners, venueTermsAcceptances } from '../models/schema';
import { eq, isNull, like } from 'drizzle-orm';
import { parseHours } from '../lib/hours';
import { HttpError } from '../middleware/error.middleware';

// ─── The venue's web address on Skuzi: /v/<slug> ─────────────────────────────
export function slugify(name: string): string {
  return name
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '') || 'venue';
}

/** A free slug for this name: "sunset-lounge", else "sunset-lounge-2", … */
export async function uniqueSlug(name: string, venueId?: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (await db.select({ slug: venues.slug, id: venues.id }).from(venues).where(like(venues.slug, `${base}%`)))
      .filter((v) => v.id !== venueId)
      .map((v) => v.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Venues made before slugs existed get one (runs at start-up). */
export async function ensureVenueSlugs() {
  const missing = await db.select({ id: venues.id, name: venues.name }).from(venues).where(isNull(venues.slug));
  for (const v of missing) {
    await db.update(venues).set({ slug: await uniqueSlug(v.name, v.id) }).where(eq(venues.id, v.id));
  }
}

export async function updateVenueSettings(
  venueId: string,
  changes: { openingHours?: unknown; bookingsEnabled?: boolean },
) {
  const set: Partial<typeof venues.$inferInsert> = {};
  if (changes.openingHours !== undefined) {
    const hours = parseHours(changes.openingHours);
    if (!hours) throw new HttpError(400, 'Please check the opening hours');
    set.openingHours = hours;
  }
  if (changes.bookingsEnabled !== undefined) set.bookingsEnabled = changes.bookingsEnabled;
  if (Object.keys(set).length === 0) return db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  const [venue] = await db.update(venues).set(set).where(eq(venues.id, venueId)).returning();
  return venue;
}

export async function createVenue(ownerId: string, name: string, location?: string, momoPhone?: string, momoPayCode?: string) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const [venue] = await db
    .insert(venues)
    .values({ ownerId, name, location, momoPhone, momoPayCode, trialEndsAt, plan: 'pro', slug: await uniqueSlug(name) })
    .returning();

  await db.insert(subscriptions).values({
    venueId: venue.id,
    plan: 'basic',
    status: 'trialing',
  });

  return venue;
}

export async function getVenuesByOwner(ownerId: string) {
  return db.query.venues.findMany({
    where: eq(venues.ownerId, ownerId),
    orderBy: (v, { asc }) => [asc(v.createdAt)],
    with: { subscription: true },
  });
}

export async function updateVenueMomoPhone(venueId: string, momoPhone: string) {
  const [venue] = await db
    .update(venues)
    .set({ momoPhone })
    .where(eq(venues.id, venueId))
    .returning();
  return venue;
}

export async function updateVenueLogo(venueId: string, logoUrl: string) {
  const [venue] = await db
    .update(venues)
    .set({ logoUrl })
    .where(eq(venues.id, venueId))
    .returning();
  return venue;
}

// Records that the owner agreed to the venue terms ("I agree" in the app).
export async function acceptVenueTerms(venueId: string, ownerId: string, version: number) {
  const owner = await db.query.owners.findFirst({ where: eq(owners.id, ownerId) });
  const ownerName = owner?.name ?? 'Owner';
  const now = new Date();
  await db.insert(venueTermsAcceptances).values({ venueId, ownerId, ownerName, version, acceptedAt: now });
  const [venue] = await db.update(venues)
    .set({ termsVersion: version, termsAcceptedAt: now, termsAcceptedBy: ownerName })
    .where(eq(venues.id, venueId))
    .returning();
  return venue;
}
