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
import { ownsVenue, venueFromParam, venueFromBody, venueOfStaff } from '../middleware/venueAccess.middleware';

const router = Router();

router.get('/public/:venueId', handleGetTablesPublic);
router.get('/my-tables', requireStaffAuth, handleGetMyTables);

router.use(requireAuth);
// The number printed on a scanned sticker, to name the table after it.
router.get('/sticker-info', async (req, res) => res.json({ success: true, data: await stickerInfo(String(req.query.code ?? '')) }));
router.post('/', ownsVenue(venueFromBody()), handleCreateTable);
router.get('/:venueId', ownsVenue(venueFromParam()), handleGetTables);
router.post('/claim-scan', ownsVenue(venueFromBody()), handleClaimScannedTable);
router.post('/assignments', ownsVenue(venueOfStaff()), handleAssignTables);
router.get('/assignments/:venueId', ownsVenue(venueFromParam()), handleGetVenueAssignments);

export default router;
