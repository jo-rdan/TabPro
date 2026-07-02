import { Request, Response } from "express";
import { signJwt } from "../services/auth.service";
import { db } from "../lib/db";
import { ApiResponse } from "@tabpro/shared";
import { owners, venues } from "../models/schema";
import { eq } from "drizzle-orm";

// Called after Google OAuth success
export async function googleCallback(req: Request, res: Response) {
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
      `${process.env.CLIENT_URL}/auth/callback?token=${token}&redirect=${redirect}`,
    );
  } catch (err) {
    console.error("googleCallback error:", err);
    res.redirect(`${process.env.CLIENT_URL}/auth/error`);
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

    const body: ApiResponse = { success: true, data: owner };
    res.json(body);
  } catch (err) {
    throw err;
  }
}
