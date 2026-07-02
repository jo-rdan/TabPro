import { Request, Response } from 'express';
import { getMenuForVenue, createMenuItemsBatch } from '../services/menu.service';
import { extractMenuFromImage, extractMenuFromText } from '../services/menuExtract.service';
import { ApiResponse } from '@tabpro/shared';
import { z } from 'zod';
import { db } from '../lib/db';
import { menuItems } from '../models/schema';
import { eq } from 'drizzle-orm';

export async function handleGetMenu(req: Request, res: Response) {
  const { venueId } = req.params;
  const menu = await getMenuForVenue(venueId);
  const body: ApiResponse = { success: true, data: menu };
  res.json(body);
}

const menuItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  priceRwf: z.number().int().positive(),
});

const createMenuItemsSchema = z.object({
  venueId: z.string().uuid(),
  items: z.array(menuItemSchema).min(1),
});

export async function handleCreateMenuItems(req: Request, res: Response) {
  const parsed = createMenuItemsSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }
  const items = await createMenuItemsBatch(parsed.data.venueId, parsed.data.items);
  const body: ApiResponse = { success: true, data: items };
  res.status(201).json(body);
}

// Extract menu items from uploaded file using AI
export async function handleExtractMenu(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    const body: ApiResponse = { success: false, error: 'No file uploaded' };
    res.status(400).json(body);
    return;
  }

  const { mimetype, buffer } = file;

  // Excel → extract text via xlsx
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel'
  ) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      lines.push(XLSX.utils.sheet_to_csv(sheet));
    }
    const text = lines.join('\n');
    const extracted = await extractMenuFromText(text);
    const body: ApiResponse = { success: true, data: extracted };
    res.json(body);
    return;
  }

  // Word (.docx) → extract text via mammoth
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const extracted = await extractMenuFromText(result.value);
    const body: ApiResponse = { success: true, data: extracted };
    res.json(body);
    return;
  }

  // Image or PDF — existing flow
  const base64 = buffer.toString('base64');
  const extracted = await extractMenuFromImage(base64, mimetype);
  const body: ApiResponse = { success: true, data: extracted };
  res.json(body);
}

// Toggle menu item availability
export async function handleToggleAvailability(req: Request, res: Response) {
  const { itemId } = req.params;
  const item = await db.query.menuItems.findFirst({ where: eq(menuItems.id, itemId) });
  if (!item) {
    const body: ApiResponse = { success: false, error: 'Item not found' };
    res.status(404).json(body);
    return;
  }
  const [updated] = await db
    .update(menuItems)
    .set({ isAvailable: !item.isAvailable })
    .where(eq(menuItems.id, itemId))
    .returning();
  const body: ApiResponse = { success: true, data: updated };
  res.json(body);
}

// Update item price
export async function handleUpdateMenuItem(req: Request, res: Response) {
  const { itemId } = req.params;
  const parsed = z.object({
    name: z.string().min(1).optional(),
    priceRwf: z.number().int().positive().optional(),
    category: z.string().min(1).optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    const body: ApiResponse = { success: false, error: parsed.error.errors[0].message };
    res.status(400).json(body);
    return;
  }

  const [updated] = await db
    .update(menuItems)
    .set(parsed.data)
    .where(eq(menuItems.id, itemId))
    .returning();
  const body: ApiResponse = { success: true, data: updated };
  res.json(body);
}

// Delete menu item
export async function handleDeleteMenuItem(req: Request, res: Response) {
  await db.delete(menuItems).where(eq(menuItems.id, req.params.itemId));
  const body: ApiResponse = { success: true };
  res.json(body);
}
