import { Request, Response } from 'express';
import { createTable, getTablesForVenue, assignTablesToStaff, getVenueAssignments, getMyAssignedTables, claimScannedTable } from '../services/table.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';
import { db } from '../lib/db';
import { venues } from '../models/schema';
import { eq } from 'drizzle-orm';

const createTableSchema = z.object({
  venueId: z.string().uuid(),
  label: z.string().min(1).max(50),
});

export async function handleCreateTable(req: Request, res: Response) {
  const parsed = createTableSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const venue = await db.query.venues.findFirst({
    where: eq(venues.id, parsed.data.venueId),
  });

  if (!venue || venue.ownerId !== req.owner!.ownerId) {
    const body: ApiResponse = { success: false, error: 'Venue not found' };
    res.status(404).json(body);
    return;
  }

  const result = await createTable(parsed.data.venueId, parsed.data.label);
  const qrUrl = `${process.env.CLIENT_URL}/t/${result.qrCode}`;
  const body: ApiResponse = { success: true, data: { ...result, qrUrl } };
  res.status(201).json(body);
}

export async function handleGetTables(req: Request, res: Response) {
  const { venueId } = req.params;
  const tables = await getTablesForVenue(venueId);
  const body: ApiResponse = { success: true, data: tables };
  res.json(body);
}

export async function handleGetTablesPublic(req: Request, res: Response) {
  const { venueId } = req.params;
  const tables = await getTablesForVenue(venueId);
  const body: ApiResponse = {
    success: true,
    data: tables.map((t) => ({ id: t.id, label: t.label, isActive: t.isActive })),
  };
  res.json(body);
}

// ── Assignments ───────────────────────────────────────────────────────────────

const assignSchema = z.object({
  staffId: z.string().uuid(),
  tableIds: z.array(z.string().uuid()),
});

export async function handleAssignTables(req: Request, res: Response) {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const result = await assignTablesToStaff(parsed.data.staffId, parsed.data.tableIds);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

export async function handleGetVenueAssignments(req: Request, res: Response) {
  const { venueId } = req.params;
  const result = await getVenueAssignments(venueId);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

export async function handleGetMyTables(req: Request, res: Response) {
  const staffId = req.staffMember!.staffId;
  const result = await getMyAssignedTables(staffId);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

const claimScanSchema = z.object({
  venueId: z.string().uuid(),
  label: z.string().min(1),
  scannedCode: z.string().min(1),
});

export async function handleClaimScannedTable(req: Request, res: Response) {
  const parsed = claimScanSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const result = await claimScannedTable(parsed.data.venueId, parsed.data.label, parsed.data.scannedCode);
  const body: ApiResponse = { success: true, data: result };
  res.status(201).json(body);
}
