import { Router } from 'express';
import { handleSubscribe, handleGetVapidKey, handleSubscribeTab } from '../controllers/push.controller';
import { venueMember, venueFromBody } from '../middleware/venueAccess.middleware';

const router = Router();

// Public — waiter subscribes without owner auth
router.post('/subscribe', venueMember(venueFromBody()), handleSubscribe);
router.get('/vapid-key', handleGetVapidKey);
// Public — a guest asks to be told when their order is ready
router.post('/subscribe-tab', handleSubscribeTab);

export default router;
