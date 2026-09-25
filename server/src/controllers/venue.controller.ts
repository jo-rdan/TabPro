import { Request, Response } from 'express';
import { createVenue, getVenuesByOwner, updateVenueLogo, updateVenueMomoPhone } from '../services/venue.service';
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
});

export async function handleCreateVenue(req: Request, res: Response) {
  const parsed = createVenueSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const venue = await createVenue(req.owner!.ownerId, parsed.data.name, parsed.data.location, parsed.data.momoPhone);
  const body: ApiResponse = { success: true, data: venue };
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
