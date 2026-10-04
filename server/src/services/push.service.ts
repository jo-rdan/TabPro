import webpush from "web-push";
import { db } from "../lib/db";
import { pushSubscriptions, tableAssignments, tabs, qrStickers } from "../models/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

// Initialize VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@tabpro.app",
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
// The tab's waiter, else the table's assigned waiter. If that person has no
// device signed up (or nobody is assigned), every waiter is told instead so
// the request is never lost.
async function tableWaiterSubs(venueId: string, tableId: string, tabStaffId: string | null) {
  const staffSubs = await db.query.pushSubscriptions.findMany({
    where: and(eq(pushSubscriptions.venueId, venueId), isNotNull(pushSubscriptions.staffId)),
  });
  const staffId =
    tabStaffId ??
    (await db.query.tableAssignments.findFirst({ where: eq(tableAssignments.tableId, tableId) }))?.staffId ??
    null;
  const theirs = staffId ? staffSubs.filter((s) => s.staffId === staffId) : [];
  return theirs.length > 0 ? theirs : staffSubs;
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
  const waiters = toWaiter ? await tableWaiterSubs(venueId, tableId, tabStaffId) : [];
  const waiterEndpoints = new Set(waiters.map((s) => s.endpoint));
  const owners = toOwner ? (await ownerSubs(venueId)).filter((s) => !waiterEndpoints.has(s.endpoint)) : [];
  if (toWaiter) await send(waiters, toWaiter.title, toWaiter.body, STAFF_URL);
  if (toOwner) await send(owners, toOwner.title, toOwner.body, OWNER_URL);
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
