import { Request, Response } from 'express';
import { requestToPay, checkPaymentStatus } from '../services/momo.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

const initiateSchema = z.object({
  plan: z.enum(['basic', 'pro']),
  phone: z.string().min(9),
});

const PLAN_PRICES: Record<'basic' | 'pro', number> = {
  basic: 25000,
  pro: 45000,
};

export async function handleInitiatePayment(req: Request, res: Response) {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: 'Invalid request' };
    res.status(400).json(body);
    return;
  }

  const { plan, phone } = parsed.data;
  const venueId = req.params.venueId;
  const amountRwf = PLAN_PRICES[plan];

  try {
    const { referenceId } = await requestToPay(venueId, plan, phone, amountRwf);
    const body: ApiResponse = { success: true, data: { referenceId } };
    res.json(body);
  } catch (err: any) {
    console.error('MoMo initiate error:', err.message);
    const body: ApiResponse = { success: false, error: 'Payment initiation failed. Check the phone number and try again.' };
    res.status(500).json(body);
  }
}

export async function handleCheckPayment(req: Request, res: Response) {
  const { referenceId } = req.params;

  try {
    const result = await checkPaymentStatus(referenceId);
    const body: ApiResponse = { success: true, data: result };
    res.json(body);
  } catch (err: any) {
    console.error('MoMo check error:', err.message);
    const body: ApiResponse = { success: false, error: 'Could not check payment status.' };
    res.status(500).json(body);
  }
}
