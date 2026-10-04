import { Request, Response } from "express";
import { ApiResponse } from "@tabpro/shared";
import { recordHeartbeat, recordCustomerLeft } from "../services/heartbeat.service";

// POST /tabs/:tabId/heartbeat
export async function handleHeartbeat(req: Request, res: Response) {
  try {
    await recordHeartbeat(req.params.tabId);
    const body: ApiResponse = { success: true, data: null };
    res.json(body);
  } catch {
    // Silently ignore — heartbeat failure should never break the customer experience
    res.json({ success: true, data: null });
  }
}

// POST /tabs/:tabId/left — sent by the customer's browser as the page closes
export function handleCustomerLeft(req: Request, res: Response) {
  if (/^[0-9a-f-]{36}$/i.test(req.params.tabId)) recordCustomerLeft(req.params.tabId);
  res.status(204).end();
}
