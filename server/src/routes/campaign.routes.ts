import { Router } from 'express';
import {
  handleGetAudience,
  handleGetCampaigns,
  handleCreateCampaign,
  handleSendCampaign,
} from '../controllers/campaign.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/audience/:venueId', handleGetAudience);
router.get('/:venueId', handleGetCampaigns);
router.post('/', handleCreateCampaign);
router.post('/:campaignId/send/:venueId', handleSendCampaign);

export default router;
