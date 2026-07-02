import { Router } from 'express';
import { requireAuth, requireStaffAuth } from '../middleware/auth.middleware';
import {
  handleGetStickerStatus,
  handleClaimSticker,
  handleSetClockInPin,
  handleScanSticker,
  handleGetMyShifts,
  handleClockIn,
  handleClockOut,
  handleGetAttendance,
} from '../controllers/clockin.controller';

const router = Router();

// Public — waiter's phone scans the static sticker, gets back a 90s one-time session
router.post('/scan', handleScanSticker);

// Owner-authenticated
router.get('/sticker/:venueId', requireAuth, handleGetStickerStatus);
router.post('/claim/:venueId', requireAuth, handleClaimSticker);
router.post('/pin/:venueId', requireAuth, handleSetClockInPin);
router.get('/attendance/:venueId', requireAuth, handleGetAttendance);

// Staff-authenticated (existing waiter session)
router.get('/my-shifts', requireStaffAuth, handleGetMyShifts);
router.post('/clock-in', requireStaffAuth, handleClockIn);
router.post('/clock-out', requireStaffAuth, handleClockOut);

export default router;
