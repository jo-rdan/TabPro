import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiResponse } from '@tabpro/shared';
import {
  getStickerStatus,
  claimStickerCode,
  startClockInSession,
  setClockInPin,
  getMyAssignedShifts,
  clockIn,
  clockOut,
  getMyClockStatus,
  getTodayAttendance,
  getWeeklyHours,
} from '../services/clockin.service';

// ── Owner: check whether a clock-in sticker has been claimed yet ───────────────

export async function handleGetStickerStatus(req: Request, res: Response) {
  const { venueId } = req.params;
  try {
    const status = await getStickerStatus(venueId);
    const body: ApiResponse = { success: true, data: status };
    res.json(body);
  } catch (err: any) {
    const body: ApiResponse = { success: false, error: err.message || 'Failed to load sticker status' };
    res.status(400).json(body);
  }
}

// ── Owner: claim a pre-printed blank sticker by its scanned code ───────────────

const claimSchema = z.object({ code: z.string().min(1, 'Missing sticker code') });

export async function handleClaimSticker(req: Request, res: Response) {
  const { venueId } = req.params;
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  try {
    const code = await claimStickerCode(venueId, parsed.data.code);
    const body: ApiResponse = { success: true, data: { code } };
    res.json(body);
  } catch (err: any) {
    const body: ApiResponse = { success: false, error: err.message || 'Failed to claim sticker' };
    res.status(400).json(body);
  }
}

// ── Owner: set the venue PIN ────────────────────────────────────────────────────

const pinSchema = z.object({ pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits') });

export async function handleSetClockInPin(req: Request, res: Response) {
  const { venueId } = req.params;
  const parsed = pinSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  await setClockInPin(venueId, parsed.data.pin);
  const body: ApiResponse = { success: true, data: null };
  res.json(body);
}

// ── Public: phone scans the sticker → mint a 90s one-time session ───────────────

const scanSchema = z.object({ code: z.string().min(1) });

export async function handleScanSticker(req: Request, res: Response) {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: 'Missing or invalid sticker code' };
    res.status(400).json(body);
    return;
  }
  try {
    const session = await startClockInSession(parsed.data.code);
    const body: ApiResponse = { success: true, data: session };
    res.json(body);
  } catch (err: any) {
    const body: ApiResponse = { success: false, error: err.message || 'Invalid sticker.' };
    res.status(401).json(body);
  }
}

// ── Staff (authenticated via existing waiter session): assigned shifts + status ─

export async function handleGetMyShifts(req: Request, res: Response) {
  const staffId = req.staffMember!.staffId;
  const [shiftsList, status] = await Promise.all([
    getMyAssignedShifts(staffId),
    getMyClockStatus(staffId),
  ]);
  const body: ApiResponse = { success: true, data: { shifts: shiftsList, status } };
  res.json(body);
}

// ── Staff: clock in ──────────────────────────────────────────────────────────────

const clockInSchema = z.object({
  shiftId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
  sessionToken: z.string().min(1, 'Missing scan session — scan the sticker again'),
});

export async function handleClockIn(req: Request, res: Response) {
  const { staffId, venueId } = req.staffMember!;
  const parsed = clockInSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  try {
    const log = await clockIn(venueId, staffId, parsed.data.shiftId, parsed.data.pin, parsed.data.sessionToken);
    const body: ApiResponse = { success: true, data: log };
    res.json(body);
  } catch (err: any) {
    const body: ApiResponse = { success: false, error: err.message || 'Failed to clock in' };
    res.status(400).json(body);
  }
}

// ── Staff: clock out ─────────────────────────────────────────────────────────────

export async function handleClockOut(req: Request, res: Response) {
  const staffId = req.staffMember!.staffId;
  try {
    const log = await clockOut(staffId);
    const body: ApiResponse = { success: true, data: log };
    res.json(body);
  } catch (err: any) {
    const body: ApiResponse = { success: false, error: err.message || 'Failed to clock out' };
    res.status(400).json(body);
  }
}

// ── Owner: today's attendance + weekly hours ─────────────────────────────────────

export async function handleGetAttendance(req: Request, res: Response) {
  const { venueId } = req.params;
  const [attendance, weeklyHours] = await Promise.all([
    getTodayAttendance(venueId),
    getWeeklyHours(venueId),
  ]);
  const body: ApiResponse = { success: true, data: { attendance, weeklyHours } };
  res.json(body);
}
