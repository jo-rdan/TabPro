import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { PLANS, planPrice, type PlanId } from '@tabpro/shared';
import { db } from '../lib/db';
import { momoPayments, venues } from '../models/schema';
import { creditPlanPayment, isFounding } from './plan.service';

// Paying the package by card (Lemon Squeezy). The owner subscribes once on
// Lemon Squeezy's page; it then takes the money itself every month, 6 months
// or year, and each payment adds its days here, like a MoMo payment does.
//
// Setup (Render environment):
//   LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_WEBHOOK_SECRET
//   LEMONSQUEEZY_VARIANTS = {"basic:month":"123","basic:half":"…","basic:year":"…","pro:month":…,"elite:year":…}
// Founding venues paying for Max are sent to the Pro variants (Max at the Pro price).

export type Period = 'month' | 'half' | 'year';
const API = 'https://api.lemonsqueezy.com/v1';

function variants(): Record<string, string> {
  try { return JSON.parse(process.env.LEMONSQUEEZY_VARIANTS || '{}'); } catch { return {}; }
}

export const isCardConfigured = () =>
  !!(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID && process.env.LEMONSQUEEZY_WEBHOOK_SECRET && Object.keys(variants()).length);

const rwfFor = (plan: PlanId, period: Period, founding: boolean) => {
  const p = planPrice(plan, founding);
  return (period === 'year' ? p.yearlyRwf : period === 'half' ? p.sixMonthRwf : p.priceRwf) ?? p.priceRwf;
};

/** A Lemon Squeezy checkout link for this venue's package. */
export async function startCardCheckout(venueId: string, input: { plan?: unknown; period?: unknown }) {
  if (!isCardConfigured()) throw new Error('Card payments are not available yet. Pay with MoMo for now.');
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new Error('Venue not found');
  const plan = (input.plan ?? venue.plan) as PlanId;
  if (!(plan in PLANS)) throw new Error('Pick Go, Pro or Max');
  const period: Period = input.period === 'year' ? 'year' : input.period === 'half' ? 'half' : 'month';
  const priceAs = plan === 'elite' && isFounding(venueId) ? 'pro' : plan;
  const variant = variants()[`${priceAs}:${period}`];
  if (!variant) throw new Error('This package can not be paid by card yet. Pay with MoMo for now.');

  const res = await fetch(`${API}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: { custom: { venue_id: venueId, plan, period } },
          product_options: { redirect_url: `${process.env.CLIENT_URL ?? 'https://skuzi.xyz'}/subscription?card=done` },
        },
        relationships: {
          store: { data: { type: 'stores', id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: 'variants', id: String(variant) } },
        },
      },
    }),
  });
  const body: any = await res.json().catch(() => null);
  const url = body?.data?.attributes?.url;
  if (!res.ok || !url) {
    console.error('[card checkout]', res.status, JSON.stringify(body?.errors ?? body).slice(0, 300));
    throw new Error('Card payments are not available right now. Pay with MoMo or try again later.');
  }
  return { url };
}

/** Is this webhook really from Lemon Squeezy? (HMAC of the raw body.) */
export function verifyCardWebhook(raw: Buffer, signature: string | undefined) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(digest, 'hex');
  const b = Buffer.from(signature, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// A card invoice id → a stable uuid, so the same payment is never added twice.
const refFor = (invoiceId: string) => {
  const h = crypto.createHash('sha256').update(`lemonsqueezy:${invoiceId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/** Every paid card invoice (first one and each renewal) adds its days. */
export async function handleCardWebhook(event: any) {
  const name = event?.meta?.event_name;
  if (name !== 'subscription_payment_success') return;
  const custom = event?.meta?.custom_data ?? {};
  const venueId = custom.venue_id as string | undefined;
  const plan = custom.plan as PlanId | undefined;
  const period: Period = custom.period === 'year' ? 'year' : custom.period === 'half' ? 'half' : 'month';
  const invoiceId = String(event?.data?.id ?? '');
  if (!venueId || !plan || !(plan in PLANS) || !invoiceId) return;
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) return;

  const referenceId = refFor(invoiceId);
  await db.insert(momoPayments).values({
    venueId, type: 'subscription', plan, referenceId, phone: 'card',
    amountRwf: rwfFor(plan, period, isFounding(venueId)), status: 'pending',
  }).onConflictDoNothing();
  await creditPlanPayment(referenceId, `CARD:${invoiceId}`, 'card');
}
