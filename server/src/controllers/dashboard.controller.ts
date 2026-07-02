import { Request, Response } from 'express';
import { getDashboardStats, getActivityLog, getEndOfNightReport } from '../services/dashboard.service';
import { getBusyHoursHeatmap } from '../services/heatmap.service';
import { ApiResponse } from '@tabpro/shared';

export async function handleGetStats(req: Request, res: Response) {
  const stats = await getDashboardStats(req.params.venueId);
  const body: ApiResponse = { success: true, data: stats };
  res.json(body);
}

export async function handleGetActivityLog(req: Request, res: Response) {
  const activity = await getActivityLog(req.params.venueId);
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
