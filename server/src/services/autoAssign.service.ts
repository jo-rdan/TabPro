import { db } from '../lib/db';
import { staff, tables, tableAssignments, shifts, shiftAssignments } from '../models/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Evenly distributes all venue tables across all active waiters using round-robin.
 * Safe to call any time — fully replaces existing assignments.
 * No-op if there are no tables or no active staff.
 */
export async function autoAssignTablesForVenue(venueId: string): Promise<void> {
  // Fetch active tables and active staff in parallel
  const [allTables, activeStaff] = await Promise.all([
    db.query.tables.findMany({
      where: and(eq(tables.venueId, venueId), eq(tables.isActive, true)),
    }),
    db.query.staff.findMany({
      where: and(eq(staff.venueId, venueId), eq(staff.isActive, true)),
    }),
  ]);

  // Nothing to assign — clear any stale assignments and exit
  if (activeStaff.length === 0 || allTables.length === 0) {
    if (activeStaff.length > 0) {
      const staffIds = activeStaff.map((s) => s.id);
      await db.delete(tableAssignments).where(inArray(tableAssignments.staffId, staffIds));
    }
    return;
  }

  // Clear all existing assignments for this venue's staff
  const staffIds = activeStaff.map((s) => s.id);
  await db.delete(tableAssignments).where(inArray(tableAssignments.staffId, staffIds));

  // Managers run the floor rather than serve tables, unless nobody else can.
  const waiters = activeStaff.filter((s) => s.role === 'waiter');
  const servers = waiters.length > 0 ? waiters : activeStaff;

  // Round-robin distribution
  const rows = allTables.map((table, i) => ({
    staffId: servers[i % servers.length].id,
    tableId: table.id,
    shiftDate: 'permanent',
  }));

  await db.insert(tableAssignments).values(rows);
}

/**
 * Evenly distributes all venue shifts across all active waiters using round-robin.
 * Safe to call any time — fully replaces existing assignments.
 * No-op if there are no shifts or no active staff.
 */
export async function autoAssignShiftsForVenue(venueId: string): Promise<void> {
  const [allShifts, activeStaff] = await Promise.all([
    db.query.shifts.findMany({
      where: eq(shifts.venueId, venueId),
    }),
    db.query.staff.findMany({
      where: and(eq(staff.venueId, venueId), eq(staff.isActive, true)),
    }),
  ]);

  if (activeStaff.length === 0 || allShifts.length === 0) {
    if (activeStaff.length > 0) {
      const staffIds = activeStaff.map((s) => s.id);
      await db.delete(shiftAssignments).where(inArray(shiftAssignments.staffId, staffIds));
    }
    return;
  }

  const staffIds = activeStaff.map((s) => s.id);
  await db.delete(shiftAssignments).where(inArray(shiftAssignments.staffId, staffIds));

  // Round-robin: each waiter can end up with multiple shifts if shifts > staff
  const rows = allShifts.map((shift, i) => ({
    staffId: activeStaff[i % activeStaff.length].id,
    shiftId: shift.id,
  }));

  await db.insert(shiftAssignments).values(rows);
}
