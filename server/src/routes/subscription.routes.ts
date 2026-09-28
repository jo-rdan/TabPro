import { Router } from 'express';
import { handleGetSubscription, handleUpdatePlan } from '../controllers/subscription.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam } from '../middleware/venueAccess.middleware';

const router = Router();

router.use(requireAuth);
router.get('/:venueId', ownsVenue(venueFromParam()), handleGetSubscription);
router.patch('/:venueId', ownsVenue(venueFromParam()), handleUpdatePlan);

export default router;
