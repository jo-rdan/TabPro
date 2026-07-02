import { Router } from 'express';
import {
  handlePlaceOrder,
  handleUpdateOrderStatus,
  handleGetVenueOrders,
} from '../controllers/order.controller';

const router = Router();

// Public — customer places order with their tabId
router.post('/', handlePlaceOrder);

// Waiter updates order status — Phase 5 will add staff auth here
router.patch('/:orderId/status', handleUpdateOrderStatus);

// Venue orders — used by waiter and owner views
router.get('/venue/:venueId', handleGetVenueOrders);

export default router;
