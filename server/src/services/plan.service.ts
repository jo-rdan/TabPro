import { db } from '../lib/db';
import { venues, owners } from '../models/schema';
import { desc, eq } from 'drizzle-orm';
import { PLANS, type PlanId } from '@tabpro/shared';

// Packages (Starter / Pro / Bar+) and the venue's own MoMo Pay code.
// Skuzi takes nothing from sales: guests pay the venue's code directly, and the
// venue pays a monthly package. Billing is by hand for now: the founder marks a
// venue as paid from the Plans page.

const DAY = 24 * 3600e3;

export function planStatus(venue: typeof venues.$inferSelect) {
  const now = Date.now();
  const trialEnds = venue.trialEndsAt ? new Date(venue.trialEndsAt).getTime() : 0;
  const paidUntil = venue.paidUntil ? new Date(venue.paidUntil).getTime() : 0;
  const plan = (venue.plan as PlanId) in PLANS ? (venue.plan as PlanId) : 'basic';
  return {
    plan,
    planName: PLANS[plan].name,
    priceRwf: PLANS[plan].priceRwf,
    trialEndsAt: venue.trialEndsAt,
    trialDaysLeft: Math.max(0, Math.ceil((trialEnds - now) / DAY)),
    paidUntil: venue.paidUntil,
    // 'trial' → free period; 'paid' → paid up; 'due' → time to pay (nothing is
    // switched off: guests are never blocked, the owner sees a reminder).
    state: paidUntil > now ? 'paid' : trialEnds > now ? 'trial' : 'due',
    momoPayCode: venue.momoPayCode,
  } as const;
}

/** MTN MoMo Pay merchant codes are short digit strings. */
export async function setMomoPayCode(venueId: string, raw: unknown) {
  const code = typeof raw === 'string' ? raw.replace(/\s/g, '') : '';
  if (code !== '' && !/^\d{4,10}$/.test(code)) throw new Error('A MoMo Pay code is 4 to 10 digits');
  const [v] = await db.update(venues).set({ momoPayCode: code || null }).where(eq(venues.id, venueId)).returning();
  return planStatus(v);
}

/**
 * The owner picks a package while still in the free trial. The trial length
 * follows the package (Starter 2 weeks, Pro and Bar+ a month, from sign-up).
 * After the trial, switching goes through Skuzi.
 */
export async function chooseOwnPlan(venueId: string, raw: unknown) {
  const plan = raw as PlanId;
  if (!(plan in PLANS)) throw new Error('Pick Starter, Pro or Bar+');
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new Error('Venue not found');
  const status = planStatus(venue);
  if (status.state !== 'trial') throw new Error('Your free trial has ended. WhatsApp Skuzi to change package.');
  const trialEndsAt = new Date(new Date(venue.createdAt).getTime() + PLANS[plan].trialDays * DAY);
  const [v] = await db.update(venues).set({ plan, trialEndsAt }).where(eq(venues.id, venueId)).returning();
  return planStatus(v);
}

/** Founder: every venue with its package, for the Plans page. */
export async function listVenuePlans() {
  const rows = await db
    .select({ venue: venues, ownerEmail: owners.email, ownerName: owners.name })
    .from(venues)
    .innerJoin(owners, eq(owners.id, venues.ownerId))
    .orderBy(desc(venues.createdAt));
  return rows.map(({ venue, ownerEmail, ownerName }) => ({
    id: venue.id, name: venue.name, isDemo: venue.isDemo, ownerName, ownerEmail, createdAt: venue.createdAt, ...planStatus(venue),
  }));
}

/** Founder: change a venue's package, trial end, or mark it paid. */
export async function adminUpdatePlan(venueId: string, input: { plan?: unknown; trialEndsAt?: unknown; paidUntil?: unknown }) {
  const set: Partial<typeof venues.$inferInsert> = {};
  if (input.plan !== undefined) {
    if (!((input.plan as string) in PLANS)) throw new Error('Unknown package');
    set.plan = input.plan as PlanId;
  }
  const date = (v: unknown) => {
    if (v === null) return null;
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) throw new Error('Bad date');
    return d;
  };
  if (input.trialEndsAt !== undefined) {
    const d = date(input.trialEndsAt);
    if (d) set.trialEndsAt = d;
  }
  if (input.paidUntil !== undefined) set.paidUntil = date(input.paidUntil);
  if (Object.keys(set).length === 0) throw new Error('Nothing to change');
  const [v] = await db.update(venues).set(set).where(eq(venues.id, venueId)).returning();
  if (!v) throw new Error('Venue not found');
  return planStatus(v);
}
