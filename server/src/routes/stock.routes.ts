import { Router } from 'express';
import {
  handleGetStock, handleSetTracking, handleDelivery, handleCount, handleItemHistory,
  handleGetKitchen, handleAddSpend, handleDeleteSpend, handleKitchenCategories,
} from '../controllers/stock.controller';
import { venueManager, venueFromParam, venueOfMenuItem } from '../middleware/venueAccess.middleware';

// Stock for bars: the owner and managers (waiters never see it).
const router = Router();

router.put('/items/:itemId', venueManager(venueOfMenuItem()), handleSetTracking);
router.get('/items/:itemId/history', venueManager(venueOfMenuItem()), handleItemHistory);
router.get('/:venueId', venueManager(venueFromParam()), handleGetStock);
router.post('/:venueId/delivery', venueManager(venueFromParam()), handleDelivery);
router.post('/:venueId/count', venueManager(venueFromParam()), handleCount);

// Kitchen, in money
router.get('/:venueId/kitchen', venueManager(venueFromParam()), handleGetKitchen);
router.post('/:venueId/kitchen/spend', venueManager(venueFromParam()), handleAddSpend);
router.delete('/:venueId/kitchen/spend/:spendId', venueManager(venueFromParam()), handleDeleteSpend);
router.put('/:venueId/kitchen/categories', venueManager(venueFromParam()), handleKitchenCategories);

export default router;
