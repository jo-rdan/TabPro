import { db } from '../lib/db';
import { subscriptions, venues } from '../models/schema';
import { eq } from 'drizzle-orm';

export async function getSubscription(venueId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.venueId, venueId),
  });

  if (!sub) return null;

  const now = new Date();
  const venue = await db.query.venues.findFirst({
    where: eq(venues.id, venueId),
  });

  const trialEndsAt = venue?.trialEndsAt ? new Date(venue.trialEndsAt) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrialActive = sub.status === 'trialing' && trialDaysLeft > 0;
  const isTrialExpired = sub.status === 'trialing' && trialDaysLeft === 0;

  return {
    ...sub,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    trialDaysLeft,
    isTrialActive,
    isTrialExpired,
  };
}

export async function updatePlan(venueId: string, plan: 'basic' | 'pro') {
  const [updated] = await db
    .update(subscriptions)
    .set({ plan, status: 'active' })
    .where(eq(subscriptions.venueId, venueId))
    .returning();

  return updated;
}

export async function getVenueAccessStatus(venueId: string): Promise<'active' | 'trial' | 'expired'> {
  const sub = await getSubscription(venueId);
  if (!sub) return 'expired';
  if (sub.status === 'active') return 'active';
  if (sub.isTrialActive) return 'trial';
  return 'expired';
}
