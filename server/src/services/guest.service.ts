import crypto from "crypto";
import { db } from "../lib/db";
import { customers, guestLinkCodes, tabs, tabMembers } from "../models/schema";
import { normalizeGuestPhone } from "./customer.service";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { HttpError } from "../middleware/error.middleware";
import { walletFor } from "./wallet.service";
import { signGuestToken } from "../middleware/auth.middleware";
import { guestHasDevice, saveGuestSubscription } from "./push.service";

// "Want invites to Kigali's best nights?" A guest says yes at their table, right
// after paying. Their phone gets a guest token (stored on the phone) so they can
// connect devices and switch invites off any time. Their number is never shown
// to any venue.
type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
const DAY = 86_400_000;

async function lastVenueOf(customerId: string) {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.customerId, customerId),
    orderBy: [desc(tabs.openedAt)],
    with: { table: true },
  });
  return tab?.table.venueId ?? null;
}

/** Yes (or no) to invites, from a guest's tab of the last 24 hours. */
export async function setInvitesFromTab(tabId: string, optIn: boolean, subscription?: PushSub | null, phone?: string | null) {
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId), with: { table: true, customer: true } });
  if (!tab || tab.openedAt.getTime() < Date.now() - DAY) throw new HttpError(404, "Please scan your table again");
  // The guest on THIS phone: a friend who joined the bill says yes for
  // themselves, not for whoever opened it. Only people on the bill count.
  let guest = tab.customer;
  if (phone) {
    const me = await db.query.customers.findFirst({ where: eq(customers.phone, normalizeGuestPhone(phone)) });
    const onBill = me && (me.id === tab.customerId
      || !!(await db.query.tabMembers.findFirst({ where: and(eq(tabMembers.tabId, tabId), eq(tabMembers.customerId, me.id)) })));
    if (me && onBill) guest = me;
  }
  // Walk-ins opened by a waiter have a placeholder number: nothing to invite.
  if (!/^07\d{8}$/.test(guest.phone)) throw new HttpError(400, "Invites need your own phone number");
  await db
    .update(customers)
    .set({ invitesOptIn: optIn, invitesOptInAt: optIn ? new Date() : null })
    .where(eq(customers.id, guest.id));
  if (subscription) {
    await saveGuestSubscription(guest.id, tab.table.venueId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
  }
  return { guestToken: signGuestToken(guest.id), name: guest.name, invitesOptIn: optIn };
}

export async function getGuest(customerId: string) {
  const c = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
  if (!c) throw new HttpError(401, "Please open Skuzi from your table again");
  return { name: c.name, invitesOptIn: c.invitesOptIn, hasDevice: await guestHasDevice(c.id), wallet: await walletFor(c.phone) };
}

export async function setInvites(customerId: string, optIn: boolean) {
  await db
    .update(customers)
    .set({ invitesOptIn: optIn, invitesOptInAt: optIn ? new Date() : null })
    .where(eq(customers.id, customerId));
  return getGuest(customerId);
}

export async function addDevice(customerId: string, subscription: PushSub) {
  const venueId = await lastVenueOf(customerId);
  if (!venueId) throw new HttpError(400, "Please open Skuzi from your table first");
  await saveGuestSubscription(customerId, venueId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
  return getGuest(customerId);
}

// iPhone keeps Safari and the Home Screen icon apart, so a one-time code
// carries the guest across: made in Safari, used once by the icon.
const CODE_TTL_MS = 30 * 60_000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function makeLinkCode(customerId: string) {
  const bytes = crypto.randomBytes(10);
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  await db.insert(guestLinkCodes).values({ code, customerId, expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return { code };
}

export async function claimLinkCode(code: string) {
  const [used] = await db
    .update(guestLinkCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(guestLinkCodes.code, code), isNull(guestLinkCodes.usedAt), gt(guestLinkCodes.expiresAt, new Date())))
    .returning();
  if (!used) throw new HttpError(404, "This link has expired. Open Skuzi at your next visit to connect.");
  const guest = await getGuest(used.customerId);
  return { guestToken: signGuestToken(used.customerId), ...guest };
}
