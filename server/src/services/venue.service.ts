import { db } from '../lib/db';
import { venues, subscriptions, owners, venueTermsAcceptances } from '../models/schema';
import { eq } from 'drizzle-orm';

export async function createVenue(ownerId: string, name: string, location?: string, momoPhone?: string) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const [venue] = await db
    .insert(venues)
    .values({ ownerId, name, location, momoPhone, trialEndsAt })
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
