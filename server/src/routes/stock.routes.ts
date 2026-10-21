import { Router } from 'express';
import {
  handleGetStock, handleSetTracking, handleDelivery, handleCount, handleItemHistory,
  handleGetKitchen, handleAddSpend, handleDeleteSpend, handleKitchenCategories,
} from '../controllers/stock.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, venueOfMenuItem } from '../middleware/venueAccess.middleware';

// Stock for bars: owner only (waiters never see it).
const router = Router();

router.put('/items/:itemId', requireAuth, ownsVenue(venueOfMenuItem()), handleSetTracking);
router.get('/items/:itemId/history', requireAuth, ownsVenue(venueOfMenuItem()), handleItemHistory);
router.get('/:venueId', requireAuth, ownsVenue(venueFromParam()), handleGetStock);
router.post('/:venueId/delivery', requireAuth, ownsVenue(venueFromParam()), handleDelivery);
router.post('/:venueId/count', requireAuth, ownsVenue(venueFromParam()), handleCount);

// Kitchen, in money
router.get('/:venueId/kitchen', requireAuth, ownsVenue(venueFromParam()), handleGetKitchen);
router.post('/:venueId/kitchen/spend', requireAuth, ownsVenue(venueFromParam()), handleAddSpend);
router.delete('/:venueId/kitchen/spend/:spendId', requireAuth, ownsVenue(venueFromParam()), handleDeleteSpend);
router.put('/:venueId/kitchen/categories', requireAuth, ownsVenue(venueFromParam()), handleKitchenCategories);

export default router;
