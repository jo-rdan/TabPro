import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@tabpro/shared';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  const body: ApiResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  };

  res.status(500).json(body);
}
