import { Router, Request, Response } from 'express';
import { ApiResponse } from '@tabpro/shared';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam } from '../middleware/venueAccess.middleware';
import { db } from '../lib/db';
import { venues } from '../models/schema';
import { eq } from 'drizzle-orm';
import { planStatus, setMomoPayCode, chooseOwnPlan, listVenuePlans, adminUpdatePlan, startPlanPayment, settlePlanPayment } from '../services/plan.service';
import { momoPayments } from '../models/schema';
import { and } from 'drizzle-orm';

// Packages and the venue's MoMo Pay code. Owners see and pick their package in
// the trial; the founder sets packages and marks venues paid.
const router = Router();
const ok = (res: Response, data: unknown) => res.json({ success: true, data } as ApiResponse);
const fail = (res: Response, err: unknown) => res.status(400).json({ success: false, error: (err as Error).message } as ApiResponse);

router.use(requireAuth);

router.get('/admin/all', requireAdmin, async (_req: Request, res: Response) => ok(res, await listVenuePlans()));
router.patch('/admin/:venueId', requireAdmin, async (req: Request, res: Response) => {
  try { ok(res, await adminUpdatePlan(req.params.venueId, req.body ?? {})); } catch (err) { fail(res, err); }
});

router.get('/:venueId', ownsVenue(venueFromParam()), async (req: Request, res: Response) => {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, req.params.venueId) });
  ok(res, venue ? planStatus(venue) : null);
});
router.patch('/:venueId/momo-code', ownsVenue(venueFromParam()), async (req: Request, res: Response) => {
  try { ok(res, await setMomoPayCode(req.params.venueId, req.body?.code)); } catch (err) { fail(res, err); }
});
router.patch('/:venueId', ownsVenue(venueFromParam()), async (req: Request, res: Response) => {
  try { ok(res, await chooseOwnPlan(req.params.venueId, req.body?.plan)); } catch (err) { fail(res, err); }
});

// The owner pays a month with MoMo: their phone asks for the PIN, then the
// Plan page checks until it's through.
router.post('/:venueId/pay', ownsVenue(venueFromParam()), async (req: Request, res: Response) => {
  try { ok(res, await startPlanPayment(req.params.venueId, req.body ?? {})); } catch (err) { fail(res, err); }
});
router.get('/:venueId/pay/:depositId', ownsVenue(venueFromParam()), async (req: Request, res: Response) => {
  try {
    const mine = await db.query.momoPayments.findFirst({
      where: and(eq(momoPayments.referenceId, req.params.depositId), eq(momoPayments.venueId, req.params.venueId)),
    });
    if (!mine) throw new Error('Payment not found');
    const result = await settlePlanPayment(req.params.depositId);
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, req.params.venueId) });
    ok(res, { ...result, plan: venue ? planStatus(venue) : null });
  } catch (err) { fail(res, err); }
});

export default router;
