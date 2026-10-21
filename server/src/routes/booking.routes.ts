import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApiResponse } from "@tabpro/shared";
import { requireAuth } from "../middleware/auth.middleware";
import { ownsVenue, venueFromParam, planFeature } from '../middleware/venueAccess.middleware';
import { acceptBooking, declineBooking, listBookings, pendingCount, setBookingTable, tableReservations } from "../services/booking.service";
import { kigaliDateKey } from "../lib/hours";

// The owner's bookings: a night's list, accept (with a table) or decline.
const router = Router();
const ok = (res: Response, data: unknown) => res.json({ success: true, data } as ApiResponse);
const bad = (res: Response, error: string) => res.status(400).json({ success: false, error } as ApiResponse);
// The owner of the venue, on a package that includes bookings.
const ownsVenueOnly = ownsVenue(venueFromParam());
const bookingsPlan = planFeature('bookings', venueFromParam());
const own = async (req: Request, res: Response, next: NextFunction) => {
  await ownsVenueOnly(req, res, () => {});
  await bookingsPlan(req, res, next);
};

router.use(requireAuth);
// A booking id that isn't an id is simply not found (never a database error).
router.param("bookingId", (req, res, next, id) => {
  if (!z.string().uuid().safeParse(id).success) return res.status(404).json({ success: false, error: "Booking not found" } as ApiResponse);
  next();
});
router.get("/:venueId", own, async (req, res) => {
  const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : kigaliDateKey(new Date(Date.now() - 6 * 3_600_000));
  ok(res, await listBookings(req.params.venueId, date));
});
router.get("/:venueId/pending-count", own, async (req, res) => ok(res, { pending: await pendingCount(req.params.venueId) }));
router.get("/:venueId/tables", own, async (req, res) => ok(res, await tableReservations(req.params.venueId)));
router.post("/:venueId/:bookingId/accept", own, async (req, res) => {
  const p = z.object({ tableId: z.string().uuid().nullable().optional() }).safeParse(req.body ?? {});
  if (!p.success) return bad(res, "Pick a table");
  ok(res, await acceptBooking(req.params.venueId, req.params.bookingId, p.data.tableId));
});
router.post("/:venueId/:bookingId/decline", own, async (req, res) => ok(res, await declineBooking(req.params.venueId, req.params.bookingId)));
router.patch("/:venueId/:bookingId/table", own, async (req, res) => {
  const p = z.object({ tableId: z.string().uuid().nullable() }).safeParse(req.body ?? {});
  if (!p.success) return bad(res, "Pick a table");
  ok(res, await setBookingTable(req.params.venueId, req.params.bookingId, p.data.tableId));
});

export default router;
