import { Request, Response } from 'express';
import { placeOrder, updateOrderStatus, getOrdersForVenue } from '../services/order.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

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

  const result = await placeOrder(parsed.data.tabId, parsed.data.items, parsed.data.source);
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
