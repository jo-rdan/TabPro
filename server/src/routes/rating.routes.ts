import { Router } from 'express';
import { handleSubmitRating, handleGetLeaderboard, handleGetRatingsBreakdown } from '../controllers/rating.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public — customer submits rating after tab closes
router.post('/', handleSubmitRating);

// Protected — owner views ratings
router.get('/leaderboard/:venueId', requireAuth, handleGetLeaderboard);
router.get('/breakdown/:venueId', requireAuth, handleGetRatingsBreakdown);

export default router;
