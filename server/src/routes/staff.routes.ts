import { Router } from 'express';
import { handleCreateStaff, handleAcceptInvite, handleGetStaff, handleGetMyPoints, handleToggleStaffActive, handleResendInvite, handleSetPin, handleVerifyPin, handleStaffLogin } from '../controllers/staff.controller';
import { requireAuth, requireStaffAuth } from '../middleware/auth.middleware';

const router = Router();

// Public
router.get('/invite/:token', handleAcceptInvite);
router.post('/login', handleStaffLogin);

// Staff-auth
router.get('/me/points', requireStaffAuth, handleGetMyPoints);
router.post('/me/set-pin', requireStaffAuth, handleSetPin);
router.post('/me/verify-pin', requireStaffAuth, handleVerifyPin);

// Owner-auth
router.use(requireAuth);
router.post('/', handleCreateStaff);
router.get('/:venueId', handleGetStaff);
router.patch('/:staffId/active', handleToggleStaffActive);
router.post('/:staffId/resend-invite', handleResendInvite);

export default router;
