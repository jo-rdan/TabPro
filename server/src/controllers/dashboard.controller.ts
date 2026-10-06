import { Request, Response } from 'express';
import { getDashboardStats, getActivityLog, getEndOfNightReport } from '../services/dashboard.service';
import { getBusyHoursHeatmap } from '../services/heatmap.service';
import { getLeftOpenBills } from '../services/unpaid.service';
import { getTonight, getNightTotals } from '../services/tonight.service';
import { ApiResponse } from '@tabpro/shared';

export async function handleGetStats(req: Request, res: Response) {
  const stats = await getDashboardStats(req.params.venueId);
  const body: ApiResponse = { success: true, data: stats };
  res.json(body);
}

export async function handleGetActivityLog(req: Request, res: Response) {
  const night = typeof req.query.night === 'string' ? req.query.night : undefined;
  if (night && !/^\d{4}-\d{2}-\d{2}$/.test(night)) {
    res.status(400).json({ success: false, error: 'night must look like 2026-10-04' });
    return;
  }
  const activity = await getActivityLog(req.params.venueId, 100, night);
  const body: ApiResponse = { success: true, data: activity };
  res.json(body);
}

export async function handleGetEndOfNightReport(req: Request, res: Response) {
  const report = await getEndOfNightReport(req.params.venueId);
  const body: ApiResponse = { success: true, data: report };
  res.json(body);
}

export async function handleGetBusyHours(req: Request, res: Response) {
  const data = await getBusyHoursHeatmap(req.params.venueId);
  const body: ApiResponse = { success: true, data };
  res.json(body);
}

export async function handleGetOpenBills(req: Request, res: Response) {
  const data = await getLeftOpenBills(req.params.venueId);
  const body: ApiResponse = { success: true, data };
  res.json(body);
}

export async function handleGetTonight(req: Request, res: Response) {
  const data = await getTonight(req.params.venueId);
  const body: ApiResponse = { success: true, data };
  res.json(body);
}

export async function handleGetNightTotals(req: Request, res: Response) {
  const month = typeof req.query.month === 'string' ? req.query.month : '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    res.status(400).json({ success: false, error: 'month must look like 2026-10' });
    return;
  }
  const data = await getNightTotals(req.params.venueId, month);
  const body: ApiResponse = { success: true, data };
  res.json(body);
}
