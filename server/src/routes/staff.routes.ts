import { Router } from 'express';
import { handleCreateStaff, handleAcceptInvite, handleGetStaff, handleGetMyPoints, handleToggleStaffActive, handleResendInvite, handleSetPin, handleVerifyPin, handleStaffLogin, handleJoinRequest, handleApproveJoin, handleDeclineJoin, handleUpdateStaff, handleGetMe } from '../controllers/staff.controller';
import { requireAuth, requireStaffAuth } from '../middleware/auth.middleware';
import { ownsVenue, venueFromParam, venueFromBody, venueOfStaff, ownerOrManager } from '../middleware/venueAccess.middleware';
import { setTipMomo } from '../services/tips.service';

const router = Router();

// Public
router.get('/invite/:token', handleAcceptInvite);
router.post('/login', handleStaffLogin);
router.post('/join', handleJoinRequest);

// Staff-auth
router.get('/me', requireStaffAuth, handleGetMe);
router.get('/me/points', requireStaffAuth, handleGetMyPoints);
// Tips on (with the MoMo number guests send to) or off.
router.patch('/me/tips', requireStaffAuth, async (req, res) => {
  try { res.json({ success: true, data: await setTipMomo(req.staffMember!.staffId, req.body?.tipMomo ?? null) }); }
  catch (err) { res.status(400).json({ success: false, error: (err as Error).message }); }
});
router.post('/me/set-pin', requireStaffAuth, handleSetPin);
router.post('/me/verify-pin', requireStaffAuth, handleVerifyPin);

// Owner-auth
// The owner, or a manager the owner lets add waiters, kitchen and cashiers (the owner is told).
router.post('/', ownerOrManager('team', venueFromBody(), (req, who) => `${who} added ${req.body?.name ?? 'someone'} (${req.body?.role ?? 'waiter'})`), handleCreateStaff);
router.get('/:venueId([0-9a-f-]{36})', ownerOrManager('team', venueFromParam()), handleGetStaff);

router.use(requireAuth);
router.patch('/:staffId/active', ownsVenue(venueOfStaff()), handleToggleStaffActive);
router.patch('/:staffId', ownsVenue(venueOfStaff()), handleUpdateStaff);
router.post('/:staffId/resend-invite', ownsVenue(venueOfStaff()), handleResendInvite);
router.post('/:staffId/approve', ownsVenue(venueOfStaff()), handleApproveJoin);
router.delete('/:staffId/join-request', ownsVenue(venueOfStaff()), handleDeclineJoin);

export default router;
