import { Router } from 'express';
import { handleGetStats, handleGetActivityLog, handleGetEndOfNightReport, handleGetBusyHours } from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam } from '../middleware/venueAccess.middleware';

const router = Router();

router.use(requireAuth);
router.get('/stats/:venueId', ownsVenue(venueFromParam()), handleGetStats);
router.get('/activity/:venueId', ownsVenue(venueFromParam()), handleGetActivityLog);
router.get('/report/:venueId', ownsVenue(venueFromParam()), handleGetEndOfNightReport);
router.get('/busy-hours/:venueId', ownsVenue(venueFromParam()), handleGetBusyHours);

export default router;
