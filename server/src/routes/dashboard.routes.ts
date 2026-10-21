import { Router } from 'express';
import { handleGetStats, handleGetActivityLog, handleGetEndOfNightReport, handleGetBusyHours, handleGetOpenBills, handleGetTonight, handleGetNightTotals } from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, planFeature } from '../middleware/venueAccess.middleware';

const router = Router();

router.use(requireAuth);
router.get('/stats/:venueId', ownsVenue(venueFromParam()), handleGetStats);
router.get('/activity/:venueId', ownsVenue(venueFromParam()), planFeature('history', venueFromParam()), handleGetActivityLog);
router.get('/report/:venueId', ownsVenue(venueFromParam()), handleGetEndOfNightReport);
router.get('/busy-hours/:venueId', ownsVenue(venueFromParam()), handleGetBusyHours);
router.get('/open-bills/:venueId', ownsVenue(venueFromParam()), handleGetOpenBills);
router.get('/tonight/:venueId', ownsVenue(venueFromParam()), handleGetTonight);
router.get('/nights/:venueId', ownsVenue(venueFromParam()), planFeature('history', venueFromParam()), handleGetNightTotals);

export default router;
