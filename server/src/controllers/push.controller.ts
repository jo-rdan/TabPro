import { Request, Response } from 'express';
import { saveSubscription } from '../services/push.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

const subscribeSchema = z.object({
  venueId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
});

export async function handleSubscribe(req: Request, res: Response) {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const { venueId, subscription } = parsed.data;
  // A waiter can only register their own device; owners register as the venue.
  const staffId = req.staffMember?.staffId;
  const result = await saveSubscription(
    venueId,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    staffId
  );

  const body: ApiResponse = { success: true, data: result };
  res.status(201).json(body);
}

export function handleGetVapidKey(_req: Request, res: Response) {
  const body: ApiResponse = {
    success: true,
    data: { publicKey: process.env.VAPID_PUBLIC_KEY ?? null },
  };
  res.json(body);
}
