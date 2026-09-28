import { Router } from "express";
import {
  handleInitiateTabPayment,
  handleCheckTabPayment,
  handleCheckDisbursement,
  handleDepositWebhook,
  handlePayoutWebhook,
} from "../controllers/tabPayment.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { ownsVenue, venueOfPayout } from '../middleware/venueAccess.middleware';

const router = Router();

// Pawapay callbacks — configure these URLs in the Pawapay dashboard
router.post("/callback/deposit", handleDepositWebhook);
router.post("/callback/payout", handlePayoutWebhook);

// Public — customer-facing
router.post("/:tabId/pay", handleInitiateTabPayment);
router.get("/:tabId/pay/status/:depositId", handleCheckTabPayment);

// Owner — disbursement check
router.get("/disbursement/:payoutId/status", requireAuth, ownsVenue(venueOfPayout()), handleCheckDisbursement);

export default router;
