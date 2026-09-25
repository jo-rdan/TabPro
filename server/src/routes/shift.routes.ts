import { Router } from 'express';
import { handleGetShifts, handleCreateShift, handleUpdateShift, handleDeleteShift } from '../controllers/shift.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, venueOfShift } from '../middleware/venueAccess.middleware';

const router = Router();

router.use(requireAuth);
router.get('/:venueId', ownsVenue(venueFromParam()), handleGetShifts);
router.post('/:venueId', ownsVenue(venueFromParam()), handleCreateShift);
router.patch('/:shiftId', ownsVenue(venueOfShift()), handleUpdateShift);
router.delete('/:shiftId', ownsVenue(venueOfShift()), handleDeleteShift);

export default router;
