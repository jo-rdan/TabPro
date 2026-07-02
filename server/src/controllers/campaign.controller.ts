import { Request, Response } from 'express';
import { getAudience, getCampaigns, createCampaign, sendCampaign } from '../services/campaign.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

export async function handleGetAudience(req: Request, res: Response) {
  const { venueId } = req.params;
  const audience = await getAudience(venueId);
  const body: ApiResponse = { success: true, data: audience };
  res.json(body);
}

export async function handleGetCampaigns(req: Request, res: Response) {
  const list = await getCampaigns(req.params.venueId);
  const body: ApiResponse = { success: true, data: list };
  res.json(body);
}

export async function handleCreateCampaign(req: Request, res: Response) {
  const parsed = z.object({
    venueId: z.string().uuid(),
    message: z.string().min(1).max(160),
  }).safeParse(req.body);

  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const campaign = await createCampaign(parsed.data.venueId, parsed.data.message);
  const body: ApiResponse = { success: true, data: campaign };
  res.status(201).json(body);
}

export async function handleSendCampaign(req: Request, res: Response) {
  const { campaignId, venueId } = req.params;
  const result = await sendCampaign(campaignId, venueId);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}
