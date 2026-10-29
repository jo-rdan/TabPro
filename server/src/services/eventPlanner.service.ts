import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as z from 'zod/v4';
import { db } from '../lib/db';
import { campaigns, menuItems, tables, tabs, venues } from '../models/schema';
import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { categoriesOf } from './kitchen.service';
import { createCampaign } from './campaign.service';

// The AI event planner (Max): it looks at the venue's own numbers (its quiet
// night, its best sellers), comes up with an event, and once the owner taps
// Approve it becomes a campaign (sent to the venue's guests the day before,
// and counted: "14 people came"). The poster is drawn in the owner's app.
//
// The idea comes from Claude when ANTHROPIC_API_KEY is set; otherwise (or if
// the AI fails) from built-in templates filled with the same numbers, so the
// planner always works.

const DAY = 24 * 3600e3;
const KIGALI_MS = 2 * 3600e3;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const VIBES = ['lounge', 'sports', 'family', 'chill', 'club'] as const;
export type Vibe = (typeof VIBES)[number];

const kigali = (d: Date) => new Date(d.getTime() + KIGALI_MS);
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
const rwf = (n: number) => `${n.toLocaleString('en-US')} RWF`;

type Item = { name: string; category: string; priceRwf: number };

/** What the venue's own numbers say: quiet and busy nights, best sellers. */
export async function venueInsights(venueId: string) {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new Error('Venue not found');
  const since = new Date(Date.now() - 56 * DAY);
  const venueTables = await db.query.tables.findMany({ where: eq(tables.venueId, venueId), columns: { id: true } });
  const recent = venueTables.length === 0 ? [] : await db.query.tabs.findMany({
    where: and(inArray(tabs.tableId, venueTables.map((t) => t.id)), gte(tabs.openedAt, since)),
    with: { orders: { with: { items: { with: { menuItem: true } } } } },
  });

  const byDay = new Array(7).fill(0) as number[];
  const byHour = new Array(24).fill(0) as number[];
  const sold = new Map<string, { item: Item; qty: number }>();
  for (const t of recent) {
    for (const o of t.orders) {
      const local = kigali(o.placedAt);
      // A bar's night runs past midnight: orders before 6am belong to the evening before.
      const night = local.getUTCHours() < 6 ? (local.getUTCDay() + 6) % 7 : local.getUTCDay();
      for (const i of o.items) {
        const money = i.unitPriceRwf * i.quantity;
        byDay[night] += money;
        byHour[local.getUTCHours()] += money;
        const key = i.menuItem.name;
        const row = sold.get(key) ?? { item: { name: i.menuItem.name, category: i.menuItem.category, priceRwf: i.unitPriceRwf }, qty: 0 };
        row.qty += i.quantity;
        sold.set(key, row);
      }
    }
  }

  // Only nights the venue is open: its opening hours if set, else nights with sales.
  const hours = venue.openingHours as Record<string, unknown> | null;
  const openDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => (hours ? !!hours[HOURS_KEYS[d]] : byDay[d] > 0));
  const enoughData = openDays.filter((d) => byDay[d] > 0).length >= 3;
  const candidates = enoughData ? openDays : [2, 3]; // new venue: a Tuesday or Wednesday
  const quietDay = candidates.reduce((a, b) => (byDay[b] < byDay[a] ? b : a), candidates[0] ?? 2);
  const busyDay = byDay.indexOf(Math.max(...byDay));
  const quieterPct = enoughData && byDay[busyDay] > 0 ? Math.round((1 - byDay[quietDay] / byDay[busyDay]) * 100) : null;

  const { kitchen } = await categoriesOf(venueId);
  const menu = (await db.query.menuItems.findMany({ where: and(eq(menuItems.venueId, venueId), eq(menuItems.isAvailable, true)) }))
    .map((m) => ({ name: m.name, category: m.category, priceRwf: m.priceRwf }));
  const ranked = [...sold.values()].sort((a, b) => b.qty - a.qty).map((r) => r.item);
  const isFood = (i: Item) => kitchen.includes(i.category);
  // Events are built on everyday items (a beer, a plate), never a 200,000 bottle:
  // the best seller under an everyday price, else the cheapest on the menu.
  const everyday = (pick: (i: Item) => boolean, maxRwf: number) =>
    ranked.find((i) => pick(i) && i.priceRwf <= maxRwf)
    ?? menu.filter((i) => pick(i) && i.priceRwf <= maxRwf).sort((a, b) => a.priceRwf - b.priceRwf)[0]
    ?? menu.filter(pick).sort((a, b) => a.priceRwf - b.priceRwf)[0]
    ?? null;
  const topFood = everyday(isFood, 15000);
  const topDrink = everyday((i) => !isFood(i), 5000);
  const busiestHour = byHour.some((x) => x > 0) ? byHour.indexOf(Math.max(...byHour)) : null;

  return {
    venueName: venue.name,
    location: venue.location,
    vibe: (venue.vibe as Vibe | null) ?? null,
    quietDay: WEEKDAYS[quietDay],
    busyDay: enoughData ? WEEKDAYS[busyDay] : null,
    quieterPct,
    busiestHour,
    topFood,
    topDrink,
    menu: menu.slice(0, 40),
    quietDayIndex: quietDay,
  };
}

