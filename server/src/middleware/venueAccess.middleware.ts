import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import {
  venues, staff, menuItems, shifts, orders, orderItems, tabs, tables, campaigns, momoPayments,
} from '../models/schema';
import { HttpError } from './error.middleware';
import { PLANS, PLAN_FOR, type PlanFeature } from '@tabpro/shared';
import { venueAllows } from '../services/plan.service';
import { JwtPayload, StaffJwtPayload } from './auth.middleware';

// Works out which venue a request is about, from a param, the body, or by
// looking up the record the request targets. Returns null when not found.
type VenueResolver = (req: Request) => Promise<string | null | undefined> | string | null | undefined;

export const venueFromParam = (name = 'venueId'): VenueResolver => (req) => req.params[name];
export const venueFromBody = (name = 'venueId'): VenueResolver => (req) => req.body?.[name];

export const venueOfStaff = (param = 'staffId'): VenueResolver => async (req) =>
  (await db.query.staff.findFirst({ where: eq(staff.id, req.params[param] ?? req.body?.[param]) }))?.venueId;

export const venueOfMenuItem = (param = 'itemId'): VenueResolver => async (req) =>
  (await db.query.menuItems.findFirst({ where: eq(menuItems.id, req.params[param]) }))?.venueId;

export const venueOfShift = (param = 'shiftId'): VenueResolver => async (req) =>
  (await db.query.shifts.findFirst({ where: eq(shifts.id, req.params[param]) }))?.venueId;

export const venueOfCampaign = (param = 'campaignId'): VenueResolver => async (req) =>
  (await db.query.campaigns.findFirst({ where: eq(campaigns.id, req.params[param]) }))?.venueId;

export const venueOfTable = (get: (req: Request) => string | undefined): VenueResolver => async (req) => {
  const id = get(req);
  return id ? (await db.query.tables.findFirst({ where: eq(tables.id, id) }))?.venueId : null;
};

export const venueOfTab = (param = 'tabId'): VenueResolver => async (req) =>
  (await db.query.tabs.findFirst({ where: eq(tabs.id, req.params[param]), with: { table: true } }))?.table?.venueId;

export const venueOfOrder = (param = 'orderId'): VenueResolver => async (req) =>
  (await db.query.orders.findFirst({
    where: eq(orders.id, req.params[param]),
    with: { tab: { with: { table: true } } },
  }))?.tab?.table?.venueId;

export const venueOfPayout = (param = 'payoutId'): VenueResolver => async (req) =>
  (await db.query.momoPayments.findFirst({ where: eq(momoPayments.disbursementReferenceId, req.params[param]) }))?.venueId;

async function resolveVenueId(resolve: VenueResolver, req: Request): Promise<string> {
  let venueId: string | null | undefined;
  try {
    venueId = await resolve(req);
  } catch {
    venueId = null; // malformed uuid etc.
  }
  if (!venueId) throw new HttpError(404, 'Not found');
  return venueId;
}

async function ownerOwnsVenue(ownerId: string, venueId: string): Promise<boolean> {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  return !!venue && venue.ownerId === ownerId;
}

/**
 * Owner-only. Must run after requireAuth. Rejects owners acting on a venue
 * they don't own.
 */
export function ownsVenue(resolve: VenueResolver) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const venueId = await resolveVenueId(resolve, req);
    if (!req.owner || !(await ownerOwnsVenue(req.owner.ownerId, venueId))) {
      throw new HttpError(403, 'You do not have access to this venue');
    }
    next();
  };
}

/**
 * Owner of the venue OR an active waiter of the venue. Does its own token
 * check, so use it instead of requireAuth / requireStaffAuth.
 */
export function venueMember(resolve: VenueResolver) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Unauthorized');

    let payload: Partial<JwtPayload & StaffJwtPayload>;
    try {
      payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET!) as any;
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }

    const venueId = await resolveVenueId(resolve, req);

    if (payload.ownerId) {
      if (!(await ownerOwnsVenue(payload.ownerId, venueId))) throw new HttpError(403, 'You do not have access to this venue');
      req.owner = payload as JwtPayload;
      return next();
    }

    if (payload.staffId) {
      const member = await db.query.staff.findFirst({ where: eq(staff.id, payload.staffId) });
      if (!member || !member.isActive || member.venueId !== venueId) {
        throw new HttpError(403, 'You do not have access to this venue');
      }
      req.staffMember = payload as StaffJwtPayload;
      return next();
    }

    throw new HttpError(401, 'Unauthorized');
  };
}

/**
 * Owner of the venue OR an active MANAGER of the venue (not waiters). Used for
 * stock: the owner's manager runs the bar too. Does its own token check.
 */
export function venueManager(resolve: VenueResolver) {
  const member = venueMember(resolve);
  return async (req: Request, res: Response, next: NextFunction) => {
    await member(req, res, async () => {
      if (req.staffMember) {
        const m = await db.query.staff.findFirst({ where: eq(staff.id, req.staffMember.staffId) });
        if (m?.role !== 'manager') throw new HttpError(403, 'Only the owner and managers can see stock');
      }
      next();
    });
  };
}

/**
 * Owner of the venue, or an active manager or kitchen staff member. Used for
 * the kitchen screen. Does its own token check.
 */
export function venueKitchen(resolve: VenueResolver) {
  const member = venueMember(resolve);
  return async (req: Request, res: Response, next: NextFunction) => {
    await member(req, res, async () => {
      if (req.staffMember) {
        const m = await db.query.staff.findFirst({ where: eq(staff.id, req.staffMember.staffId) });
        if (m?.role !== 'manager' && m?.role !== 'kitchen') throw new HttpError(403, 'Only the kitchen, managers and the owner use the kitchen screen');
      }
      next();
    });
  };
}

export const venueOfOrderItem = (param = 'orderItemId'): VenueResolver => async (req) =>
  (await db.query.orderItems.findFirst({
    where: eq(orderItems.id, req.params[param]),
    with: { order: { with: { tab: { with: { table: true } } } } },
  }))?.order?.tab?.table?.venueId;

/**
 * The venue's package must include this feature (Starter / Pro / Bar+). Put it
 * after the access check. Guests are never blocked mid-meal by this: it guards
 * owner and manager screens only.
 */
export function planFeature(feature: PlanFeature, resolve: VenueResolver) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const venueId = await resolveVenueId(resolve, req);
    const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
    if (!venue || !venueAllows(venue, feature)) {
      throw new HttpError(403, `This is part of ${PLANS[PLAN_FOR[feature]].name}. Switch package in Plan to use it.`);
    }
    next();
  };
}
