import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/db';
import { venues, owners, momoPayments } from '../models/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { PLANS, planAllows, type PlanFeature, type PlanId } from '@tabpro/shared';
import {
  isPawapayConfigured, predictProvider, initiateDeposit, getDeposit, failureMessage, PaymentRefusedError, PawapayError,
} from '../lib/pawapay';
import { sendPushToOwner, notifyAdmin } from './push.service';

// Packages (Starter / Pro / Bar+) run on their own, with nobody at Skuzi
// setting anything:
//   • sign-up: the owner picks a package; the free trial has EVERYTHING (Bar+),
//     so they get used to the kitchen screen and stock before it's their choice;
//   • the owner pays from the Plan page with MoMo (pawaPay → Skuzi's account);
//     a payment adds 30 days and sets the package;
//   • reminders 3 days before, on the day, and when things lock;
//   • not paid: 3 days' grace, then the owner's dashboard is behind a wall
//     (waiters and guests keep going); after 10 days guests can't order from
//     their phones any more (they can still see the menu and call the waiter).
// Skuzi takes nothing from sales: guests pay the venue's own MoMo Pay code.

const DAY = 24 * 3600e3;
export const GRACE_DAYS = 3;
export const PAUSE_DAYS = 10;
const REMIND_DAYS = 3;

type Venue = typeof venues.$inferSelect;
export type PlanState = 'trial' | 'paid' | 'grace' | 'locked';

const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Kigali' });

export function planStatus(venue: Venue) {
  const now = Date.now();
  const trialEnds = venue.trialEndsAt ? new Date(venue.trialEndsAt).getTime() : 0;
  const paidUntil = venue.paidUntil ? new Date(venue.paidUntil).getTime() : 0;
  const plan = (venue.plan as PlanId) in PLANS ? (venue.plan as PlanId) : 'basic';
  const runsOutAt = Math.max(trialEnds, paidUntil);
  const daysOver = Math.max(0, Math.floor((now - runsOutAt) / DAY));
  let state: PlanState = paidUntil > now ? 'paid' : trialEnds > now ? 'trial' : daysOver < GRACE_DAYS ? 'grace' : 'locked';
  if (venue.isDemo) state = 'paid';
  return {
    plan,
    planName: PLANS[plan].name,
    priceRwf: PLANS[plan].priceRwf,
    // In the free trial everything is open (Bar+), whatever package was picked.
    effectivePlan: (trialEnds > now || venue.isDemo ? 'elite' : plan) as PlanId,
    trialEndsAt: venue.trialEndsAt,
    trialDaysLeft: Math.max(0, Math.ceil((trialEnds - now) / DAY)),
    paidUntil: venue.paidUntil,
    // When it runs out (end of trial or of the paid month) and days left until then.
    runsOutAt: new Date(runsOutAt).toISOString(),
    daysLeft: Math.max(0, Math.ceil((runsOutAt - now) / DAY)),
    state,
    // The dashboard wall goes up / guest ordering pauses on these dates.
    locksAt: new Date(runsOutAt + GRACE_DAYS * DAY).toISOString(),
    pausesAt: new Date(runsOutAt + PAUSE_DAYS * DAY).toISOString(),
    orderingPaused: !venue.isDemo && state === 'locked' && daysOver >= PAUSE_DAYS,
    momoPayCode: venue.momoPayCode,
  } as const;
}

