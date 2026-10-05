import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@tabpro/shared';
import { logError } from '../lib/errorLog';

// Throw this when the caller needs a specific HTTP status (e.g. 403, 404).
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Services throw plain `Error('Tab is not open')` for business-rule violations —
// those are safe to show the user and are the caller's fault (400). Programming
// errors (TypeError etc.) and database/system errors (which carry a `code`) are
// ours (500) and their details must not leak in production.
function isInternalError(err: any): boolean {
  if (err instanceof HttpError) return false;
  if (err?.code !== undefined) return true;
  return err instanceof TypeError || err instanceof ReferenceError || err instanceof SyntaxError || err instanceof RangeError;
}

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err instanceof HttpError ? err.status : isInternalError(err) ? 500 : 400;

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err);
    void logError('request', err, req);
  }
  else console.warn(`[${status}] ${req.method} ${req.path}: ${err.message}`);

  const body: ApiResponse = {
    success: false,
    error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  };

  res.status(status).json(body);
}
