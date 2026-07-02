import { Router } from 'express';
import { handleGetShifts, handleCreateShift, handleUpdateShift, handleDeleteShift } from '../controllers/shift.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/:venueId', handleGetShifts);
router.post('/:venueId', handleCreateShift);
router.patch('/:shiftId', handleUpdateShift);
router.delete('/:shiftId', handleDeleteShift);

export default router;
