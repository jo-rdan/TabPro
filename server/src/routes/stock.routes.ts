import { Router } from 'express';
import {
  handleGetStock, handleSetTracking, handleDelivery, handleCount, handleItemHistory,
  handleGetKitchen, handleAddSpend, handleDeleteSpend, handleKitchenCategories,
} from '../controllers/stock.controller';
import { venueManager, venueFromParam, venueOfMenuItem, planFeature } from '../middleware/venueAccess.middleware';

// Stock for bars: the owner and managers (waiters never see it).
const router = Router();

router.put('/items/:itemId', venueManager(venueOfMenuItem()), planFeature('stock', venueOfMenuItem()), handleSetTracking);
router.get('/items/:itemId/history', venueManager(venueOfMenuItem()), planFeature('stock', venueOfMenuItem()), handleItemHistory);
router.get('/:venueId', venueManager(venueFromParam()), planFeature('stock', venueFromParam()), handleGetStock);
router.post('/:venueId/delivery', venueManager(venueFromParam()), planFeature('stock', venueFromParam()), handleDelivery);
router.post('/:venueId/count', venueManager(venueFromParam()), planFeature('stock', venueFromParam()), handleCount);

// Kitchen, in money
router.get('/:venueId/kitchen', venueManager(venueFromParam()), planFeature('stock', venueFromParam()), handleGetKitchen);
router.post('/:venueId/kitchen/spend', venueManager(venueFromParam()), planFeature('stock', venueFromParam()), handleAddSpend);
router.delete('/:venueId/kitchen/spend/:spendId', venueManager(venueFromParam()), planFeature('stock', venueFromParam()), handleDeleteSpend);
router.put('/:venueId/kitchen/categories', venueManager(venueFromParam()), planFeature('stock', venueFromParam()), handleKitchenCategories);

export default router;
