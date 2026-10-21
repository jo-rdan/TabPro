import { Request, Response } from "express";
import { signJwt } from "../services/auth.service";
import { db } from "../lib/db";
import { ApiResponse } from "@tabpro/shared";
import { owners, venues } from "../models/schema";
import { VENUE_TERMS_VERSION } from "../lib/venueTerms";
import { adminEmail } from "../middleware/auth.middleware";
import { eq } from "drizzle-orm";
import { siteFor } from "../lib/origins";

// Called after Google OAuth success
export async function googleCallback(req: Request, res: Response) {
  const site = siteFor(typeof req.query.state === "string" ? req.query.state : null);
  try {
    const owner = req.user as { id: string; email: string; name: string };
    const token = signJwt(owner.id, owner.email);

    const existingVenues = await db.query.venues.findMany({
      where: eq(venues.ownerId, owner.id),
    });

    console.log("owner:", owner.id, "| venues found:", existingVenues.length);

    const redirect = existingVenues.length === 0 ? "setup" : "dashboard";
    console.log("redirecting to:", redirect);

    res.redirect(
      `${site}/auth/callback?token=${token}&redirect=${redirect}`,
    );
  } catch (err) {
    console.error("googleCallback error:", err);
    res.redirect(`${site}/auth/error`);
  }
}

// GET /api/auth/me - returns current owner profile + venues
export async function getMe(req: Request, res: Response) {
  try {
    const { ownerId } = req.owner!;

    const { owners } = await import("../models/schema");
    const { eq } = await import("drizzle-orm");

    const owner = await db.query.owners.findFirst({
      where: eq(owners.id, ownerId),
      with: {
        venues: {
          // Oldest first, so the dashboard always opens the same venue.
          orderBy: (v, { asc }) => [asc(v.createdAt)],
          with: {
            subscription: true,
          },
        },
      },
    });

    if (!owner) {
      const body: ApiResponse = { success: false, error: "Owner not found" };
      res.status(404).json(body);
      return;
    }

    // currentTermsVersion: the app asks owners to agree when theirs is older.
    // isAdmin: the founder, who sees Skuzi-wide tools (creators).
    // Each venue carries its package status (trial, paid, grace, locked) so the
    // app can open the right features and put up the wall when unpaid.
    const { planStatus } = await import("../services/plan.service");
    const withPlans = { ...owner, venues: owner.venues.map((v) => ({ ...v, planStatus: planStatus(v) })) };
    const body: ApiResponse = { success: true, data: { ...withPlans, currentTermsVersion: VENUE_TERMS_VERSION, isAdmin: owner.email.toLowerCase() === adminEmail() } };
    res.json(body);
  } catch (err) {
    throw err;
  }
}
