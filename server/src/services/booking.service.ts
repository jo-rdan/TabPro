import crypto from "crypto";
import { db } from "../lib/db";
import { bookings, tables, venues } from "../models/schema";
import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { HttpError } from "../middleware/error.middleware";
import { addDaysKey, bookingSlots, hoursOf, kigaliDateKey, kigaliTime, MAX_DAYS_AHEAD } from "../lib/hours";
import { findOrCreateCustomer, isRwandaMobile, normalizeGuestPhone } from "./customer.service";
import { notifyCustomer, saveGuestSubscription, sendPushToOwner } from "./push.service";
import { broadcastToVenue } from "../lib/websocket";

// Book a table: the guest asks, the owner accepts (or declines), and on the
// night the table shows as reserved. No deposit. Guests hear back by
// notification and can always check their booking's page.
const HOUR = 3_600_000;
// Two bookings on one table must start at least 2 hours apart.
const TABLE_TURN_MS = 2 * HOUR;
// A phone can hold 3 upcoming bookings across Skuzi (stops fake mass-booking).
const MAX_ACTIVE_PER_PHONE = 3;
const ACTIVE = ["pending", "confirmed"] as const;

type Booking = typeof bookings.$inferSelect;
type Venue = typeof venues.$inferSelect;

const dayLabel = (d: Date) =>
  new Date(d.getTime() + 2 * HOUR).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const when = (d: Date) => `${dayLabel(d)}, ${kigaliTime(d)}`;
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const guestUrl = (b: Booking) => `/booking/${b.id}?t=${b.accessToken}`;

function announce(venueId: string, booking: Booking) {
  broadcastToVenue(venueId, {
    type: "booking_update",
    venueId,
    payload: { bookingId: booking.id, status: booking.status },
    timestamp: new Date().toISOString(),
  });
}

/** What a guest may see about their own booking. */
export function guestView(b: Booking, venue: Pick<Venue, "name" | "slug" | "location">, tableLabel?: string | null) {
  return {
    id: b.id,
    token: b.accessToken,
    status: b.status,
    startsAt: b.startsAt,
    date: kigaliDateKey(new Date(b.startsAt.getTime() - 6 * HOUR)),
    time: kigaliTime(b.startsAt),
    partySize: b.partySize,
    name: b.name,
    note: b.note,
    table: b.status === "confirmed" || b.status === "seated" ? tableLabel ?? null : null,
    venue: { name: venue.name, slug: venue.slug, location: venue.location },
  };
}

async function venueBySlug(slug: string) {
  const venue = await db.query.venues.findFirst({ where: eq(venues.slug, slug) });
  if (!venue || !venue.isActive) throw new HttpError(404, "We couldn't find this restaurant");
  return venue;
}

/** The days and times a guest can pick (only the next 30 days). */
export async function availability(slug: string, dateKey: string) {
  const venue = await venueBySlug(slug);
  const today = kigaliDateKey(new Date());
  if (dateKey < addDaysKey(today, -1) || dateKey > addDaysKey(today, MAX_DAYS_AHEAD)) return { open: false, times: [] };
  const slots = bookingSlots(hoursOf(venue.openingHours), dateKey);
  return { open: slots.length > 0, times: slots.map((s) => s.time) };
}

