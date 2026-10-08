import { Router, Request, Response } from "express";
import { z } from "zod";
import { ApiResponse } from "@tabpro/shared";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware";
import {
  addCreator, applyAsCreator, approveCreator, creatorHome, listCreators, lookupCode, markPaid, setCreatorStatus,
} from "../services/creator.service";

// Skuzi Creators. Public: sign up, check a code, a creator's own page (private
// link). Founder only: approve, pause, pay.
const router = Router();
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data } as ApiResponse);
const bad = (res: Response, error: string, status = 400) => res.status(status).json({ success: false, error } as ApiResponse);

const hits = new Map<string, number[]>();
function limit(req: Request, res: Response, next: () => void) {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60 * 60_000);
  if (recent.length >= 5) return bad(res, "Too many sign-ups from here. Please try again later.", 429);
  hits.set(key, [...recent, now]);
  next();
}

const applySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(60),
  handle: z.string().trim().max(60).optional().nullable(),
  phone: z.string().trim().min(9, "Please enter your MoMo number").max(20),
  wantedCode: z.string().trim().max(20).optional().nullable(),
});
router.post("/apply", limit, async (req, res) => {
  const p = applySchema.safeParse(req.body);
  if (!p.success) return bad(res, p.error.errors[0].message);
  ok(res, await applyAsCreator(p.data), 201);
});
router.get("/code/:code", async (req, res) => {
  const found = await lookupCode(req.params.code);
  return found ? ok(res, found) : bad(res, "We don't know this code", 404);
});
router.get("/me/:token", async (req, res) => ok(res, await creatorHome(req.params.token)));

router.use("/admin", requireAuth, requireAdmin);
router.get("/admin", async (_req, res) => ok(res, await listCreators()));
router.post("/admin", async (req, res) => {
  const p = applySchema.extend({ code: z.string().trim().min(3).max(20) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error.errors[0].message);
  ok(res, await addCreator(p.data), 201);
});
router.param("creatorId", (req, res, next, id) => (z.string().uuid().safeParse(id).success ? next() : bad(res, "Creator not found", 404)));
router.post("/admin/:creatorId/approve", async (req, res) => {
  const p = z.object({ code: z.string().trim().min(3).max(20) }).safeParse(req.body);
  if (!p.success) return bad(res, "A code is 3 to 16 letters or numbers, e.g. ALINE");
  ok(res, await approveCreator(req.params.creatorId, p.data.code));
});
router.post("/admin/:creatorId/status", async (req, res) => {
  const p = z.object({ status: z.enum(["paused", "active", "declined"]) }).safeParse(req.body);
  if (!p.success) return bad(res, "Unknown status");
  ok(res, await setCreatorStatus(req.params.creatorId, p.data.status));
});
router.post("/admin/:creatorId/paid", async (req, res) => ok(res, await markPaid(req.params.creatorId)));

export default router;
