import webpush from "web-push";
import { db } from "../lib/db";
import { pushSubscriptions } from "../models/schema";
import { eq } from "drizzle-orm";
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

export async function saveSubscription(
  venueId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  staffId?: string,
) {
  // Upsert — if endpoint exists, update it
  const existing = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, endpoint),
  });

  if (existing) {
    const [updated] = await db
      .update(pushSubscriptions)
      .set({ p256dh, auth, staffId: staffId ?? null, venueId })
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

export async function sendPushToVenue(
  venueId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  if (!process.env.VAPID_PUBLIC_KEY) return; // Push not configured

  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.venueId, venueId),
  });

  const payload = JSON.stringify({ title, body, data });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      ),
    ),
  );

  // Remove expired/invalid subscriptions
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const statusCode = (result.reason as any)?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, subs[i].id));
      }
    }
  }
}