export async function createBooking(input: {
  slug: string; date: string; time: string; partySize: number; name: string; phone: string; note?: string | null; campaignId?: string | null;
}) {
  const venue = await venueBySlug(input.slug);
  if (!venue.bookingsEnabled) throw new HttpError(400, `${venue.name} isn't taking bookings on Skuzi right now`);
  if (!isRwandaMobile(input.phone)) throw new HttpError(400, "Please enter a Rwandan mobile number, e.g. 0788 123 456");
  const today = kigaliDateKey(new Date());
  if (input.date < today || input.date > addDaysKey(today, MAX_DAYS_AHEAD)) {
    throw new HttpError(400, "Please pick a day within the next 30 days");
  }
  const slot = bookingSlots(hoursOf(venue.openingHours), input.date).find((s) => s.time === input.time);
  if (!slot) throw new HttpError(400, "That time isn't available. Please pick another one.");

  const phone = normalizeGuestPhone(input.phone);
  const mine = await db.query.bookings.findMany({
    where: and(eq(bookings.phone, phone), inArray(bookings.status, [...ACTIVE]), gt(bookings.startsAt, new Date())),
  });
  const sameNight = mine.find(
    (b) => b.venueId === venue.id && Math.abs(b.startsAt.getTime() - slot.startsAt.getTime()) < 12 * HOUR,
  );
  if (sameNight) {
    throw new HttpError(409, `You already have a booking here on ${dayLabel(sameNight.startsAt)} at ${kigaliTime(sameNight.startsAt)}`);
  }
  if (mine.length >= MAX_ACTIVE_PER_PHONE) {
    throw new HttpError(429, "You already have 3 upcoming bookings. Cancel one to book another.");
  }

  const customer = await findOrCreateCustomer(phone, input.name);
  const [booking] = await db
    .insert(bookings)
    .values({
      venueId: venue.id,
      customerId: customer.id,
      name: input.name.trim(),
      phone,
      partySize: input.partySize,
      startsAt: slot.startsAt,
      note: input.note?.trim() || null,
      accessToken: crypto.randomBytes(18).toString("base64url"),
      campaignId: input.campaignId ?? null,
    })
    .returning();

  announce(venue.id, booking);
  await sendPushToOwner(
    venue.id,
    `📅 New booking: ${booking.name}, ${people(booking.partySize)}`,
    `${when(booking.startsAt)}. Tap to accept or decline.`,
    { url: "/bookings" },
  ).catch(() => {});
  return guestView(booking, venue);
}

async function guestBooking(id: string, token: string) {
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id), with: { venue: true, table: true } });
  const ok = b && token && b.accessToken.length === token.length && crypto.timingSafeEqual(Buffer.from(b.accessToken), Buffer.from(token));
  if (!b || !ok) throw new HttpError(404, "We couldn't find this booking");
  return b;
}

export async function getBookingForGuest(id: string, token: string) {
  const b = await guestBooking(id, token);
  return guestView(b, b.venue, b.table?.label);
}

export async function cancelBookingByGuest(id: string, token: string) {
  const b = await guestBooking(id, token);
  if (!ACTIVE.includes(b.status as any)) throw new HttpError(400, "This booking can't be cancelled any more");
  const [done] = await db.update(bookings).set({ status: "cancelled", decidedAt: new Date() }).where(eq(bookings.id, b.id)).returning();
  announce(b.venueId, done);
  await sendPushToOwner(b.venueId, `❌ Booking cancelled: ${b.name}`, `${people(b.partySize)}, ${when(b.startsAt)}. The guest cancelled.`, { url: "/bookings" }).catch(() => {});
  return guestView(done, b.venue, b.table?.label);
}

// ─── The owner's side ──────────────────────────────────────────────────────────

/** Bookings for one night (06:00 to 06:00 Kigali), plus how many still wait for an answer. */
export async function listBookings(venueId: string, dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d, 4)); // 06:00 Kigali
  const to = new Date(from.getTime() + 24 * HOUR);
  const list = await db.query.bookings.findMany({
    where: and(eq(bookings.venueId, venueId), gte(bookings.startsAt, from), lt(bookings.startsAt, to)),
    with: { table: true },
    orderBy: [asc(bookings.startsAt)],
  });
  return {
    date: dateKey,
    bookings: list.map((b) => ({
      id: b.id, status: b.status, name: b.name, phone: b.phone, partySize: b.partySize, note: b.note,
      startsAt: b.startsAt, time: kigaliTime(b.startsAt), table: b.table ? { id: b.table.id, label: b.table.label } : null,
      seatedAt: b.seatedAt, createdAt: b.createdAt,
    })),
    pendingTotal: await pendingCount(venueId),
  };
}

