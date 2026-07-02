import { db } from "../lib/db";
import { tables, tableAssignments, staff, qrStickers } from "../models/schema";
import { eq, and } from "drizzle-orm";
import { createUnclaimedSticker, claimSticker } from "./qr.service";

// Owner: replace all table assignments for a staff member (permanent, no date)
export async function assignTablesToStaff(staffId: string, tableIds: string[]) {
  await db
    .delete(tableAssignments)
    .where(eq(tableAssignments.staffId, staffId));

  if (tableIds.length === 0) return [];

  const rows = tableIds.map((tableId) => ({
    staffId,
    tableId,
    shiftDate: "permanent",
  }));
  const inserted = await db.insert(tableAssignments).values(rows).returning();
  return inserted;
}

// Owner: get all assignments for a venue
export async function getVenueAssignments(venueId: string) {
  const allStaff = await db.query.staff.findMany({
    where: and(eq(staff.venueId, venueId), eq(staff.isActive, true)),
    with: {
      tableAssignments: { with: { table: true } },
    },
  });

  return allStaff.map((s) => ({
    staffId: s.id,
    name: s.name,
    tableIds: s.tableAssignments.map((a) => a.tableId),
    tables: s.tableAssignments.map((a) => ({
      id: a.table.id,
      label: a.table.label,
    })),
  }));
}

// Waiter: get their assigned tables
export async function getMyAssignedTables(staffId: string) {
  const assignments = await db.query.tableAssignments.findMany({
    where: eq(tableAssignments.staffId, staffId),
    with: { table: true },
  });

  return assignments.map((a) => ({
    tableId: a.tableId,
    label: a.table.label,
    isActive: a.table.isActive,
  }));
}

export async function createTable(venueId: string, label: string) {
  const [table] = await db
    .insert(tables)
    .values({ venueId, label })
    .returning();

  const sticker = await createUnclaimedSticker();
  await claimSticker(sticker.code, table.id);

  return { table, qrCode: sticker.code };
}

export async function claimScannedTable(
  venueId: string,
  label: string,
  scannedCode: string,
) {
  const code = scannedCode.includes("/t/")
    ? scannedCode.split("/t/").pop()!.trim()
    : scannedCode.trim();

  const existing = await db.query.qrStickers.findFirst({
    where: eq(qrStickers.code, code),
  });

  if (!existing) {
    await db.insert(qrStickers).values({ code, status: "unclaimed" });
  } else if (existing.status === "claimed") {
    throw new Error("This QR sticker is already assigned to a table.");
  }

  const [table] = await db
    .insert(tables)
    .values({ venueId, label })
    .returning();
  return claimSticker(code, table.id);
}

export async function getTablesForVenue(venueId: string) {
  const rows = await db.query.tables.findMany({
    where: eq(tables.venueId, venueId),
    with: { qrSticker: true },
  });
  return rows;
}

export async function getTableById(id: string) {
  return db.query.tables.findFirst({
    where: eq(tables.id, id),
    with: { venue: true, qrSticker: true },
  });
}
