import { Router } from 'express';
import { handleGetSubscription, handleUpdatePlan } from '../controllers/subscription.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/:venueId', handleGetSubscription);
router.patch('/:venueId', handleUpdatePlan);

export default router;
