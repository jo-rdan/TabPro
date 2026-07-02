import { v4 as uuidv4 } from "uuid";
import { db } from "../lib/db";
import { momoPayments, subscriptions } from "../models/schema";
import { eq } from "drizzle-orm";

// ─── Config ───────────────────────────────────────────────────────────────────

const MOMO_BASE_URL =
  process.env.MOMO_BASE_URL || "https://sandbox.momodeveloper.mtn.com";
const MOMO_SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY!;
const MOMO_API_USER = process.env.MOMO_API_USER!;
const MOMO_API_KEY = process.env.MOMO_API_KEY!;
const MOMO_TARGET_ENV = process.env.MOMO_TARGET_ENV || "sandbox"; // 'sandbox' | 'production'
const MOMO_CURRENCY = process.env.MOMO_CURRENCY || "EUR"; // sandbox uses EUR; production uses RWF

// ─── Token cache ──────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const credentials = Buffer.from(`${MOMO_API_USER}:${MOMO_API_KEY}`).toString(
    "base64",
  );

  const res = await fetch(`${MOMO_BASE_URL}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MoMo token error: ${res.status} — ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    status: string;
  };
  cachedToken = data.access_token;
  // expires_in is in seconds; cache with 60s buffer
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

// ─── Request to Pay ───────────────────────────────────────────────────────────

export async function requestToPay(
  venueId: string,
  plan: "basic" | "pro",
  phone: string,
  amountRwf: number,
): Promise<{ referenceId: string }> {
  const token = await getAccessToken();
  const referenceId = uuidv4();

  // Normalize phone: strip leading 0 or +250, keep digits
  const normalizedPhone = phone.replace(/^\+/, "").replace(/^0/, "250");

  // In sandbox, MoMo requires EUR and small amounts; in production use RWF
  const amount = MOMO_TARGET_ENV === "sandbox" ? "1" : String(amountRwf);
  const currency = MOMO_CURRENCY;

  const res = await fetch(`${MOMO_BASE_URL}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": MOMO_TARGET_ENV,
      "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      externalId: venueId,
      payer: {
        partyIdType: "MSISDN",
        partyId: normalizedPhone,
      },
      payerMessage: `TabPro ${plan} plan subscription`,
      payeeNote: `Venue ${venueId} — ${plan}`,
    }),
  });

  if (res.status !== 202) {
    const text = await res.text();
    throw new Error(`MoMo requestToPay failed: ${res.status} — ${text}`);
  }

  // Persist the payment record
  await db.insert(momoPayments).values({
    venueId,
    plan,
    referenceId,
    phone: normalizedPhone,
    amountRwf,
    status: "pending",
  });

  return { referenceId };
}

// ─── Check Payment Status ─────────────────────────────────────────────────────

export async function checkPaymentStatus(referenceId: string): Promise<{
  status: "pending" | "successful" | "failed";
  momoStatus: string;
}> {
  const token = await getAccessToken();

  const res = await fetch(
    `${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": MOMO_TARGET_ENV,
        "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`MoMo status check failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    status: string;
  };
  const momoStatus: string = data.status; // PENDING | SUCCESSFUL | FAILED

  let status: "pending" | "successful" | "failed" = "pending";
  if (momoStatus === "SUCCESSFUL") status = "successful";
  else if (momoStatus === "FAILED") status = "failed";

  // Update DB record
  const payment = await db.query.momoPayments.findFirst({
    where: eq(momoPayments.referenceId, referenceId),
  });

  if (payment && status !== "pending") {
    await db
      .update(momoPayments)
      .set({ status, momoStatus, resolvedAt: new Date() })
      .where(eq(momoPayments.referenceId, referenceId));

    // If successful, upgrade the venue's subscription plan
    if (status === "successful") {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await db
        .update(subscriptions)
        .set({
          plan: payment.plan,
          status: "active",
          currentPeriodEnd: periodEnd,
        })
        .where(eq(subscriptions.venueId, payment.venueId));
    }
  }

  return { status, momoStatus };
}
