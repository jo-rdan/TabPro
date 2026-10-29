import { Router } from 'express';
import { handleGetStats, handleGetActivityLog, handleGetEndOfNightReport, handleGetBusyHours, handleGetOpenBills, handleGetTonight, handleGetNightTotals } from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, planFeature } from '../middleware/venueAccess.middleware';
import { getNightReport } from '../services/nightReport.service';

const router = Router();

router.use(requireAuth);
router.get('/stats/:venueId', ownsVenue(venueFromParam()), handleGetStats);
router.get('/activity/:venueId', ownsVenue(venueFromParam()), planFeature('history', venueFromParam()), handleGetActivityLog);
router.get('/report/:venueId', ownsVenue(venueFromParam()), handleGetEndOfNightReport);
// The night's report (Report page, PDF download, the 2am notification).
router.get('/night-report/:venueId', ownsVenue(venueFromParam()), async (req, res) => {
  try {
    const night = typeof req.query.night === 'string' && req.query.night ? req.query.night : undefined;
    res.json({ success: true, data: await getNightReport(req.params.venueId, night) });
  } catch (err) { res.status(400).json({ success: false, error: (err as Error).message }); }
});
router.get('/busy-hours/:venueId', ownsVenue(venueFromParam()), handleGetBusyHours);
router.get('/open-bills/:venueId', ownsVenue(venueFromParam()), handleGetOpenBills);
router.get('/tonight/:venueId', ownsVenue(venueFromParam()), handleGetTonight);
router.get('/nights/:venueId', ownsVenue(venueFromParam()), planFeature('history', venueFromParam()), handleGetNightTotals);

export default router;
