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
