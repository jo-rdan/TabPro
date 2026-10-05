import { db } from './db';
import { errorLogs } from '../models/schema';

// Saves an unexpected error to the database. Never throws: logging a failure
// must not cause another one.
export async function logError(
  source: string,
  err: unknown,
  req?: { method: string; path: string }
): Promise<void> {
  try {
    const e = err as any;
    await db.insert(errorLogs).values({
      source,
      method: req?.method,
      path: req?.path?.slice(0, 300),
      message: String(e?.message ?? e).slice(0, 1000),
      stack: e?.stack ? String(e.stack).slice(0, 4000) : null,
    });
  } catch (logErr: any) {
    console.error('[errorLog] could not save error:', logErr?.message);
  }
}