/** Can this venue use this feature right now (trial = everything)? */
export function venueAllows(venue: Venue, feature: PlanFeature) {
  return planAllows(planStatus(venue).effectivePlan, feature);
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
 * After the trial, paying for a package is how you pick it.
 */
export async function chooseOwnPlan(venueId: string, raw: unknown) {
  const plan = raw as PlanId;
  if (!(plan in PLANS)) throw new Error('Pick Starter, Pro or Bar+');
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new Error('Venue not found');
  const status = planStatus(venue);
  if (status.state !== 'trial') throw new Error('Your free trial has ended. Pay for the package you want below.');
  const trialEndsAt = new Date(new Date(venue.createdAt).getTime() + PLANS[plan].trialDays * DAY);
  const [v] = await db.update(venues).set({ plan, trialEndsAt }).where(eq(venues.id, venueId)).returning();
  return planStatus(v);
}

// ─── Paying with MoMo ─────────────────────────────────────────────────────────

/** Asks the owner's phone for the package price: one month, or a year of Max at 20% off. */
export async function startPlanPayment(venueId: string, input: { plan?: unknown; phone?: unknown; period?: unknown }) {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new Error('Venue not found');
  const plan = (input.plan ?? venue.plan) as PlanId;
  if (!(plan in PLANS)) throw new Error('Pick Starter, Pro or Bar+');
  if (typeof input.phone !== 'string' || !input.phone.trim()) throw new Error('Enter the MoMo number to pay from');
  const yearly = input.period === 'year';
  if (yearly && !PLANS[plan].yearlyRwf) throw new Error('Only Max can be paid for a year');
  const amountRwf = yearly ? PLANS[plan].yearlyRwf! : PLANS[plan].priceRwf;
  const depositId = uuidv4();

  if (venue.isDemo) {
    await db.insert(momoPayments).values({ venueId, type: 'subscription', plan, referenceId: depositId, phone: input.phone, amountRwf, status: 'pending' });
    return { depositId, amountRwf, plan, period: yearly ? 'year' : 'month' };
  }
  if (!isPawapayConfigured()) throw new Error('MoMo payments are not available right now. Try again later.');

  let payer;
  try {
    payer = await predictProvider(input.phone);
  } catch (err: any) {
    throw new Error(err?.message || 'Check the MoMo number');
  }
  await db.insert(momoPayments).values({ venueId, type: 'subscription', plan, referenceId: depositId, phone: payer.phoneNumber, amountRwf, status: 'pending' });
  try {
    await initiateDeposit({
      id: depositId,
      phoneNumber: payer.phoneNumber,
      provider: payer.provider,
      amountRwf,
      customerMessage: `Skuzi ${PLANS[plan].name.replace(/[^A-Za-z0-9 ]/g, '')} ${yearly ? 'year' : 'month'}`.slice(0, 22),
      metadata: { venueId, plan, kind: 'package' },
    });
  } catch (err: any) {
    const code = err instanceof PaymentRefusedError || err instanceof PawapayError ? err.failureCode : undefined;
    await db.update(momoPayments)
      .set({ status: 'failed', momoStatus: `REJECTED:${code ?? 'UNKNOWN_ERROR'}`, resolvedAt: new Date() })
      .where(eq(momoPayments.referenceId, depositId));
    if (err instanceof PaymentRefusedError) throw new Error(err.message.replace(' or pay your waiter', ''));
    console.error('[plan payment]', err?.message);
    throw new Error('MoMo payments are not available right now. Try again later.');
  }
  return { depositId, amountRwf, plan, period: yearly ? 'year' : 'month' };
}

// A payment of the yearly price buys a year; any other buys a month.
const daysPaidFor = (plan: PlanId | null, amountRwf: number) =>
  plan && PLANS[plan]?.yearlyRwf === amountRwf ? 365 : 30;

/**
 * Checks a package payment and, once MoMo confirms it, adds 30 days. Safe to
 * call from the owner's screen, the pawaPay callback and the reconciler at the
 * same time: the month is only added once.
 */
export async function settlePlanPayment(depositId: string) {
  const p = await db.query.momoPayments.findFirst({ where: eq(momoPayments.referenceId, depositId) });
  if (!p || p.type !== 'subscription') throw new Error('Payment not found');
  if (p.status !== 'pending') return { status: p.status, error: p.status === 'failed' ? ownerFailure(p.momoStatus) : undefined };
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, p.venueId) });
  if (!venue) throw new Error('Venue not found');

  let outcome: 'pending' | 'successful' | 'failed';
  let momoStatus = 'COMPLETED';
  if (venue.isDemo) {
    outcome = 'successful';
  } else {
    const r = await getDeposit(depositId);
    momoStatus = r.failureCode ? `${r.rawStatus}:${r.failureCode}` : r.rawStatus;
    outcome = r.status === 'not_found' ? (Date.now() - p.createdAt.getTime() > 10 * 60_000 ? 'failed' : 'pending') : r.status;
  }
  if (outcome === 'pending') return { status: 'pending' as const };
  if (outcome === 'failed') {
    await db.update(momoPayments).set({ status: 'failed', momoStatus, resolvedAt: new Date() })
      .where(and(eq(momoPayments.referenceId, depositId), eq(momoPayments.status, 'pending')));
    return { status: 'failed' as const, error: ownerFailure(momoStatus) };
  }

  const settled = await db.transaction(async (tx) => {
    const [won] = await tx.update(momoPayments).set({ status: 'successful', momoStatus, resolvedAt: new Date() })
      .where(and(eq(momoPayments.referenceId, depositId), eq(momoPayments.status, 'pending'))).returning();
    if (!won) return null;
    const v = (await tx.query.venues.findFirst({ where: eq(venues.id, p.venueId) }))!;
    // Paying early never loses days: the month starts when the trial or the
    // last paid month ends.
    const from = Math.max(Date.now(), v.trialEndsAt ? new Date(v.trialEndsAt).getTime() : 0, v.paidUntil ? new Date(v.paidUntil).getTime() : 0);
    const [after] = await tx.update(venues)
      .set({ plan: p.plan ?? v.plan, paidUntil: new Date(from + daysPaidFor(p.plan, p.amountRwf) * DAY), planNotice: null })
      .where(eq(venues.id, v.id)).returning();
    return after;
  });
  if (settled) {
    const s = planStatus(settled);
    await sendPushToOwner(settled.id, `Paid ✓ ${s.planName}`, `Thank you! ${settled.name} is on ${s.planName} until ${fmtDay(new Date(s.paidUntil!))}.`, { url: '/subscription' }).catch(() => {});
    if (!settled.isDemo) await notifyAdmin(`💰 ${settled.name} paid ${s.planName}`, `${p.amountRwf.toLocaleString('en-US')} RWF by MoMo. Paid until ${fmtDay(new Date(s.paidUntil!))}.`).catch(() => {});
  }
  return { status: 'successful' as const };
}

