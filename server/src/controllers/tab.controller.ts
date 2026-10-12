import { Request, Response } from 'express';
import { openTab, openTabByTableId, previewTable, getTab, nudgeWaiter, requestBill, getTabBill, closeTab } from '../services/tab.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';

const openTabSchema = z.object({
  qrCode: z.string().min(1),
  phone: z.string().min(9).max(15),
  name: z.string().max(100).optional(),
});

export async function handleOpenTab(req: Request, res: Response) {
  const parsed = openTabSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const result = await openTab(parsed.data.qrCode, parsed.data.phone, parsed.data.name);
  const body: ApiResponse = { success: true, data: result };
  res.status(result.isExisting ? 200 : 201).json(body);
}

export async function handlePreviewTable(req: Request, res: Response) {
  const result = await previewTable(req.params.qrCode);
  if (!result) {
    const body: ApiResponse = { success: false, error: "This table isn't set up in Skuzi yet. Please ask a waiter." };
    res.status(404).json(body);
    return;
  }
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

export async function handleGetTab(req: Request, res: Response) {
  const tab = await getTab(req.params.tabId);
  if (!tab) {
    const body: ApiResponse = { success: false, error: 'Tab not found' };
    res.status(404).json(body);
    return;
  }
  const body: ApiResponse = { success: true, data: tab };
  res.json(body);
}

export async function handleNudgeWaiter(req: Request, res: Response) {
  const result = await nudgeWaiter(req.params.tabId);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

export async function handleRequestBill(req: Request, res: Response) {
  const result = await requestBill(req.params.tabId);
  const body: ApiResponse = { success: true, data: result };
  res.json(body);
}

export async function handleGetTabBill(req: Request, res: Response) {
  const bill = await getTabBill(req.params.tabId);
  const body: ApiResponse = { success: true, data: bill };
  res.json(body);
}

export async function handleCloseTab(req: Request, res: Response) {
  try {
    const result = await closeTab(req.params.tabId);
    const body: ApiResponse = { success: true, data: result };
    res.json(body);
  } catch (err: any) {
    // Silently succeed for beacon calls — tab may already be closed
    const body: ApiResponse = { success: true, data: null };
    res.json(body);
  }
}


const staffOpenTabSchema = z.object({
  tableId: z.string().uuid(),
  phone: z.string().min(9).max(15).optional(),
});

export async function handleStaffOpenTab(req: Request, res: Response) {
  const parsed = staffOpenTabSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const result = await openTabByTableId(parsed.data.tableId, parsed.data.phone);
  const body: ApiResponse = { success: true, data: result };
  res.status(201).json(body);
}
