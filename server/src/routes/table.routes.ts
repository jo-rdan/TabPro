import { Router } from 'express';
import { stickerInfo } from '../services/table.service';
import {
  handleCreateTable,
  handleGetTables,
  handleGetTablesPublic,
  handleAssignTables,
  handleGetVenueAssignments,
  handleGetMyTables,
  handleClaimScannedTable,
} from '../controllers/table.controller';
import { requireAuth, requireStaffAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, venueFromBody, venueOfStaff, ownerOrManager } from '../middleware/venueAccess.middleware';

const router = Router();

router.get('/public/:venueId', handleGetTablesPublic);
router.get('/my-tables', requireStaffAuth, handleGetMyTables);

// The owner, or a manager the owner lets set up tables (the owner is told).
router.post('/', ownerOrManager('tables', venueFromBody(), (req, who) => `${who} added ${req.body?.label ?? 'a table'}`), handleCreateTable);
router.get('/:venueId([0-9a-f-]{36})', ownerOrManager('tables', venueFromParam()), handleGetTables);
router.post('/claim-scan', ownerOrManager('tables', venueFromBody(), (req, who) => `${who} set up a sticker as ${req.body?.label ?? 'a table'}`), handleClaimScannedTable);

router.use(requireAuth);
// The number printed on a scanned sticker, to name the table after it.
router.get('/sticker-info', async (req, res) => res.json({ success: true, data: await stickerInfo(String(req.query.code ?? '')) }));
router.post('/assignments', ownsVenue(venueOfStaff()), handleAssignTables);
router.get('/assignments/:venueId', ownsVenue(venueFromParam()), handleGetVenueAssignments);

export default router;
