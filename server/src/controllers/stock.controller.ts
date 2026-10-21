import { Request, Response } from 'express';
import { ApiResponse } from '@tabpro/shared';
import { getStock, setTracking, addDelivery, saveCount, getItemHistory } from '../services/stock.service';
import { getKitchen, addSpend, deleteSpend, setKitchenCategories } from '../services/kitchen.service';

const send = (res: Response, data: unknown) => res.json({ success: true, data } as ApiResponse);
const fail = (res: Response, err: unknown) =>
  res.status(400).json({ success: false, error: (err as Error).message || 'Something went wrong' } as ApiResponse);

export async function handleGetStock(req: Request, res: Response) {
  try { send(res, await getStock(req.params.venueId)); } catch (err) { fail(res, err); }
}

export async function handleSetTracking(req: Request, res: Response) {
  const { tracked, qty, alertAt } = req.body ?? {};
  if (typeof tracked !== 'boolean') { fail(res, new Error('Say whether to track this item')); return; }
  try { await setTracking(req.params.itemId, { tracked, qty, alertAt }); send(res, { ok: true }); } catch (err) { fail(res, err); }
}

export async function handleDelivery(req: Request, res: Response) {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) { fail(res, new Error('Add at least one item')); return; }
  try { await addDelivery(req.params.venueId, items, req.body?.supplier); send(res, { ok: true }); } catch (err) { fail(res, err); }
}

export async function handleCount(req: Request, res: Response) {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) { fail(res, new Error('Count at least one item')); return; }
  try { send(res, await saveCount(req.params.venueId, items)); } catch (err) { fail(res, err); }
}

export async function handleItemHistory(req: Request, res: Response) {
  try { send(res, await getItemHistory(req.params.itemId)); } catch (err) { fail(res, err); }
}

// ─── Kitchen, in money ────────────────────────────────────────────────────────
export async function handleGetKitchen(req: Request, res: Response) {
  const range = req.query.range === 'tonight' ? 'tonight' : 'week';
  try { send(res, await getKitchen(req.params.venueId, range)); } catch (err) { fail(res, err); }
}

export async function handleAddSpend(req: Request, res: Response) {
  try { send(res, await addSpend(req.params.venueId, req.body ?? {})); } catch (err) { fail(res, err); }
}

export async function handleDeleteSpend(req: Request, res: Response) {
  try { await deleteSpend(req.params.venueId, req.params.spendId); send(res, { ok: true }); } catch (err) { fail(res, err); }
}

export async function handleKitchenCategories(req: Request, res: Response) {
  try { await setKitchenCategories(req.params.venueId, req.body?.categories); send(res, { ok: true }); } catch (err) { fail(res, err); }
}
