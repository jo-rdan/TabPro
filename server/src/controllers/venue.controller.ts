import { Request, Response } from 'express';
import { createVenue, getVenuesByOwner, updateVenueLogo } from '../services/venue.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

const createVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required').max(100),
  location: z.string().max(200).optional(),
});

export async function handleCreateVenue(req: Request, res: Response) {
  const parsed = createVenueSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const venue = await createVenue(req.owner!.ownerId, parsed.data.name, parsed.data.location);
  const body: ApiResponse = { success: true, data: venue };
  res.status(201).json(body);
}

export async function handleGetVenues(req: Request, res: Response) {
  const venues = await getVenuesByOwner(req.owner!.ownerId);
  const body: ApiResponse = { success: true, data: venues };
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
