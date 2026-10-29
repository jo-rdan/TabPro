import { Router, Request, Response } from 'express';
import { ApiResponse } from '@tabpro/shared';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, planFeature } from '../middleware/venueAccess.middleware';
import { suggestEvent, approveEvent, listEvents, getBrand, setBrand } from '../services/eventPlanner.service';

// The AI event planner (Max): ideas from the venue's numbers, approve → campaign.
const router = Router();
const ok = (res: Response, data: unknown) => res.json({ success: true, data } as ApiResponse);
const fail = (res: Response, err: unknown) => res.status(400).json({ success: false, error: (err as Error).message } as ApiResponse);
const gate = [requireAuth, ownsVenue(venueFromParam()), planFeature('events', venueFromParam())];

router.get('/:venueId', ...gate, async (req: Request, res: Response) => {
  try { ok(res, { events: await listEvents(req.params.venueId), brand: await getBrand(req.params.venueId) }); } catch (err) { fail(res, err); }
});
router.post('/:venueId/idea', ...gate, async (req: Request, res: Response) => {
  try { ok(res, await suggestEvent(req.params.venueId, req.body?.avoid)); } catch (err) { fail(res, err); }
});
router.post('/:venueId/approve', ...gate, async (req: Request, res: Response) => {
  try { ok(res, await approveEvent(req.params.venueId, req.body?.idea ?? {})); } catch (err) {
    const status = (err as { status?: number }).status;
    res.status(status && status < 500 ? status : 400).json({ success: false, error: (err as Error).message } as ApiResponse);
  }
});
router.put('/:venueId/brand', ...gate, async (req: Request, res: Response) => {
  try { ok(res, await setBrand(req.params.venueId, req.body ?? {})); } catch (err) { fail(res, err); }
});

export default router;
