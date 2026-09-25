import { Router } from 'express';
import {
  handleGetMenu,
  handleCreateMenuItems,
  handleExtractMenu,
  handleToggleAvailability,
  handleUpdateMenuItem,
  handleDeleteMenuItem,
} from '../controllers/menu.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { ownsVenue, venueFromBody, venueOfMenuItem } from '../middleware/venueAccess.middleware';

const router = Router();

// Public — customer sees menu
router.get('/:venueId', handleGetMenu);

// Protected — owner manages menu
router.post('/', requireAuth, ownsVenue(venueFromBody()), handleCreateMenuItems);
router.post('/extract', requireAuth, upload.single('file'), handleExtractMenu);
router.patch('/items/:itemId', requireAuth, ownsVenue(venueOfMenuItem()), handleUpdateMenuItem);
router.patch('/items/:itemId/toggle', requireAuth, ownsVenue(venueOfMenuItem()), handleToggleAvailability);
router.delete('/items/:itemId', requireAuth, ownsVenue(venueOfMenuItem()), handleDeleteMenuItem);

export default router;
