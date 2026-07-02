import { Router } from 'express';
import { handleSubscribe, handleGetVapidKey } from '../controllers/push.controller';

const router = Router();

// Public — waiter subscribes without owner auth
router.post('/subscribe', handleSubscribe);
router.get('/vapid-key', handleGetVapidKey);

export default router;
