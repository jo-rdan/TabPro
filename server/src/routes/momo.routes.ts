import { Router, Request, Response } from 'express';
import { ApiResponse } from '@tabpro/shared';
import { db } from '../lib/db';
import { venues } from '../models/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.middleware';
import { venueMember, ownsVenue, venueFromParam, venueOfTab } from '../middleware/venueAccess.middleware';
import { HttpError } from '../middleware/error.middleware';
import {
  assertCanConfirmMomo, listMomoToConfirm, momoConfirmedTonight, momoNotYet, setMomoConfirmers,
} from '../services/momoCheck.service';
import { closeTab } from '../services/tab.service';

// MoMo to confirm: the owner, managers and cashiers the owner picked.
const router = Router();

const send = (res: Response, data: unknown) => res.json({ success: true, data } as ApiResponse);
const fail = (res: Response, err: unknown) =>
  res.status(err instanceof HttpError ? err.status : 400).json({ success: false, error: (err as Error).message || 'Something went wrong' } as ApiResponse);
const actor = (req: Request) => ({ ownerId: req.owner?.ownerId, staffId: req.staffMember?.staffId });
const venueOf = async (tabId: string) => (await venueOfTab()({ params: { tabId } } as unknown as Request)) as string;

router.get('/:venueId', venueMember(venueFromParam()), async (req: Request, res: Response) => {
  try {
    const venueId = req.params.venueId;
    await assertCanConfirmMomo(venueId, actor(req));
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId), columns: { momoConfirmers: true } });
    send(res, {
      items: await listMomoToConfirm(venueId),
      confirmedTonight: await momoConfirmedTonight(venueId),
      confirmers: venue?.momoConfirmers ?? [],
    });
  } catch (err) { fail(res, err); }
});

router.post('/tabs/:tabId/received', venueMember(venueOfTab()), async (req: Request, res: Response) => {
  try {
    await assertCanConfirmMomo(await venueOf(req.params.tabId), actor(req));
    await closeTab(req.params.tabId, { paidWith: 'momo' });
    send(res, { ok: true });
  } catch (err) { fail(res, err); }
});

router.post('/tabs/:tabId/not-yet', venueMember(venueOfTab()), async (req: Request, res: Response) => {
  try {
    await assertCanConfirmMomo(await venueOf(req.params.tabId), actor(req));
    send(res, await momoNotYet(req.params.tabId, actor(req)));
  } catch (err) { fail(res, err); }
});

// Owner only: who confirms MoMo ("owner", "manager", "cashier"; at least one).
router.patch('/:venueId/confirmers', requireAuth, ownsVenue(venueFromParam()), async (req: Request, res: Response) => {
  try {
    const roles = Array.isArray(req.body?.roles) ? req.body.roles.map(String) : [];
    send(res, { confirmers: await setMomoConfirmers(req.params.venueId, roles) });
  } catch (err) { fail(res, err); }
});

export default router;
