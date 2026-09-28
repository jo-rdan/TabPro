import { Router } from 'express';
import {
  handlePlaceOrder,
  handleUpdateOrderStatus,
  handleGetVenueOrders,
} from '../controllers/order.controller';
import { venueMember, venueFromParam, venueOfOrder } from '../middleware/venueAccess.middleware';

const router = Router();

// Public — customer places order with their tabId
router.post('/', handlePlaceOrder);

// Waiter (or owner) of the venue updates order status
router.patch('/:orderId/status', venueMember(venueOfOrder()), handleUpdateOrderStatus);

// Venue orders — used by waiter and owner views
router.get('/venue/:venueId', venueMember(venueFromParam()), handleGetVenueOrders);

export default router;
