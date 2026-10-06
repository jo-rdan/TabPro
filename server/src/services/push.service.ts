import webpush from "web-push";
import { db } from "../lib/db";
import { pushSubscriptions, tableAssignments, tabs, qrStickers, owners, venues, staff } from "../models/schema";
import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

// Initialize VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:info@tabpro.lol",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Where tapping the notification takes you.
const OWNER_URL = "/dashboard";
const STAFF_URL = "/waiter/orders";

type Sub = typeof pushSubscriptions.$inferSelect;

// One browser can be signed up twice: once as the owner and once as a waiter
// (e.g. the founder's phone during a demo), so a row is (endpoint, staffId).
export async function saveSubscription(
  venueId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  staffId?: string,
) {
  const existing = await db.query.pushSubscriptions.findFirst({
    where: and(
      eq(pushSubscriptions.endpoint, endpoint),
      staffId ? eq(pushSubscriptions.staffId, staffId) : isNull(pushSubscriptions.staffId),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(pushSubscriptions)
      .set({ p256dh, auth, venueId })
      .where(eq(pushSubscriptions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(pushSubscriptions)
    .values({ venueId, endpoint, p256dh, auth, staffId: staffId ?? null })
    .returning();

  return created;
}

async function send(subs: Sub[], title: string, body: string, url: string, data?: Record<string, unknown>) {
  if (!pushEnabled() || subs.length === 0) return;
  // The same device can hold an owner and a waiter row: notify it once.
  const unique = [...new Map(subs.map((s) => [s.endpoint, s])).values()];
  const payload = JSON.stringify({ title, body, data: { ...data, url } });

  const results = await Promise.allSettled(
    unique.map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload),
    ),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== "rejected") continue;
    const statusCode = (result.reason as any)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // The browser unsubscribed or expired: forget it.
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, unique[i].endpoint));
    } else {
      console.error("[push] send failed", statusCode ?? "", (result.reason as any)?.body ?? (result.reason as any)?.message);
    }
  }
}

// ─── Who to notify ────────────────────────────────────────────────────────────
// The table's waiter (the tab's waiter, else the assigned one) on their own
// phone. If they have no smartphone, or no device signed up, a manager covers
// for them; with no manager either, the owner does (no smartphone) or every
// waiter is told (just no device yet), so a request is never lost.
type Route = { subs: Sub[]; ownerCovers: boolean; coveringFor: string | null };

async function tableWaiterRoute(venueId: string, tableId: string, tabStaffId: string | null): Promise<Route> {
  const staffSubs = await db.query.pushSubscriptions.findMany({
    where: and(eq(pushSubscriptions.venueId, venueId), isNotNull(pushSubscriptions.staffId)),
  });
  const staffId =
    tabStaffId ??
    (await db.query.tableAssignments.findFirst({ where: eq(tableAssignments.tableId, tableId) }))?.staffId ??
    null;
  const waiter = staffId ? await db.query.staff.findFirst({ where: eq(staff.id, staffId) }) : null;

  if (waiter?.hasSmartphone) {
    const theirs = staffSubs.filter((s) => s.staffId === waiter.id);
    if (theirs.length > 0) return { subs: theirs, ownerCovers: false, coveringFor: null };
  }

  const managers = await db.query.staff.findMany({
    where: and(eq(staff.venueId, venueId), eq(staff.role, 'manager'), eq(staff.isActive, true)),
    columns: { id: true },
  });
  const managerIds = new Set(managers.map((m) => m.id));
  const managerSubs = staffSubs.filter((s) => s.staffId && managerIds.has(s.staffId));
  const coveringFor = waiter && waiter.role === 'waiter' ? waiter.name : null;
  if (managerSubs.length > 0) return { subs: managerSubs, ownerCovers: false, coveringFor };
  if (waiter && !waiter.hasSmartphone) return { subs: [], ownerCovers: true, coveringFor };
  return { subs: staffSubs, ownerCovers: false, coveringFor: null };
}

