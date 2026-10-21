import { Router, Request, Response } from 'express';
import { ApiResponse } from '@tabpro/shared';
import { getTickets, startTicket, readyTicket, itemUnavailable } from '../services/kitchenScreen.service';
import { venueKitchen, venueFromParam, venueOfOrder, venueOfOrderItem, planFeature } from '../middleware/venueAccess.middleware';

// The kitchen screen (Bar+): the chef, managers and the owner.
const router = Router();

const send = (res: Response, data: unknown) => res.json({ success: true, data } as ApiResponse);
const fail = (res: Response, err: unknown) =>
  res.status(400).json({ success: false, error: (err as Error).message || 'Something went wrong' } as ApiResponse);

router.get('/:venueId/tickets', venueKitchen(venueFromParam()), planFeature('kitchen', venueFromParam()), async (req: Request, res: Response) => {
  try { send(res, await getTickets(req.params.venueId)); } catch (err) { fail(res, err); }
});
router.post('/orders/:orderId/start', venueKitchen(venueOfOrder()), planFeature('kitchen', venueOfOrder()), async (req: Request, res: Response) => {
  try { await startTicket(req.params.orderId); send(res, { ok: true }); } catch (err) { fail(res, err); }
});
router.post('/orders/:orderId/ready', venueKitchen(venueOfOrder()), planFeature('kitchen', venueOfOrder()), async (req: Request, res: Response) => {
  try { await readyTicket(req.params.orderId); send(res, { ok: true }); } catch (err) { fail(res, err); }
});
router.post('/items/:orderItemId/unavailable', venueKitchen(venueOfOrderItem()), planFeature('kitchen', venueOfOrderItem()), async (req: Request, res: Response) => {
  try { await itemUnavailable(req.params.orderItemId, { soldOut: req.body?.soldOut === true }); send(res, { ok: true }); } catch (err) { fail(res, err); }
});

export default router;
