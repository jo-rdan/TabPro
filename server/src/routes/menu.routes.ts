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
import { ownsVenue, venueFromBody, venueOfMenuItem, ownerOrManager } from '../middleware/venueAccess.middleware';

const router = Router();

// Public — customer sees menu
router.get('/:venueId', handleGetMenu);

// Protected — owner manages menu
// Protected: the owner, or a manager the owner lets set up the menu (the owner is told).
const n = (x: unknown) => Number(x ?? 0).toLocaleString('en-US');
router.post('/', ownerOrManager('menu', venueFromBody(), (req, who) => `${who} added ${req.body?.items?.length ?? 0} menu item${req.body?.items?.length === 1 ? '' : 's'}`), handleCreateMenuItems);
router.post('/extract', ownerOrManager('menu'), upload.single('file'), handleExtractMenu);
router.patch('/items/:itemId', ownerOrManager('menu', venueOfMenuItem(), (req, who) => `${who} changed ${req.body?.name ?? 'a menu item'}${req.body?.priceRwf ? ` · price now ${n(req.body.priceRwf)} RWF` : ''}`), handleUpdateMenuItem);
router.patch('/items/:itemId/toggle', ownerOrManager('menu', venueOfMenuItem()), handleToggleAvailability);
router.delete('/items/:itemId', ownerOrManager('menu', venueOfMenuItem(), (_req, who) => `${who} removed a menu item`), handleDeleteMenuItem);

export default router;
