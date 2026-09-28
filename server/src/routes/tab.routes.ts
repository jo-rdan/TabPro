import { Router } from 'express';
import {
  handleOpenTab,
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
import { handleHeartbeat } from '../controllers/heartbeat.controller';
import { venueMember, venueOfTable, venueOfTab } from '../middleware/venueAccess.middleware';

const router = Router();

// All public — customer has no account
router.post('/open', handleOpenTab);
// Waiter: open a tab by tableId for walk-in customers
router.post('/staff-open', venueMember(venueOfTable((req) => req.body?.tableId)), handleStaffOpenTab);
router.get('/:tabId', handleGetTab);
router.get('/:tabId/bill', handleGetTabBill);
router.post('/:tabId/nudge', handleNudgeWaiter);
router.post('/:tabId/request-bill', handleRequestBill);
router.post('/:tabId/close', venueMember(venueOfTab()), handleCloseTab);

// ─── Tab payment via MoMo ─────────────────────────────────────────────────────
router.post('/:tabId/pay', handleInitiateTabPayment);
router.get('/:tabId/pay/:depositId', handleCheckTabPayment);

// ─── Customer presence heartbeat ──────────────────────────────────────────────
router.post('/:tabId/heartbeat', handleHeartbeat);

export default router;
