import { Request, Response } from 'express';
import { getSubscription, updatePlan } from '../services/subscription.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

export async function handleGetSubscription(req: Request, res: Response) {
  const sub = await getSubscription(req.params.venueId);
  const body: ApiResponse = { success: true, data: sub };
  res.json(body);
}

export async function handleUpdatePlan(req: Request, res: Response) {
  const parsed = z.object({ plan: z.enum(['basic', 'pro']) }).safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: 'Invalid plan' };
    res.status(400).json(body);
    return;
  }
  const updated = await updatePlan(req.params.venueId, parsed.data.plan);
  const body: ApiResponse = { success: true, data: updated };
  res.json(body);
}
