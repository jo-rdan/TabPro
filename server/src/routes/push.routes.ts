import { Router } from 'express';
import { handleSubscribe, handleGetVapidKey } from '../controllers/push.controller';
import { venueMember, venueFromBody } from '../middleware/venueAccess.middleware';

const router = Router();

// Public — waiter subscribes without owner auth
router.post('/subscribe', venueMember(venueFromBody()), handleSubscribe);
router.get('/vapid-key', handleGetVapidKey);

export default router;
