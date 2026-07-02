import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { venues, staff, shifts, shiftAssignments, shiftLogs, clockInSessions } from '../models/schema';
import { eq, and, gte, isNull, desc, inArray } from 'drizzle-orm';

const SESSION_TTL_SECONDS = 90;

// ─── Static clock-in sticker ────────────────────────────────────────────────────
// TabPro ships pre-printed blank stickers, each already carrying its own unique
// permanent code (e.g. AB3X9K) that means nothing until an owner claims it. The
// owner scans that physical sticker to bind it to their venue — TabPro never
// generates or prints one on the owner's behalf.

export async function getStickerStatus(venueId: string): Promise<{ claimed: boolean; code: string | null }> {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new Error('Venue not found');
  return { claimed: !!venue.clockInStickerCode, code: venue.clockInStickerCode ?? null };
}

// Bind a physical blank sticker's pre-printed code to this venue. One-time and
// permanent: a venue can't re-claim a different sticker once it has one, and a
// sticker already claimed by another venue can't be claimed again.
export async function claimStickerCode(venueId: string, code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();

  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue) throw new Error('Venue not found');
  if (venue.clockInStickerCode) {
    if (venue.clockInStickerCode === normalized) return venue.clockInStickerCode; // re-scanning your own sticker is a no-op
    throw new Error('This venue already has a clock-in sticker claimed.');
  }

  const takenBy = await db.query.venues.findFirst({ where: eq(venues.clockInStickerCode, normalized) });
  if (takenBy) throw new Error('This sticker is already claimed by another venue.');

  await db.update(venues).set({ clockInStickerCode: normalized }).where(eq(venues.id, venueId));
  return normalized;
}

// Public: a phone just scanned the sticker. Look up the venue by its permanent
// code and mint a brand-new one-time session, valid for 90 seconds. A photo of
// the sticker just creates its own fresh (useless-without-the-PIN) session.
export async function startClockInSession(code: string): Promise<{ sessionToken: string; venueId: string; expiresIn: number }> {
  const venue = await db.query.venues.findFirst({ where: eq(venues.clockInStickerCode, code.trim().toUpperCase()) });
  if (!venue) throw new Error('Invalid clock-in sticker.');

  const sessionToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.insert(clockInSessions).values({ venueId: venue.id, token: sessionToken, expiresAt });

  return { sessionToken, venueId: venue.id, expiresIn: SESSION_TTL_SECONDS };
}

// Validate a session belongs to this venue, hasn't expired, and hasn't been used yet.
async function getLiveSession(sessionToken: string, venueId: string) {
  const session = await db.query.clockInSessions.findFirst({
    where: and(eq(clockInSessions.token, sessionToken), eq(clockInSessions.venueId, venueId)),
  });
  if (!session) throw new Error('Session not found. Please scan the sticker again.');
  if (session.usedAt) throw new Error('This session was already used. Please scan the sticker again.');
  if (session.expiresAt.getTime() < Date.now()) throw new Error('Session expired. Please scan the sticker again.');
  return session;
}

// ─── Venue PIN ──────────────────────────────────────────────────────────────────

export async function setClockInPin(venueId: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
  const hash = await bcrypt.hash(pin, 10);
  await db.update(venues).set({ clockInPin: hash }).where(eq(venues.id, venueId));
}

async function verifyClockInPin(venueId: string, pin: string): Promise<boolean> {
  const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
  if (!venue || !venue.clockInPin) return false;
  return bcrypt.compare(pin, venue.clockInPin);
}

// ─── Staff: shifts assigned to them ────────────────────────────────────────────

export async function getMyAssignedShifts(staffId: string) {
  const rows = await db.query.shiftAssignments.findMany({
    where: eq(shiftAssignments.staffId, staffId),
    with: { shift: true },
  });
  return rows.map((r) => r.shift);
}

// Find an open (not-yet-clocked-out) log for this staff member, if any
async function getOpenLog(staffId: string) {
  return db.query.shiftLogs.findFirst({
    where: and(eq(shiftLogs.staffId, staffId), isNull(shiftLogs.clockedOutAt)),
    with: { shift: true },
    orderBy: [desc(shiftLogs.clockedInAt)],
  });
}

// ─── Clock in ───────────────────────────────────────────────────────────────────

export async function clockIn(venueId: string, staffId: string, shiftId: string, pin: string, sessionToken: string) {
  const session = await getLiveSession(sessionToken, venueId);

  const pinOk = await verifyClockInPin(venueId, pin);
  if (!pinOk) throw new Error('Incorrect venue PIN');

  // Confirm this staff member belongs to this venue
  const member = await db.query.staff.findFirst({
    where: and(eq(staff.id, staffId), eq(staff.venueId, venueId), eq(staff.isActive, true)),
  });
  if (!member) throw new Error('Staff member not found at this venue');

  // Confirm shift is actually assigned to them
  const assignment = await db.query.shiftAssignments.findFirst({
    where: and(eq(shiftAssignments.staffId, staffId), eq(shiftAssignments.shiftId, shiftId)),
    with: { shift: true },
  });
  if (!assignment) throw new Error('This shift is not assigned to you');

  // Already clocked in and not out yet?
  const existingOpen = await getOpenLog(staffId);
  if (existingOpen) throw new Error('You are already clocked in. Clock out first.');

  // Determine status: late if more than 15 min past startTime
  const now = new Date();
  const [h, m] = assignment.shift.startTime.split(':').map(Number);
  const shiftStart = new Date(now);
  shiftStart.setHours(h, m, 0, 0);
  const minutesLate = (now.getTime() - shiftStart.getTime()) / 60000;
  const status = minutesLate > 15 ? 'late' : 'on_time';

  const [log] = await db
    .insert(shiftLogs)
    .values({ staffId, shiftId, status })
    .returning();

  // Burn the session so it can't be replayed even within its remaining TTL
  await db.update(clockInSessions).set({ usedAt: new Date() }).where(eq(clockInSessions.id, session.id));

  return { ...log, shiftName: assignment.shift.name, staffName: member.name };
}

