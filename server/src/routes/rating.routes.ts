import { Router } from 'express';
import { handleSubmitRating, handleGetLeaderboard, handleGetRatingsBreakdown } from '../controllers/rating.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam } from '../middleware/venueAccess.middleware';

const router = Router();

// Public — customer submits rating after tab closes
router.post('/', handleSubmitRating);

// Protected — owner views ratings
router.get('/leaderboard/:venueId', requireAuth, ownsVenue(venueFromParam()), handleGetLeaderboard);
router.get('/breakdown/:venueId', requireAuth, ownsVenue(venueFromParam()), handleGetRatingsBreakdown);

export default router;
