import { db } from '../lib/db';
import { shifts } from '../models/schema';
import { eq, asc } from 'drizzle-orm';
import { autoAssignShiftsForVenue } from './autoAssign.service';

export async function getShiftsForVenue(venueId: string) {
  const rows = await db.query.shifts.findMany({
    where: eq(shifts.venueId, venueId),
    orderBy: [asc(shifts.startTime)],
    with: {
      assignments: {
        with: { staff: true },
      },
    },
  });

  return rows.map((shift) => ({
    id: shift.id,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    assignedStaff: shift.assignments.map((a) => ({ id: a.staff.id, name: a.staff.name })),
  }));
}

export async function createShift(venueId: string, name: string, startTime: string, endTime: string) {
  const [shift] = await db
    .insert(shifts)
    .values({ venueId, name, startTime, endTime })
    .returning();

  await autoAssignShiftsForVenue(venueId);

  return shift;
}

export async function updateShift(shiftId: string, name: string, startTime: string, endTime: string) {
  const [shift] = await db
    .update(shifts)
    .set({ name, startTime, endTime })
    .where(eq(shifts.id, shiftId))
    .returning();
  return shift;
}

export async function deleteShift(shiftId: string, venueId: string) {
  await db.delete(shifts).where(eq(shifts.id, shiftId));
  await autoAssignShiftsForVenue(venueId);
}
