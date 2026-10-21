import { Router } from 'express';
import {
  handleOpenTab,
  handlePreviewTable,
  handleNudgeTable,
  handleClaimPaid,
  handleStaffOpenTab,
  handleGetTab,
  handleNudgeWaiter,
  handleRequestBill,
  handleGetTabBill,
  handleCloseTab,
} from '../controllers/tab.controller';
import {
  handleInitiateTabPayment,
  handleCheckTabPayment,
} from '../controllers/tabPayment.controller';
import { handleHeartbeat, handleCustomerLeft } from '../controllers/heartbeat.controller';
import { venueMember, venueOfTable, venueOfTab } from '../middleware/venueAccess.middleware';
import { waiterCard, recordTip } from '../services/tips.service';

const router = Router();

// All public — customer has no account
router.post('/open', handleOpenTab);
// Menu first: what the guest sees before giving their number
router.get('/preview/:qrCode', handlePreviewTable);
router.post('/preview/:qrCode/nudge', handleNudgeTable);
// Waiter: open a tab by tableId for walk-in customers
router.post('/staff-open', venueMember(venueOfTable((req) => req.body?.tableId)), handleStaffOpenTab);
router.get('/:tabId', handleGetTab);
router.get('/:tabId/bill', handleGetTabBill);
router.post('/:tabId/nudge', handleNudgeWaiter);
router.post('/:tabId/paid-by-momo', handleClaimPaid);
router.post('/:tabId/request-bill', handleRequestBill);
// The guest's waiter (badges, tips on/off) and "I've sent a tip".
router.get('/:tabId/waiter', async (req, res) => {
  try { res.json({ success: true, data: await waiterCard(req.params.tabId) }); }
  catch { res.json({ success: true, data: null }); }
});
router.post('/:tabId/tip', async (req, res) => {
  try { res.json({ success: true, data: await recordTip(req.params.tabId, req.body?.amountRwf) }); }
  catch (err) { res.status(400).json({ success: false, error: (err as Error).message }); }
});
router.post('/:tabId/close', venueMember(venueOfTab()), handleCloseTab);

// ─── Tab payment via MoMo ─────────────────────────────────────────────────────
router.post('/:tabId/pay', handleInitiateTabPayment);
router.get('/:tabId/pay/:depositId', handleCheckTabPayment);

// ─── Customer presence heartbeat ──────────────────────────────────────────────
router.post('/:tabId/heartbeat', handleHeartbeat);
router.post('/:tabId/left', handleCustomerLeft);

export default router;
