import { Router } from 'express';
import { handleGetStats, handleGetActivityLog, handleGetEndOfNightReport, handleGetBusyHours } from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/stats/:venueId', handleGetStats);
router.get('/activity/:venueId', handleGetActivityLog);
router.get('/report/:venueId', handleGetEndOfNightReport);
router.get('/busy-hours/:venueId', handleGetBusyHours);

export default router;
