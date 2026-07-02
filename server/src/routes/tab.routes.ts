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

const router = Router();

// All public — customer has no account
router.post('/open', handleOpenTab);
// Waiter: open a tab by tableId for walk-in customers
router.post('/staff-open', handleStaffOpenTab);
router.get('/:tabId', handleGetTab);
router.get('/:tabId/bill', handleGetTabBill);
router.post('/:tabId/nudge', handleNudgeWaiter);
router.post('/:tabId/request-bill', handleRequestBill);
router.post('/:tabId/close', handleCloseTab);

export default router;
