import { Router } from 'express';
import { handleCreateVenue, handleGetVenues, handleUpdateLogo, handleUpdateMomoPhone, handleGetVenuePublic, handleAcceptTerms } from '../controllers/venue.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam } from '../middleware/venueAccess.middleware';

const router = Router();

// Public — no auth
router.get('/public/:venueId', handleGetVenuePublic);

router.use(requireAuth);
router.post('/', handleCreateVenue);
router.get('/', handleGetVenues);
router.patch('/:venueId/logo', ownsVenue(venueFromParam()), handleUpdateLogo);
router.patch('/:venueId/momo-phone', ownsVenue(venueFromParam()), handleUpdateMomoPhone);
router.post('/:venueId/terms', ownsVenue(venueFromParam()), handleAcceptTerms);

export default router;