const ownerFailure = (momoStatus: string | null) =>
  failureMessage(momoStatus?.split(':')[1]).replace(' or pay your waiter', '');

/** Safety net: settles package payments whose owner closed the page. */
export async function reconcilePlanPayments() {
  if (!isPawapayConfigured()) return;
  const open = await db.query.momoPayments.findMany({
    where: and(eq(momoPayments.type, 'subscription'), eq(momoPayments.status, 'pending'), lt(momoPayments.createdAt, new Date(Date.now() - 60_000))),
    limit: 20,
  });
  for (const p of open) {
    await settlePlanPayment(p.referenceId).catch((err) => console.error(`[plan reconcile] ${p.referenceId}:`, err.message));
  }
}

/** The pawaPay deposit callback: is this a package payment? */
export async function isPlanPayment(depositId: string) {
  const p = await db.query.momoPayments.findFirst({ where: eq(momoPayments.referenceId, depositId) });
  return p?.type === 'subscription';
}

// ─── Reminders ────────────────────────────────────────────────────────────────

/** Each reminder goes to the owner once, by push (and on their screens). */
export async function sendPlanReminders() {
  const all = await db.query.venues.findMany({ where: eq(venues.isDemo, false) });
  for (const v of all) {
    const s = planStatus(v);
    const day = s.runsOutAt.slice(0, 10);
    const price = `${s.priceRwf.toLocaleString('en-US')} RWF`;
    let key: string | null = null;
    let title = '';
    let body = '';
    if ((s.state === 'trial' || s.state === 'paid') && s.daysLeft <= REMIND_DAYS) {
      key = `${day}:soon`;
      title = s.state === 'trial' ? `Your free trial ends in ${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'}` : `${s.planName} renews in ${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'}`;
      body = `Pay ${price} with MoMo in Plan to keep ${s.state === 'trial' ? 'everything' : 'Skuzi'} running.`;
    } else if (s.state === 'grace') {
      key = `${day}:due`;
      title = 'Time to pay your Skuzi package';
      body = `Pay ${price} with MoMo by ${fmtDay(new Date(s.locksAt))} to keep your dashboard.`;
    } else if (s.state === 'locked' && !s.orderingPaused) {
      key = `${day}:locked`;
      title = 'Your Skuzi dashboard is locked';
      body = `Pay ${price} with MoMo to open it again. Guests stop ordering from their phones on ${fmtDay(new Date(s.pausesAt))}.`;
    } else if (s.orderingPaused) {
      key = `${day}:paused`;
      title = 'Guests can no longer order with Skuzi';
      body = `Pay ${price} with MoMo and ordering comes back straight away.`;
    }
    if (!key || v.planNotice === key) continue;
    await db.update(venues).set({ planNotice: key }).where(eq(venues.id, v.id));
    await sendPushToOwner(v.id, title, body, { url: '/subscription' }).catch(() => {});
  }
}

// ─── Founder ──────────────────────────────────────────────────────────────────

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

/** Founder: change a venue's package, trial end, or mark it paid (still works by hand). */
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
