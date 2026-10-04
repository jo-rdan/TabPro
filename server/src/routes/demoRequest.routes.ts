import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponse } from '@tabpro/shared';
import { createDemoRequest } from '../services/demoRequest.service';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  venueName: z.string().trim().min(2, 'Please enter your venue name').max(120),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{7,18}$/, 'Please enter a phone number we can call'),
  area: z.string().trim().max(80).optional(),
  bestTime: z.string().trim().max(40).optional(),
});

// Public form on the website. A small per-address limit keeps bots from spamming.
const recent = new Map<string, number[]>();
const LIMIT = 5;
const WINDOW_MS = 60 * 60_000;

router.post('/', async (req: Request, res: Response) => {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) {
    const body: ApiResponse = { success: false, error: 'Too many requests. Please message us on WhatsApp instead.' };
    res.status(429).json(body);
    return;
  }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  recent.set(key, [...hits, now]);
  await createDemoRequest(parsed.data);
  const body: ApiResponse = { success: true, data: null };
  res.status(201).json(body);
});

export default router;