type Insights = Awaited<ReturnType<typeof venueInsights>>;

/** The next time this weekday comes round, at least 2 days from now, at hh:mm Kigali time. */
function nextDate(weekday: number, time: string) {
  const [h, m] = time.split(':').map(Number);
  const now = kigali(new Date());
  for (let add = 2; add < 10; add++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add, h, m) - KIGALI_MS);
    if (kigali(d).getUTCDay() === weekday) return d;
  }
  return new Date(Date.now() + 7 * DAY);
}
const dayLabel = (d: Date) => kigali(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export interface EventIdea {
  name: string;
  offer: string;
  why: string;
  caption: string;
  eventAt: string;
  startTime: string;
  source: 'ai' | 'rules';
}

// ─── Built-in ideas (always available, free) ─────────────────────────────────
function ruleIdea(ins: Insights, attempt: number): EventIdea {
  const day = ins.quietDay;
  const food = ins.topFood;
  const drink = ins.topDrink;
  const why = ins.quieterPct !== null && ins.busyDay
    ? `Your ${day}s are ${ins.quieterPct}% quieter than your ${ins.busyDay}s.${food ? ` ${food.name} ${drink ? `and ${drink.name} sell` : 'sells'} the most.` : ''}`
    : `A ${day} event is a good way to bring new guests in while Skuzi learns your busy nights.`;
  const templates: { name: string; offer: string; time: string }[] = [];
  if (food && drink) {
    templates.push({ name: `${day} ${food.name.split(' ')[0]} Night`, offer: `2 ${food.name} + 2 ${drink.name} for ${rwf(roundTo((food.priceRwf + drink.priceRwf) * 2 * 0.85, 500))}`, time: '19:00' });
  }
  if (drink) {
    templates.push({ name: `${day} Afterwork`, offer: `${drink.name} at ${rwf(roundTo(drink.priceRwf * 0.8, 100))} from 5pm to 7pm`, time: '17:00' });
  }
  if (food) {
    templates.push({ name: `Friends' ${day}`, offer: `Come as 4 or more: a free ${food.name} on the table`, time: '19:30' });
  }
  if (templates.length === 0) templates.push({ name: `${day} Night Out`, offer: 'A free welcome drink for every group', time: '19:00' });
  const t = templates[attempt % templates.length];
  const at = nextDate(ins.quietDayIndex, t.time);
  return {
    name: t.name,
    offer: t.offer,
    why,
    caption: `${t.name} at ${ins.venueName}! ${t.offer}. ${dayLabel(at)}, from ${t.time}. See you there!`,
    eventAt: at.toISOString(),
    startTime: t.time,
    source: 'rules',
  };
}

// ─── AI ideas (Claude) ────────────────────────────────────────────────────────
const IdeaSchema = z.object({
  name: z.string(),
  offer: z.string(),
  startTime: z.string(),
  why: z.string(),
  caption: z.string(),
});

const SYSTEM = `You plan events for restaurants and bars in Rwanda that use Skuzi (guests order from their table on their phone).
Your job: turn the venue's quiet night into a fun, realistic event that brings in more guests.
Rules:
- Use only items that are on the venue's menu, with their real prices in Rwandan francs (RWF).
- The offer must be affordable for the venue and for guests: at most 20% off, or one free item for a group. Build it on everyday items (beers, soft drinks, plates), never on expensive bottles.
- The name is catchy and short (2 to 4 words), in English, and fits the venue's vibe.
- startTime is the start time in 24h "HH:MM", between 12:00 and 22:00.
- why is one plain sentence that uses the numbers you are given.
- caption is for Instagram: warm and inviting, under 220 characters, with the date and time, and no hashtags.
- Never promise anything the venue didn't offer (no live music or DJ unless the vibe says club).`;

let client: Anthropic | null = null;
const aiClient = () => (process.env.ANTHROPIC_API_KEY ? (client ??= new Anthropic()) : null);

async function aiIdea(ins: Insights, avoid: string[]): Promise<EventIdea | null> {
  const ai = aiClient();
  if (!ai) return null;
  const at = nextDate(ins.quietDayIndex, '19:00');
  const facts = {
    venue: ins.venueName,
    location: ins.location,
    vibe: ins.vibe ?? 'not set',
    quietNight: ins.quietDay,
    busiestNight: ins.busyDay,
    quietNightIsQuieterBy: ins.quieterPct === null ? 'not enough data yet' : `${ins.quieterPct}%`,
    busiestHour: ins.busiestHour === null ? null : `${ins.busiestHour}:00`,
    bestSellingFood: ins.topFood,
    bestSellingDrink: ins.topDrink,
    eventDate: dayLabel(at),
    menu: ins.menu,
    ideasAlreadyShown: avoid,
  };
  try {
    const response = await ai.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: zodOutputFormat(IdeaSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Plan one event for this venue. Don't repeat an idea already shown.\n\n${JSON.stringify(facts, null, 2)}` }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
    const out = response.parsed_output;
    const time = /^([01]\d|2[0-2]):[0-5]\d$/.test(out.startTime) && out.startTime >= '12:00' ? out.startTime : '19:00';
    const eventAt = nextDate(ins.quietDayIndex, time);
    return {
      name: out.name.slice(0, 60),
      offer: out.offer.slice(0, 160),
      why: out.why.slice(0, 240),
      caption: out.caption.slice(0, 300),
      eventAt: eventAt.toISOString(),
      startTime: time,
      source: 'ai',
    };
  } catch (err: any) {
    console.error('[event planner] AI idea failed:', err?.message);
    return null;
  }
}

/** One idea for the venue's quiet night (AI first, built-in templates as backup). */
export async function suggestEvent(venueId: string, avoid: unknown) {
  const ins = await venueInsights(venueId);
  const shown = Array.isArray(avoid) ? avoid.filter((x): x is string => typeof x === 'string').slice(0, 10) : [];
  const idea = (await aiIdea(ins, shown)) ?? ruleIdea(ins, shown.length);
  return { idea, insights: { quietDay: ins.quietDay, busyDay: ins.busyDay, quieterPct: ins.quieterPct, topFood: ins.topFood?.name ?? null, topDrink: ins.topDrink?.name ?? null } };
}

/**
 * The owner approved: the event becomes a campaign. Guests who said yes to
 * offers get it the day before at 5pm (or right away if that's passed), and
 * Skuzi counts who came.
 */
export async function approveEvent(venueId: string, raw: Partial<EventIdea>) {
  const name = String(raw.name ?? '').trim();
  const offer = String(raw.offer ?? '').trim();
  const caption = String(raw.caption ?? '').trim();
  const eventAt = new Date(String(raw.eventAt ?? ''));
  if (!name || !caption || Number.isNaN(eventAt.getTime())) throw new Error('This idea is missing its name, text or date');
  const local = kigali(eventAt);
  const dayBefore5pm = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - 1, 17) - KIGALI_MS);
  const campaign = await createCampaign(venueId, {
    title: name.slice(0, 60),
    message: (offer && !caption.includes(offer) ? `${caption} ${offer}.` : caption).slice(0, 400),
    offerType: 'none',
    eventAt,
    audience: 'regulars',
    sendAt: dayBefore5pm.getTime() > Date.now() + 120_000 ? dayBefore5pm : null,
  });
  return { campaignId: campaign.id };
}

