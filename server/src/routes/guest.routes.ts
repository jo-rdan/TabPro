import { Router, Request, Response } from "express";
import { z } from "zod";
import { ApiResponse } from "@tabpro/shared";
import { requireGuest } from "../middleware/auth.middleware";
import { addDevice, claimLinkCode, getGuest, makeLinkCode, setInvites, setInvitesFromTab } from "../services/guest.service";
import { explore, venuePage } from "../services/explore.service";
import { addBookingDevice, availability, cancelBookingByGuest, createBooking, getBookingForGuest } from "../services/booking.service";

// Guests' own Skuzi: Explore, venue pages, bookings and invites. All public,
// except a guest's own settings (guest token).
const router = Router();
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data } as ApiResponse);
const bad = (res: Response, error: string, status = 400) => res.status(status).json({ success: false, error } as ApiResponse);

const pushSub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// A small per-address limit for the forms anyone can post.
function limiter(limit: number, windowMs: number, message: string) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: () => void) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) return bad(res, message, 429);
    hits.set(key, [...recent, now]);
    next();
  };
}

router.get("/explore", async (_req, res) => ok(res, await explore()));
router.get("/v/:slug", async (req, res) => ok(res, await venuePage(req.params.slug)));
router.get("/v/:slug/times", async (req, res) => {
  const d = dateKey.safeParse(req.query.date);
  if (!d.success) return bad(res, "Pick a day");
  ok(res, await availability(req.params.slug, d.data));
});

const bookingSchema = z.object({
  slug: z.string().min(1).max(60),
  date: dateKey,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1, "At least 1 person").max(30, "For more than 30 people, please call the restaurant"),
  name: z.string().trim().min(2, "Please enter your name").max(60),
  phone: z.string().trim().min(9, "Please enter your phone number").max(20),
  note: z.string().trim().max(200, "Keep the note short (200 characters)").optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
});
router.post("/bookings", limiter(20, 60 * 60_000, "Too many bookings from this phone. Please try again later."), async (req, res) => {
  const p = bookingSchema.safeParse(req.body);
  if (!p.success) return bad(res, p.error.errors[0].message);
  ok(res, await createBooking(p.data), 201);
});
router.get("/bookings/:id", async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return bad(res, "We couldn't find this booking", 404);
  ok(res, await getBookingForGuest(req.params.id, String(req.query.t ?? "")));
});
router.post("/bookings/:id/cancel", async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return bad(res, "We couldn't find this booking", 404);
  ok(res, await cancelBookingByGuest(req.params.id, String(req.body?.t ?? "")));
});

router.post("/bookings/:id/device", async (req, res) => {
  const p = z.object({ t: z.string().min(10).max(100), subscription: pushSub }).safeParse(req.body);
  if (!p.success || !z.string().uuid().safeParse(req.params.id).success) return bad(res, "Notifications couldn't be turned on");
  ok(res, await addBookingDevice(req.params.id, p.data.t, p.data.subscription));
});

router.post("/invites", async (req, res) => {
  const p = z.object({ tabId: z.string().uuid(), optIn: z.boolean(), subscription: pushSub.optional().nullable(), phone: z.string().max(20).optional().nullable() }).safeParse(req.body);
  if (!p.success) return bad(res, "Something went wrong. Please try again.");
  ok(res, await setInvitesFromTab(p.data.tabId, p.data.optIn, p.data.subscription, p.data.phone));
});
router.post("/claim", limiter(20, 60 * 60_000, "Too many tries. Please try again later."), async (req, res) => {
  const p = z.object({ code: z.string().min(6).max(20) }).safeParse(req.body);
  if (!p.success) return bad(res, "This link has expired", 404);
  ok(res, await claimLinkCode(p.data.code.toUpperCase()));
});
router.get("/me", requireGuest, async (req, res) => ok(res, await getGuest(req.guest!.guestId)));
router.post("/me/invites", requireGuest, async (req, res) => {
  const p = z.object({ optIn: z.boolean() }).safeParse(req.body);
  if (!p.success) return bad(res, "Something went wrong");
  ok(res, await setInvites(req.guest!.guestId, p.data.optIn));
});
router.post("/me/devices", requireGuest, async (req, res) => {
  const p = pushSub.safeParse(req.body?.subscription);
  if (!p.success) return bad(res, "Notifications couldn't be turned on");
  ok(res, await addDevice(req.guest!.guestId, p.data));
});
router.post("/me/link-code", requireGuest, async (req, res) => ok(res, await makeLinkCode(req.guest!.guestId)));

export default router;
