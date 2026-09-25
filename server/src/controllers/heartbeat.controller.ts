import { Request, Response } from "express";
import { ApiResponse } from "@tabpro/shared";
import { recordHeartbeat } from "../services/heartbeat.service";

// POST /tabs/:tabId/heartbeat
export async function handleHeartbeat(req: Request, res: Response) {
  try {
    await recordHeartbeat(req.params.tabId);
    const body: ApiResponse = { success: true, data: null };
    console.log("Heartbeat pinged");
    res.json(body);
  } catch {
    // Silently ignore — heartbeat failure should never break the customer experience
    res.json({ success: true, data: null });
  }
}