function ownerSubs(venueId: string) {
  return db.query.pushSubscriptions.findMany({
    where: and(eq(pushSubscriptions.venueId, venueId), isNull(pushSubscriptions.staffId), isNull(pushSubscriptions.tabId)),
  });
}

type Message = { title: string; body: string };

// Something happened at a table: tell its waiter and the owner. A phone that
// is signed in as both (the founder's, during a demo) gets the waiter's alert only.
// Pass null to skip the waiter or the owner for a given event.
export async function notifyTable(
  venueId: string,
  tableId: string,
  tabStaffId: string | null,
  toWaiter: Message | null,
  toOwner: Message | null,
) {
  if (!pushEnabled()) return;
  const route = toWaiter ? await tableWaiterRoute(venueId, tableId, tabStaffId) : null;
  // Whoever covers for a waiter without a phone sees whose table it is.
  const forWaiter = toWaiter && route?.coveringFor ? { ...toWaiter, body: `${toWaiter.body} (${route.coveringFor}'s table)` } : toWaiter;

  const waiters = route?.subs ?? [];
  const waiterEndpoints = new Set(waiters.map((s) => s.endpoint));
  const owners = (await ownerSubs(venueId)).filter((s) => !waiterEndpoints.has(s.endpoint));
  if (forWaiter && waiters.length > 0) await send(waiters, forWaiter.title, forWaiter.body, STAFF_URL);

  // No manager to cover a waiter without a phone: the owner gets the waiter's
  // (actionable) alert instead of the usual owner one.
  const ownerMessage = route?.ownerCovers ? forWaiter : toOwner;
  if (ownerMessage) await send(owners, ownerMessage.title, ownerMessage.body, OWNER_URL);
}

// ─── Guests ───────────────────────────────────────────────────────────────────
// A guest can ask to be told when their order is ready. Their phone is tied to
// their tab only, and tapping the alert brings them back to their table's menu.
export async function saveTabSubscription(tabId: string, endpoint: string, p256dh: string, auth: string) {
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId), with: { table: true } });
  if (!tab || tab.status === "closed") throw new Error("This bill is already closed");
  const existing = await db.query.pushSubscriptions.findFirst({
    where: and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.tabId, tabId)),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(pushSubscriptions)
    .values({ venueId: tab.table.venueId, tabId, endpoint, p256dh, auth })
    .returning();
  return created;
}

export async function notifyGuest(tabId: string, message: Message, url?: string) {
  if (!pushEnabled()) return;
  const subs = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.tabId, tabId) });
  if (subs.length === 0) return;
  let target = url;
  if (!target) {
    const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId) });
    const sticker = tab ? await db.query.qrStickers.findFirst({ where: eq(qrStickers.tableId, tab.tableId) }) : null;
    target = sticker ? `/t/${sticker.code}` : "/";
  }
  await send(subs, message.title, message.body, target);
}

// ─── The owner only ───────────────────────────────────────────────────────────
export async function sendPushToOwner(
  venueId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  if (!pushEnabled()) return;
  await send(await ownerSubs(venueId), title, body, OWNER_URL, data);
}

// ─── Skuzi's own team (the founder) ─────────────────────────────────────────
// Website leads go to the owner account named by ADMIN_EMAIL, on every device
// where that account turned on notifications.
export async function notifyAdmin(title: string, body: string) {
  if (!pushEnabled()) return;
  const email = (process.env.ADMIN_EMAIL || "jordankayinamura@gmail.com").toLowerCase();
  const owner = await db.query.owners.findFirst({ where: eq(owners.email, email) });
  if (!owner) return;
  const ownerVenues = await db.query.venues.findMany({ where: eq(venues.ownerId, owner.id), columns: { id: true } });
  if (ownerVenues.length === 0) return;
  const subs = await db.query.pushSubscriptions.findMany({
    where: and(
      inArray(pushSubscriptions.venueId, ownerVenues.map((v) => v.id)),
      isNull(pushSubscriptions.staffId),
      isNull(pushSubscriptions.tabId),
    ),
  });
  await send(subs, title, body, OWNER_URL);
}
