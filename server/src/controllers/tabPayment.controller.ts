import { Request, Response } from "express";
import {
  requestTabPayment,
  checkTabPaymentAndMaybeDisburse,
  checkDisbursementStatus,
  handleDepositCallback,
  handlePayoutCallback,
} from "../services/pawapay.service";
import { PawapayError } from "../lib/pawapay";
import { ApiResponse } from "@tabpro/shared";
import { z } from "zod";

const tabPaySchema = z.object({
  phone: z.string().min(9),
});

export async function handleInitiateTabPayment(req: Request, res: Response) {
  const { tabId } = req.params;
  const parsed = tabPaySchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: "Phone number is required." };
    res.status(400).json(body);
    return;
  }
  try {
    const result = await requestTabPayment(tabId, parsed.data.phone);
    const body: ApiResponse = { success: true, data: result };
    res.json(body);
  } catch (err: any) {
    console.error("Tab payment initiate error:", err.message);
    // Business rules ("already paid") and customer problems ("not enough
    // balance") are meant for the customer; pawaPay/config failures are not.
    const providerFailure = err instanceof PawapayError;
    const body: ApiResponse = {
      success: false,
      error: providerFailure ? "Mobile Money is unavailable right now. Please try again or pay your waiter." : err.message,
    };
    res.status(providerFailure ? 502 : 400).json(body);
  }
}

export async function handleCheckTabPayment(req: Request, res: Response) {
  const { depositId } = req.params;
  try {
    const result = await checkTabPaymentAndMaybeDisburse(depositId);
    const body: ApiResponse = { success: true, data: result };
    res.json(body);
  } catch (err: any) {
    console.error("Tab payment check error:", err.message);
    const body: ApiResponse = { success: false, error: "Could not check payment status." };
    res.status(500).json(body);
  }
}

export async function handleCheckDisbursement(req: Request, res: Response) {
  const { payoutId } = req.params;
  try {
    const result = await checkDisbursementStatus(payoutId);
    const body: ApiResponse = { success: true, data: result };
    res.json(body);
  } catch (err: any) {
    console.error("Disbursement check error:", err.message);
    const body: ApiResponse = { success: false, error: "Could not check disbursement status." };
    res.status(500).json(body);
  }
}

// pawaPay webhooks. Always answer 200 so Pawapay doesn't retry forever; the
// services re-check the real status with Pawapay, so a forged call is harmless.
export async function handleDepositWebhook(req: Request, res: Response) {
  res.json({ received: true });
  const depositId = req.body?.depositId;
  if (typeof depositId === "string") {
    handleDepositCallback(depositId).catch((err) => console.error("Deposit webhook error:", err.message));
  }
}

export async function handlePayoutWebhook(req: Request, res: Response) {
  res.json({ received: true });
  const payoutId = req.body?.payoutId;
  if (typeof payoutId === "string") {
    handlePayoutCallback(payoutId).catch((err) => console.error("Payout webhook error:", err.message));
  }
}
