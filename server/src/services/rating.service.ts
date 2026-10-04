import { sendPushToOwner } from './push.service';
import { db } from '../lib/db';
import { ratings, staffPoints, tabs, staff } from '../models/schema';
import { eq, desc, sum } from 'drizzle-orm';

function calculatePoints(waiterScore: number, overallScore: number): number {
  // Base: waiter score * 10 (10–50 points)
  // Bonus: +10 if overall >= 4
  return waiterScore * 10 + (overallScore >= 4 ? 10 : 0);
}

export async function submitRating(
  tabId: string,
  foodScore: number,
  waiterScore: number,
  overallScore: number,
  comment?: string
) {
  // Validate tab exists and is closed
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
    with: { table: { with: { venue: true } } },
  });

  if (!tab) throw new Error('Tab not found');
  if (tab.status !== 'closed') throw new Error('Tab must be closed before rating');

  // Check if already rated
  const existing = await db.query.ratings.findFirst({
    where: eq(ratings.tabId, tabId),
  });
  if (existing) throw new Error('This tab has already been rated');

  // Create rating
  const [rating] = await db
    .insert(ratings)
    .values({
      tabId,
      venueId: tab.table.venueId,
      staffId: tab.staffId ?? null,
      foodScore,
      waiterScore,
      overallScore,
      comment: comment?.trim() || null,
    })
    .returning();

  // A disappointed guest is something the owner wants to know about tonight, not next week.
  if (overallScore <= 2) {
    await sendPushToOwner(
      tab.table.venueId,
      `⭐ ${tab.table.label} rated their visit ${overallScore}/5`,
      comment?.trim() ? `"${comment.trim().slice(0, 120)}"` : 'No comment left. Worth checking on the floor.',
    );
  }

  // Award points to waiter if one was assigned
  if (tab.staffId) {
    const points = calculatePoints(waiterScore, overallScore);
    await db.insert(staffPoints).values({
      staffId: tab.staffId,
      points,
      reason: `Rating: ${waiterScore}/5 waiter, ${overallScore}/5 overall`,
    });
  }

  return rating;
}

export async function getLeaderboard(venueId: string) {
  // Get all staff with their total points and rating stats
  const { staff } = await import('../models/schema');

  const allStaff = await db.query.staff.findMany({
    where: eq(staff.venueId, venueId),
    with: {
      points: true,
      ratings: true,
    },
  });

  const leaderboard = allStaff.map((s) => {
    const totalPoints = s.points.reduce((sum, p) => sum + p.points, 0);
    const ratingCount = s.ratings.length;
    const avgRating = ratingCount > 0
      ? s.ratings.reduce((sum, r) => sum + r.waiterScore, 0) / ratingCount
      : 0;

    return {
      staffId: s.id,
      name: s.name,
      totalPoints,
      ratingCount,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  });

  return leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function getRatingsBreakdown(venueId: string) {
  const allRatings = await db.query.ratings.findMany({
    where: eq(ratings.venueId, venueId),
    with: { staff: true },
    orderBy: [desc(ratings.createdAt)],
  });

  if (allRatings.length === 0) {
    return { totals: null, weekly: [], byWaiter: [], comments: [] };
  }

  // ── Overall totals ───────────────────────────────────────────────────────
  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;

  const totals = {
    count: allRatings.length,
    food: avg(allRatings.map((r) => r.foodScore)),
    waiter: avg(allRatings.map((r) => r.waiterScore)),
    overall: avg(allRatings.map((r) => r.overallScore)),
  };

  // ── Weekly trend (last 8 weeks) ──────────────────────────────────────────
  const weekly: { week: string; food: number | null; waiter: number | null; overall: number | null; count: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const from = new Date();
    from.setDate(from.getDate() - (w + 1) * 7);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() - w * 7);
    to.setHours(23, 59, 59, 999);

    const slice = allRatings.filter((r) => {
      const d = new Date(r.createdAt);
      return d >= from && d <= to;
    });

    weekly.push({
      week: from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      food: avg(slice.map((r) => r.foodScore)),
      waiter: avg(slice.map((r) => r.waiterScore)),
      overall: avg(slice.map((r) => r.overallScore)),
      count: slice.length,
    });
  }

  // ── Per-waiter breakdown ─────────────────────────────────────────────────
  const waiterMap = new Map<string, { name: string; food: number[]; waiter: number[]; overall: number[] }>();
  for (const r of allRatings) {
    if (!r.staffId || !r.staff) continue;
    if (!waiterMap.has(r.staffId)) {
      waiterMap.set(r.staffId, { name: r.staff.name, food: [], waiter: [], overall: [] });
    }
    const entry = waiterMap.get(r.staffId)!;
    entry.food.push(r.foodScore);
    entry.waiter.push(r.waiterScore);
    entry.overall.push(r.overallScore);
  }

  const byWaiter = Array.from(waiterMap.entries()).map(([staffId, e]) => ({
    staffId,
    name: e.name,
    count: e.food.length,
    food: avg(e.food),
    waiter: avg(e.waiter),
    overall: avg(e.overall),
  })).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));

  // ── Written comments ─────────────────────────────────────────────────────
  const comments = allRatings
    .filter((r) => r.comment?.trim())
    .map((r) => ({
      id: r.id,
      comment: r.comment!,
      overall: r.overallScore,
      waiterName: r.staff?.name ?? null,
      createdAt: r.createdAt,
    }));

  return { totals, weekly, byWaiter, comments };
}