export async function pendingCount(venueId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.venueId, venueId), eq(bookings.status, "pending"), gt(bookings.startsAt, new Date())));
  return r?.n ?? 0;
}

async function ownersBooking(venueId: string, id: string) {
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.venueId, venueId)), with: { venue: true } });
  if (!b) throw new HttpError(404, "Booking not found");
  return b;
}

async function checkTable(venueId: string, bookingId: string, tableId: string, startsAt: Date) {
  const table = await db.query.tables.findFirst({ where: and(eq(tables.id, tableId), eq(tables.venueId, venueId)) });
  if (!table) throw new HttpError(400, "That table isn't in your venue");
  const clash = await db.query.bookings.findFirst({
    where: and(
      eq(bookings.tableId, tableId),
      inArray(bookings.status, ["confirmed", "seated"]),
      ne(bookings.id, bookingId),
      gt(bookings.startsAt, new Date(startsAt.getTime() - TABLE_TURN_MS)),
      lt(bookings.startsAt, new Date(startsAt.getTime() + TABLE_TURN_MS)),
    ),
  });
  if (clash) throw new HttpError(409, `${table.label} is already booked at ${kigaliTime(clash.startsAt)} (${clash.name}). Pick another table.`);
  return table;
}

export async function acceptBooking(venueId: string, id: string, tableId?: string | null) {
  const b = await ownersBooking(venueId, id);
  if (b.status !== "pending") throw new HttpError(400, b.status === "confirmed" ? "Already accepted" : "This booking is no longer waiting for an answer");
  if (b.startsAt.getTime() < Date.now() - HOUR) throw new HttpError(400, "This booking's time has passed");
  const table = tableId ? await checkTable(venueId, b.id, tableId, b.startsAt) : null;
  const [done] = await db
    .update(bookings)
    .set({ status: "confirmed", tableId: table?.id ?? null, decidedAt: new Date() })
    .where(and(eq(bookings.id, b.id), eq(bookings.status, "pending")))
    .returning();
  if (!done) throw new HttpError(409, "Someone else just answered this booking");
  announce(venueId, done);
  if (done.customerId) {
    await notifyCustomer(done.customerId, `✅ ${b.venue.name} confirmed your table`, `${when(done.startsAt)}, ${people(done.partySize)}. See you there!`, guestUrl(done)).catch(() => {});
  }
  return done;
}

export async function setBookingTable(venueId: string, id: string, tableId: string | null) {
  const b = await ownersBooking(venueId, id);
  if (b.status !== "confirmed") throw new HttpError(400, "Only accepted bookings get a table");
  const table = tableId ? await checkTable(venueId, b.id, tableId, b.startsAt) : null;
  const [done] = await db.update(bookings).set({ tableId: table?.id ?? null }).where(eq(bookings.id, b.id)).returning();
  announce(venueId, done);
  return done;
}

export async function declineBooking(venueId: string, id: string) {
  const b = await ownersBooking(venueId, id);
  if (!ACTIVE.includes(b.status as any)) throw new HttpError(400, "This booking is already closed");
  const wasConfirmed = b.status === "confirmed";
  const [done] = await db.update(bookings).set({ status: wasConfirmed ? "cancelled" : "declined", decidedAt: new Date() }).where(eq(bookings.id, b.id)).returning();
  announce(venueId, done);
  if (done.customerId) {
    await notifyCustomer(
      done.customerId,
      wasConfirmed ? `${b.venue.name} had to cancel your booking` : `${b.venue.name} can't take your booking`,
      `${when(done.startsAt)}, ${people(done.partySize)}. Sorry! Try another time or another place on Skuzi.`,
      guestUrl(done),
    ).catch(() => {});
  }
  return done;
}

