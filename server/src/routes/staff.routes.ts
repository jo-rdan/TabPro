import { Router } from 'express';
import { handleCreateStaff, handleAcceptInvite, handleGetStaff, handleGetMyPoints, handleToggleStaffActive, handleResendInvite, handleSetPin, handleVerifyPin, handleStaffLogin, handleJoinRequest, handleApproveJoin, handleDeclineJoin } from '../controllers/staff.controller';
import { requireAuth, requireStaffAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, venueFromBody, venueOfStaff } from '../middleware/venueAccess.middleware';

const router = Router();

// Public
router.get('/invite/:token', handleAcceptInvite);
router.post('/login', handleStaffLogin);
router.post('/join', handleJoinRequest);

// Staff-auth
router.get('/me/points', requireStaffAuth, handleGetMyPoints);
router.post('/me/set-pin', requireStaffAuth, handleSetPin);
router.post('/me/verify-pin', requireStaffAuth, handleVerifyPin);

// Owner-auth
router.use(requireAuth);
router.post('/', ownsVenue(venueFromBody()), handleCreateStaff);
router.get('/:venueId', ownsVenue(venueFromParam()), handleGetStaff);
router.patch('/:staffId/active', ownsVenue(venueOfStaff()), handleToggleStaffActive);
router.post('/:staffId/resend-invite', ownsVenue(venueOfStaff()), handleResendInvite);
router.post('/:staffId/approve', ownsVenue(venueOfStaff()), handleApproveJoin);
router.delete('/:staffId/join-request', ownsVenue(venueOfStaff()), handleDeclineJoin);

export default router;