// ─── Clock out ──────────────────────────────────────────────────────────────────

export async function clockOut(staffId: string) {
  const openLog = await getOpenLog(staffId);
  if (!openLog) throw new Error('No active clock-in found');

  const [updated] = await db
    .update(shiftLogs)
    .set({ clockedOutAt: new Date() })
    .where(eq(shiftLogs.id, openLog.id))
    .returning();

  return updated;
}

// Current clock state for a staff member (used by the clock-in page to show "End shift" vs picker)
export async function getMyClockStatus(staffId: string) {
  const openLog = await getOpenLog(staffId);
  if (!openLog) return { clockedIn: false };
  return {
    clockedIn: true,
    shiftId: openLog.shiftId,
    shiftName: openLog.shift.name,
    clockedInAt: openLog.clockedInAt,
  };
}

// ─── Owner dashboard: today's attendance ──────────────────────────────────────

export async function getTodayAttendance(venueId: string) {
  const allShifts = await db.query.shifts.findMany({
    where: eq(shifts.venueId, venueId),
    with: {
      assignments: { with: { staff: true } },
    },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // All shift_logs created today for this venue's staff
  const staffIds = [
    ...new Set(allShifts.flatMap((s) => s.assignments.map((a) => a.staffId))),
  ];

  const todaysLogs = staffIds.length
    ? await db.query.shiftLogs.findMany({
        where: and(inArray(shiftLogs.staffId, staffIds), gte(shiftLogs.clockedInAt, todayStart)),
        with: { staff: true, shift: true },
      })
    : [];

  const now = new Date();

  const rows: {
    staffId: string;
    staffName: string;
    shiftId: string;
    shiftName: string;
    shiftTime: string;
    status: 'on_time' | 'late' | 'absent' | 'pending';
    clockedInAt: string | null;
    clockedOutAt: string | null;
  }[] = [];

  for (const shift of allShifts) {
    const [h, m] = shift.startTime.split(':').map(Number);
    const shiftStart = new Date(now);
    shiftStart.setHours(h, m, 0, 0);
    const minutesPastStart = (now.getTime() - shiftStart.getTime()) / 60000;

    for (const assignment of shift.assignments) {
      const log = todaysLogs.find(
        (l) => l.staffId === assignment.staffId && l.shiftId === shift.id,
      );

      if (log) {
        rows.push({
          staffId: assignment.staffId,
          staffName: assignment.staff.name,
          shiftId: shift.id,
          shiftName: shift.name,
          shiftTime: `${shift.startTime} – ${shift.endTime}`,
          status: log.status,
          clockedInAt: log.clockedInAt.toISOString(),
          clockedOutAt: log.clockedOutAt ? log.clockedOutAt.toISOString() : null,
        });
      } else if (minutesPastStart > 15) {
        // Absent: shift started >15 min ago, no log
        rows.push({
          staffId: assignment.staffId,
          staffName: assignment.staff.name,
          shiftId: shift.id,
          shiftName: shift.name,
          shiftTime: `${shift.startTime} – ${shift.endTime}`,
          status: 'absent',
          clockedInAt: null,
          clockedOutAt: null,
        });
      } else {
        // Shift hasn't started yet (or just started, within grace period)
        rows.push({
          staffId: assignment.staffId,
          staffName: assignment.staff.name,
          shiftId: shift.id,
          shiftName: shift.name,
          shiftTime: `${shift.startTime} – ${shift.endTime}`,
          status: 'pending',
          clockedInAt: null,
          clockedOutAt: null,
        });
      }
    }
  }

  return rows;
}

// ─── Owner dashboard: weekly hours per waiter ──────────────────────────────────

export async function getWeeklyHours(venueId: string) {
  const monday = new Date();
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const venueStaff = await db.query.staff.findMany({
    where: and(eq(staff.venueId, venueId), eq(staff.isActive, true)),
  });
  const staffIds = venueStaff.map((s) => s.id);
  if (staffIds.length === 0) return [];

  const logs = await db.query.shiftLogs.findMany({
    where: and(inArray(shiftLogs.staffId, staffIds), gte(shiftLogs.clockedInAt, monday)),
  });

  const hoursByStaff = new Map<string, number>();
  for (const log of logs) {
    if (!log.clockedOutAt) continue; // only count completed shifts
    const hrs = (log.clockedOutAt.getTime() - log.clockedInAt.getTime()) / 3_600_000;
    hoursByStaff.set(log.staffId, (hoursByStaff.get(log.staffId) ?? 0) + hrs);
  }

  return venueStaff.map((s) => ({
    staffId: s.id,
    staffName: s.name,
    hours: Math.round((hoursByStaff.get(s.id) ?? 0) * 10) / 10,
  }));
}
