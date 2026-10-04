import { Request, Response } from 'express';
import { createStaff, acceptInvite, getStaffForVenue, getMyPoints, toggleStaffActive, resendInvite, setPin, verifyPin, loginByPhone, requestToJoin, approveJoinRequest, declineJoinRequest } from '../services/staff.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

const createStaffSchema = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1).max(100),
  phone: z.string().min(9).max(15),
});

export async function handleCreateStaff(req: Request, res: Response) {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const result = await createStaff(parsed.data.venueId, parsed.data.name, parsed.data.phone);
  const inviteUrl = `${process.env.CLIENT_URL}/invite/${result.token}`;

  const body: ApiResponse = { success: true, data: { ...result, inviteUrl } };
  res.status(201).json(body);
}

export async function handleAcceptInvite(req: Request, res: Response) {
  const { token } = req.params;
  const result = await acceptInvite(token);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

export async function handleGetStaff(req: Request, res: Response) {
  const staffList = await getStaffForVenue(req.params.venueId);
  const body: ApiResponse = { success: true, data: staffList };
  res.json(body);
}

export async function handleGetMyPoints(req: Request, res: Response) {
  const staffId = req.staffMember!.staffId;
  const result = await getMyPoints(staffId);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

const toggleActiveSchema = z.object({ isActive: z.boolean() });

export async function handleToggleStaffActive(req: Request, res: Response) {
  const parsed = toggleActiveSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const result = await toggleStaffActive(req.params.staffId, parsed.data.isActive);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

export async function handleResendInvite(req: Request, res: Response) {
  const result = await resendInvite(req.params.staffId);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

const pinSchema = z.object({ pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits') });

export async function handleSetPin(req: Request, res: Response) {
  const parsed = pinSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  await setPin(req.staffMember!.staffId, parsed.data.pin);
  const body: ApiResponse = { success: true, data: { message: 'PIN set successfully' } };
  res.json(body);
}

export async function handleVerifyPin(req: Request, res: Response) {
  const parsed = pinSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const valid = await verifyPin(req.staffMember!.staffId, parsed.data.pin);
  if (!valid) {
    const body: ApiResponse = { success: false, error: 'Incorrect PIN' };
    res.status(401).json(body);
    return;
  }
  const body: ApiResponse = { success: true, data: { verified: true } };
  res.json(body);
}

const loginSchema = z.object({
  phone: z.string().min(9),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export async function handleStaffLogin(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const result = await loginByPhone(parsed.data.phone, parsed.data.pin);
  if (!result) {
    const body: ApiResponse = { success: false, error: 'Incorrect phone number or PIN.' };
    res.status(401).json(body);
    return;
  }

  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

const joinSchema = z.object({
  code: z.string().min(1, 'Missing sticker code'),
  name: z.string().trim().min(2, 'Enter your name'),
  phone: z.string().min(9, 'Enter your phone number'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export async function handleJoinRequest(req: Request, res: Response) {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  try {
    const { code, name, phone, pin } = parsed.data;
    const result = await requestToJoin(code, name, phone, pin);
    const body: ApiResponse = { success: true, data: result };
    res.status(201).json(body);
  } catch (err: any) {
    const body: ApiResponse = { success: false, error: err.message };
    res.status(400).json(body);
  }
}

export async function handleApproveJoin(req: Request, res: Response) {
  try {
    const member = await approveJoinRequest(req.params.staffId);
    const body: ApiResponse = { success: true, data: { id: member.id, name: member.name } };
    res.json(body);
  } catch (err: any) {
    const body: ApiResponse = { success: false, error: err.message };
    res.status(400).json(body);
  }
}

export async function handleDeclineJoin(req: Request, res: Response) {
  try {
    await declineJoinRequest(req.params.staffId);
    const body: ApiResponse = { success: true, data: null };
    res.json(body);
  } catch (err: any) {
    const body: ApiResponse = { success: false, error: err.message };
    res.status(400).json(body);
  }
}
