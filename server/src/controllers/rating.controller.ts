import { Request, Response } from 'express';
import { submitRating, getLeaderboard, getRatingsBreakdown } from '../services/rating.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

const submitRatingSchema = z.object({
  tabId: z.string().uuid(),
  foodScore: z.number().int().min(1).max(5),
  waiterScore: z.number().int().min(1).max(5),
  overallScore: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function handleSubmitRating(req: Request, res: Response) {
  const parsed = submitRatingSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const rating = await submitRating(
    parsed.data.tabId,
    parsed.data.foodScore,
    parsed.data.waiterScore,
    parsed.data.overallScore,
    parsed.data.comment
  );

  const body: ApiResponse = { success: true, data: rating };
  res.status(201).json(body);
}

export async function handleGetLeaderboard(req: Request, res: Response) {
  const leaderboard = await getLeaderboard(req.params.venueId);
  const body: ApiResponse = { success: true, data: leaderboard };
  res.json(body);
}

export async function handleGetRatingsBreakdown(req: Request, res: Response) {
  const { venueId } = req.params;
  const result = await getRatingsBreakdown(venueId);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}