/** The venue's events (campaigns with a date), newest first, with who came. */
export async function listEvents(venueId: string) {
  const rows = await db.query.campaigns.findMany({
    where: and(eq(campaigns.venueId, venueId), isNotNull(campaigns.eventAt)),
    orderBy: [desc(campaigns.eventAt)],
    limit: 12,
  });
  return rows.map((c) => ({
    id: c.id, name: c.title, text: c.message, eventAt: c.eventAt, status: c.status,
    reached: c.recipientCount, came: c.returnVisits,
  }));
}

/** The poster's look: the venue's vibe and its photos. */
export async function getBrand(venueId: string) {
  const v = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!v) throw new Error('Venue not found');
  return { name: v.name, location: v.location, logoUrl: v.logoUrl, vibe: v.vibe, photos: v.photos ?? [] };
}

export async function setBrand(venueId: string, input: { vibe?: unknown; photos?: unknown }) {
  const set: Partial<typeof venues.$inferInsert> = {};
  if (input.vibe !== undefined) {
    if (!(VIBES as readonly string[]).includes(String(input.vibe))) throw new Error('Pick a vibe');
    set.vibe = String(input.vibe);
  }
  if (input.photos !== undefined) {
    if (!Array.isArray(input.photos) || input.photos.length > 5 || !input.photos.every((u) => typeof u === 'string' && /^https:\/\//.test(u))) {
      throw new Error('Up to 5 photos');
    }
    set.photos = input.photos as string[];
  }
  if (Object.keys(set).length === 0) throw new Error('Nothing to change');
  await db.update(venues).set(set).where(eq(venues.id, venueId));
  return getBrand(venueId);
}
