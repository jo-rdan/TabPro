import { Request, Response } from 'express';
import { placeOrder, updateOrderStatus, getOrdersForVenue } from '../services/order.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { staff, tabs, venues } from '../models/schema';

// "Entered by staff" only counts with a signed-in waiter, manager or owner of
// this venue; anyone else's order is a guest order (it matters when guest
// ordering is paused for an unpaid package).
async function isVenueStaff(authHeader: string | undefined, tabId: string) {
  if (!authHeader?.startsWith('Bearer ')) return false;
  let payload: { staffId?: string; ownerId?: string };
  try {
    payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as any;
  } catch {
    return false;
  }
  const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId), with: { table: true } });
  if (!tab) return false;
  if (payload.staffId) {
    const m = await db.query.staff.findFirst({ where: eq(staff.id, payload.staffId) });
    return !!m && m.isActive && m.venueId === tab.table.venueId;
  }
  if (payload.ownerId) {
    const v = await db.query.venues.findFirst({ where: eq(venues.id, tab.table.venueId) });
    return v?.ownerId === payload.ownerId;
  }
  return false;
}

const placeOrderSchema = z.object({
  tabId: z.string().uuid(),
  source: z.enum(['customer', 'staff']).default('customer'),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
});

export async function handlePlaceOrder(req: Request, res: Response) {
  const parsed = placeOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const source = parsed.data.source === 'staff' && (await isVenueStaff(req.headers.authorization, parsed.data.tabId)) ? 'staff' : 'customer';
  const result = await placeOrder(parsed.data.tabId, parsed.data.items, source);
  const body: ApiResponse = { success: true, data: result };
  res.status(201).json(body);
}

const updateStatusSchema = z.object({
  status: z.enum(['preparing', 'delivered']),
});

export async function handleUpdateOrderStatus(req: Request, res: Response) {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const order = await updateOrderStatus(req.params.orderId, parsed.data.status);
  const body: ApiResponse = { success: true, data: order };
  res.json(body);
}

export async function handleGetVenueOrders(req: Request, res: Response) {
  const tabs = await getOrdersForVenue(req.params.venueId);
  const body: ApiResponse = { success: true, data: tabs };
  res.json(body);
}
