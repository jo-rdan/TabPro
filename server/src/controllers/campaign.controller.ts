import { Request, Response } from 'express';
import { getAudience, getCampaigns, getCampaign, createCampaign, cancelCampaign } from '../services/campaign.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

export async function handleGetAudience(req: Request, res: Response) {
  const body: ApiResponse = { success: true, data: await getAudience(req.params.venueId) };
  res.json(body);
}

export async function handleGetCampaigns(req: Request, res: Response) {
  const body: ApiResponse = { success: true, data: await getCampaigns(req.params.venueId) };
  res.json(body);
}

export async function handleGetCampaign(req: Request, res: Response) {
  const c = await getCampaign(req.params.campaignId);
  if (c.venueId !== req.params.venueId) {
    res.status(404).json({ success: false, error: 'Campaign not found' } as ApiResponse);
    return;
  }
  res.json({ success: true, data: c } as ApiResponse);
}

const date = z.string().datetime({ offset: true }).transform((s) => new Date(s));
const createSchema = z.object({
  venueId: z.string().uuid(),
  title: z.string().trim().min(2, "Give it a short name, e.g. Karaoke Friday").max(40, 'Keep the name under 40 characters'),
  message: z.string().trim().min(5, 'Tell guests what\'s on').max(140, 'Keep the message under 140 characters'),
  offerType: z.enum(['none', 'free_item', 'discount_10']),
  offerLabel: z.string().trim().max(30, 'Keep the offer short, e.g. Free shot').optional().nullable(),
  eventAt: date.optional().nullable(),
  audience: z.enum(['regulars', 'everyone']),
  sendAt: date.optional().nullable(),
});

export async function handleCreateCampaign(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const { venueId, ...input } = parsed.data;
  const campaign = await createCampaign(venueId, input);
  res.status(201).json({ success: true, data: campaign } as ApiResponse);
}

export async function handleCancelCampaign(req: Request, res: Response) {
  const c = await getCampaign(req.params.campaignId);
  if (c.venueId !== req.params.venueId) {
    res.status(404).json({ success: false, error: 'Campaign not found' } as ApiResponse);
    return;
  }
  res.json({ success: true, data: await cancelCampaign(c.id) } as ApiResponse);
}
