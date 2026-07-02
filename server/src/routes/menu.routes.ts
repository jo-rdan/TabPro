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

const router = Router();

// Public — customer sees menu
router.get('/:venueId', handleGetMenu);

// Protected — owner manages menu
router.post('/', requireAuth, handleCreateMenuItems);
router.post('/extract', requireAuth, upload.single('file'), handleExtractMenu);
router.patch('/items/:itemId', requireAuth, handleUpdateMenuItem);
router.patch('/items/:itemId/toggle', requireAuth, handleToggleAvailability);
router.delete('/items/:itemId', requireAuth, handleDeleteMenuItem);

export default router;