/** For the Tables screen: tonight's accepted bookings, by table. */
export async function tableReservations(venueId: string) {
  const now = Date.now();
  const list = await db.query.bookings.findMany({
    where: and(
      eq(bookings.venueId, venueId),
      inArray(bookings.status, ["confirmed", "seated"]),
      gt(bookings.startsAt, new Date(now - 3 * HOUR)),
      lt(bookings.startsAt, new Date(now + 12 * HOUR)),
    ),
    orderBy: [asc(bookings.startsAt)],
  });
  return list
    .filter((b) => b.tableId)
    .map((b) => ({ tableId: b.tableId!, name: b.name, partySize: b.partySize, time: kigaliTime(b.startsAt), startsAt: b.startsAt, status: b.status }));
}

/**
 * Guests sat down at a table: if it's a booking, mark it arrived and tell the
 * owner. Matches the same guest first, then the table's own booking.
 */
export async function onGuestSeated(venueId: string, tableId: string, customerId: string, tableLabel: string) {
  const now = Date.now();
  const candidates = await db.query.bookings.findMany({
    where: and(
      eq(bookings.venueId, venueId),
      eq(bookings.status, "confirmed"),
      gt(bookings.startsAt, new Date(now - 3 * HOUR)),
      lt(bookings.startsAt, new Date(now + 2 * HOUR)),
    ),
  });
  const b = candidates.find((c) => c.customerId === customerId) ?? candidates.find((c) => c.tableId === tableId);
  if (!b) return null;
  const [done] = await db.update(bookings).set({ status: "seated", seatedAt: new Date(), tableId: b.tableId ?? tableId }).where(and(eq(bookings.id, b.id), eq(bookings.status, "confirmed"))).returning();
  if (!done) return null;
  announce(venueId, done);
  await sendPushToOwner(venueId, `🪑 ${b.name} arrived`, `Booking for ${people(b.partySize)}, ${tableLabel}.`, { url: "/bookings" }).catch(() => {});
  return done;
}

/** Every minute: expire unanswered requests, remind guests 2 hours before. */
export async function runBookingJobs() {
  const now = new Date();
  const expired = await db
    .update(bookings)
    .set({ status: "expired", decidedAt: now })
    .where(and(eq(bookings.status, "pending"), lte(bookings.startsAt, now)))
    .returning();
  for (const b of expired) {
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, b.venueId) });
    announce(b.venueId, b);
    await sendPushToOwner(b.venueId, `⏰ Booking request expired: ${b.name}`, `${people(b.partySize)}, ${when(b.startsAt)}. It wasn't answered in time.`, { url: "/bookings" }).catch(() => {});
    if (b.customerId && venue) {
      await notifyCustomer(b.customerId, `${venue.name} didn't confirm in time`, `Your request for ${when(b.startsAt)} wasn't answered. Sorry! You can call them or book again.`, guestUrl(b)).catch(() => {});
    }
  }
  const soon = await db.query.bookings.findMany({
    where: and(
      eq(bookings.status, "confirmed"),
      isNull(bookings.reminderSentAt),
      gt(bookings.startsAt, now),
      lte(bookings.startsAt, new Date(now.getTime() + 2 * HOUR)),
    ),
    with: { venue: true, table: true },
  });
  for (const b of soon) {
    const [claimed] = await db.update(bookings).set({ reminderSentAt: now }).where(and(eq(bookings.id, b.id), isNull(bookings.reminderSentAt))).returning();
    if (!claimed || !b.customerId) continue;
    await notifyCustomer(b.customerId, `⏰ See you at ${kigaliTime(b.startsAt)}!`, `${b.venue.name}${b.table ? `, ${b.table.label}` : ""}, ${people(b.partySize)}.`, guestUrl(b)).catch(() => {});
  }
}

/** The guest's phone wants to hear the answer: tie this device to the booking's guest. */
export async function addBookingDevice(id: string, token: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const b = await guestBooking(id, token);
  if (!b.customerId) throw new HttpError(400, "Notifications aren't available for this booking");
  await saveGuestSubscription(b.customerId, b.venueId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
  return { ok: true };
}
