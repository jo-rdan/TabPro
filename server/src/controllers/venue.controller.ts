import { Request, Response } from 'express';
import { createVenue, getVenuesByOwner, updateVenueLogo, updateVenueMomoPhone, acceptVenueTerms } from '../services/venue.service';
import { VENUE_TERMS_VERSION } from '../lib/venueTerms';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

// Where the venue's share of MoMo payments is sent. Rwanda MTN (078/079) or
// Airtel (072/073), stored as 07XXXXXXXX.
const momoPhoneSchema = z
  .string({ required_error: 'MoMo payout number is required' })
  .transform((p) => p.replace(/\D/g, '').replace(/^250/, '0'))
  .refine((p) => /^07[2389]\d{7}$/.test(p), 'Payout number must be a Rwandan MTN or Airtel number, e.g. 0788123456');

const createVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required').max(100),
  location: z.string().max(200).optional(),
  momoPhone: momoPhoneSchema,
  // The Skuzi app always sends this (its button stays off until "I agree" is
  // ticked). The old TabPro site doesn't; those owners agree in-app later.
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please agree to the Skuzi venue terms' }) }).optional(),
});

export async function handleCreateVenue(req: Request, res: Response) {
  const parsed = createVenueSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const created = await createVenue(req.owner!.ownerId, parsed.data.name, parsed.data.location, parsed.data.momoPhone);
  const venue = parsed.data.acceptTerms ? await acceptVenueTerms(created.id, req.owner!.ownerId, VENUE_TERMS_VERSION) : null;
  const body: ApiResponse = { success: true, data: { ...created, ...venue } };
  res.status(201).json(body);
}

export async function handleGetVenues(req: Request, res: Response) {
  const venues = await getVenuesByOwner(req.owner!.ownerId);
  const body: ApiResponse = { success: true, data: venues };
  res.json(body);
}

export async function handleUpdateMomoPhone(req: Request, res: Response) {
  const parsed = z.object({ momoPhone: momoPhoneSchema }).safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const venue = await updateVenueMomoPhone(req.params.venueId, parsed.data.momoPhone);
  const body: ApiResponse = { success: true, data: venue };
  res.json(body);
}

export async function handleUpdateLogo(req: Request, res: Response) {
  const { venueId } = req.params;
  const { logoUrl } = req.body;

  if (!logoUrl || typeof logoUrl !== 'string') {
    const body: ApiResponse = { success: false, error: 'logoUrl is required.' };
    res.status(400).json(body);
    return;
  }

  const venue = await updateVenueLogo(venueId, logoUrl);
  const body: ApiResponse = { success: true, data: venue };
  res.json(body);
}

export async function handleGetVenuePublic(req: Request, res: Response) {
  const { venueId } = req.params;
  try {
    const { db } = await import('../lib/db');
    const { venues } = await import('../models/schema');
    const { eq } = await import('drizzle-orm');
    const venue = await db.query.venues.findFirst({
      where: eq(venues.id, venueId),
      columns: { id: true, name: true, logoUrl: true },
    });
    if (!venue) {
      const body: ApiResponse = { success: false, error: 'Venue not found.' };
      res.status(404).json(body);
      return;
    }
    const body: ApiResponse = { success: true, data: venue };
    res.json(body);
  } catch {
    const body: ApiResponse = { success: false, error: 'Server error.' };
    res.status(500).json(body);
  }
}

// POST /venues/:venueId/terms — the owner agrees to the current venue terms.
export async function handleAcceptTerms(req: Request, res: Response) {
  const parsed = z.object({ version: z.number().int() }).safeParse(req.body);
  if (!parsed.success || parsed.data.version !== VENUE_TERMS_VERSION) {
    const body: ApiResponse = { success: false, error: 'Please reload the page to see the latest terms' };
    res.status(400).json(body);
    return;
  }
  const venue = await acceptVenueTerms(req.params.venueId, req.owner!.ownerId, VENUE_TERMS_VERSION);
  const body: ApiResponse = { success: true, data: venue };
  res.json(body);
}
