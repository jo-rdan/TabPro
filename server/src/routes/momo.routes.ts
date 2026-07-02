import { Router } from 'express';
import { handleInitiatePayment, handleCheckPayment } from '../controllers/momo.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.post('/:venueId/pay', handleInitiatePayment);
router.get('/status/:referenceId', handleCheckPayment);

export default router;
