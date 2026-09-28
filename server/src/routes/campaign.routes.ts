import { Router } from 'express';
import {
  handleGetAudience,
  handleGetCampaigns,
  handleCreateCampaign,
  handleSendCampaign,
} from '../controllers/campaign.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, venueFromBody, venueOfCampaign } from '../middleware/venueAccess.middleware';

const router = Router();

router.use(requireAuth);
router.get('/audience/:venueId', ownsVenue(venueFromParam()), handleGetAudience);
router.get('/:venueId', ownsVenue(venueFromParam()), handleGetCampaigns);
router.post('/', ownsVenue(venueFromBody()), handleCreateCampaign);
router.post('/:campaignId/send/:venueId', ownsVenue(venueOfCampaign()), ownsVenue(venueFromParam()), handleSendCampaign);

export default router;
