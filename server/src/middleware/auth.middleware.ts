import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '@tabpro/shared';

export interface JwtPayload {
  ownerId: string;
  email: string;
}

export interface StaffJwtPayload {
  staffId: string;
  venueId: string;
}

// Extend Express Request to carry the owner or staff
declare global {
  namespace Express {
    interface Request {
      owner?: JwtPayload;
      staffMember?: StaffJwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const body: ApiResponse = { success: false, error: 'Unauthorized' };
    res.status(401).json(body);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    // Staff tokens are signed with the same secret — don't let them through as owners.
    if (!payload.ownerId) throw new Error('Not an owner token');
    req.owner = payload;
    next();
  } catch {
    const body: ApiResponse = { success: false, error: 'Invalid or expired token' };
    res.status(401).json(body);
  }
}

export function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const body: ApiResponse = { success: false, error: 'Unauthorized' };
    res.status(401).json(body);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as StaffJwtPayload;
    if (!payload.staffId) throw new Error('Not a staff token');
    req.staffMember = payload;
    next();
  } catch {
    const body: ApiResponse = { success: false, error: 'Invalid or expired staff token' };
    res.status(401).json(body);
  }
}

// ─── Guests ──────────────────────────────────────────────────────────────────
// A guest's phone gets a token when they say yes to invites at their table (or
// connect the Skuzi icon on their Home Screen). It only lets them manage their
// own invites and devices; it is never an owner or staff token.
export interface GuestJwtPayload { guestId: string }

declare global {
  namespace Express {
    interface Request { guest?: GuestJwtPayload }
  }
}

export function signGuestToken(customerId: string): string {
  return jwt.sign({ guestId: customerId }, process.env.JWT_SECRET!, { expiresIn: '365d' });
}

export function requireGuest(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : (req.headers['x-guest-token'] as string | undefined);
  try {
    if (!token) throw new Error('none');
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as GuestJwtPayload;
    if (!payload.guestId) throw new Error('Not a guest token');
    req.guest = payload;
    next();
  } catch {
    const body: ApiResponse = { success: false, error: 'Please open Skuzi from your table again' };
    res.status(401).json(body);
  }
}

// ─── The founder ─────────────────────────────────────────────────────────────
// Skuzi-wide tools (creators, payouts) are only for the owner account named by
// ADMIN_EMAIL. Run after requireAuth.
export const adminEmail = () => (process.env.ADMIN_EMAIL || 'jordankayinamura@gmail.com').toLowerCase();
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.owner?.email?.toLowerCase() !== adminEmail()) {
    const body: ApiResponse = { success: false, error: 'Only the Skuzi team can do this' };
    res.status(403).json(body);
    return;
  }
  next();
}
