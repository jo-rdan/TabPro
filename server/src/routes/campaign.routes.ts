import { Router } from 'express';
import {
  handleGetAudience,
  handleGetCampaigns,
  handleGetCampaign,
  handleCreateCampaign,
  handleCancelCampaign,
} from '../controllers/campaign.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, venueFromBody, planFeature } from '../middleware/venueAccess.middleware';

const router = Router();

router.use(requireAuth);
router.get('/audience/:venueId', ownsVenue(venueFromParam()), handleGetAudience);
router.get('/:venueId', ownsVenue(venueFromParam()), handleGetCampaigns);
router.get('/:venueId/:campaignId', ownsVenue(venueFromParam()), handleGetCampaign);
router.post('/', ownsVenue(venueFromBody()), planFeature('campaigns', venueFromBody()), handleCreateCampaign);
router.post('/:venueId/:campaignId/cancel', ownsVenue(venueFromParam()), handleCancelCampaign);

export default router;
