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

const router = Router();

router.get('/public/:venueId', handleGetTablesPublic);
router.get('/my-tables', requireStaffAuth, handleGetMyTables);

router.use(requireAuth);
router.post('/', handleCreateTable);
router.get('/:venueId', handleGetTables);
router.post('/claim-scan', handleClaimScannedTable);
router.post('/assignments', handleAssignTables);
router.get('/assignments/:venueId', handleGetVenueAssignments);

export default router;
