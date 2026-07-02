import { Router } from 'express';
import { handleCreateVenue, handleGetVenues, handleUpdateLogo, handleGetVenuePublic } from '../controllers/venue.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public — no auth
router.get('/public/:venueId', handleGetVenuePublic);

router.use(requireAuth);
router.post('/', handleCreateVenue);
router.get('/', handleGetVenues);
router.patch('/:venueId/logo', handleUpdateLogo);

export default router;
