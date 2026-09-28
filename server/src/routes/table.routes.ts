import { Router } from 'express';
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
router.post('/', ownsVenue(venueFromBody()), handleCreateTable);
router.get('/:venueId', ownsVenue(venueFromParam()), handleGetTables);
router.post('/claim-scan', ownsVenue(venueFromBody()), handleClaimScannedTable);
router.post('/assignments', ownsVenue(venueOfStaff()), handleAssignTables);
router.get('/assignments/:venueId', ownsVenue(venueFromParam()), handleGetVenueAssignments);

export default router;
