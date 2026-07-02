import { Request, Response } from 'express';
import { getShiftsForVenue, createShift, updateShift, deleteShift } from '../services/shift.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftSchema = z.object({
  name: z.string().min(1).max(50),
  startTime: z.string().regex(timeRegex, 'startTime must be HH:MM'),
  endTime: z.string().regex(timeRegex, 'endTime must be HH:MM'),
});

export async function handleGetShifts(req: Request, res: Response) {
  const { venueId } = req.params;
  const data = await getShiftsForVenue(venueId);
  const body: ApiResponse = { success: true, data };
  res.json(body);
}

export async function handleCreateShift(req: Request, res: Response) {
  const { venueId } = req.params;
  const parsed = shiftSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const { name, startTime, endTime } = parsed.data;
  const shift = await createShift(venueId, name, startTime, endTime);
  const body: ApiResponse = { success: true, data: shift };
  res.status(201).json(body);
}

export async function handleUpdateShift(req: Request, res: Response) {
  const { shiftId } = req.params;
  const parsed = shiftSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const { name, startTime, endTime } = parsed.data;
  const shift = await updateShift(shiftId, name, startTime, endTime);
  const body: ApiResponse = { success: true, data: shift };
  res.json(body);
}

const deleteShiftSchema = z.object({
  venueId: z.string().uuid(),
});

export async function handleDeleteShift(req: Request, res: Response) {
  const { shiftId } = req.params;
  const parsed = deleteShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: 'venueId is required' };
    res.status(400).json(body);
    return;
  }
  await deleteShift(shiftId, parsed.data.venueId);
  const body: ApiResponse = { success: true, data: null };
  res.json(body);
}
