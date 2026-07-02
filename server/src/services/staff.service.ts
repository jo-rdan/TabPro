import { db } from '../lib/db';
import { staff, staffInvites, staffPoints, ratings, tableAssignments } from '../models/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { autoAssignTablesForVenue, autoAssignShiftsForVenue } from './autoAssign.service';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendInviteSms, buildWhatsAppLink } from './messaging.service';

export async function setPin(staffId: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
  const hash = await bcrypt.hash(pin, 10);
  await db.update(staff).set({ pin: hash }).where(eq(staff.id, staffId));
}

export async function verifyPin(staffId: string, pin: string): Promise<boolean> {
  const member = await db.query.staff.findFirst({ where: eq(staff.id, staffId) });
  if (!member || !member.pin) return false;
  return bcrypt.compare(pin, member.pin);
}

export async function loginByPhone(phone: string, pin: string): Promise<{ token: string; staffId: string; venueId: string; name: string } | null> {
  const normalizedPhone = phone.replace(/\s/g, '');
  const member = await db.query.staff.findFirst({
    where: and(eq(staff.phone, normalizedPhone), eq(staff.isActive, true)),
  });

  if (!member || !member.pin) return null;

  const valid = await bcrypt.compare(pin, member.pin);
  if (!valid) return null;

  const token = signStaffJwt(member.id, member.venueId);
  return { token, staffId: member.id, venueId: member.venueId, name: member.name };
}

export function signStaffJwt(staffId: string, venueId: string): string {
  return jwt.sign({ staffId, venueId }, process.env.JWT_SECRET!, { expiresIn: '90d' });
}

export async function getMyPoints(staffId: string) {
  const staffMember = await db.query.staff.findFirst({
    where: eq(staff.id, staffId),
    with: {
      points: { orderBy: [desc(staffPoints.createdAt)] },
      ratings: true,
    },
  });

  if (!staffMember) throw new Error('Staff not found');

  const totalPoints = staffMember.points.reduce((sum, p) => sum + p.points, 0);
  const ratingCount = staffMember.ratings.length;
  const avgRating = ratingCount > 0
    ? Math.round((staffMember.ratings.reduce((sum, r) => sum + r.waiterScore, 0) / ratingCount) * 10) / 10
    : null;

  // Weekly points (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyPoints = staffMember.points
    .filter((p) => new Date(p.createdAt) >= weekAgo)
    .reduce((sum, p) => sum + p.points, 0);

  return {
    staffId,
    name: staffMember.name,
    totalPoints,
    weeklyPoints,
    avgRating,
    ratingCount,
    history: staffMember.points.map((p) => ({
      id: p.id,
      points: p.points,
      reason: p.reason,
      createdAt: p.createdAt,
    })),
  };
}

export async function toggleStaffActive(staffId: string, isActive: boolean) {
  const [updated] = await db
    .update(staff)
    .set({ isActive })
    .where(eq(staff.id, staffId))
    .returning();
  if (!updated) throw new Error('Staff not found');

  // Re-distribute tables and shifts after activation change
  await autoAssignTablesForVenue(updated.venueId);
  await autoAssignShiftsForVenue(updated.venueId);

  return updated;
}

export async function createStaff(venueId: string, name: string, phone: string) {
  // Check if staff with this phone already exists in venue
  const existing = await db.query.staff.findFirst({
    where: eq(staff.phone, phone),
  });

  let staffMember = existing;

  if (!staffMember) {
    const [created] = await db
      .insert(staff)
      .values({ venueId, name, phone, role: 'waiter' })
      .returning();
    staffMember = created;
  }

  // ── Auto-assign tables and shifts evenly across all active waiters ────────
  await autoAssignTablesForVenue(venueId);
  await autoAssignShiftsForVenue(venueId);

  // Create invite token
  const token = randomBytes(16).toString('hex');
  const [invite] = await db
    .insert(staffInvites)
    .values({ staffId: staffMember.id, channel: 'whatsapp', token })
    .returning();

  const inviteUrl = `${process.env.CLIENT_URL}/invite/${token}`;

  // Auto-send SMS (silent fail if AT credentials not configured)
  const smsResult = await sendInviteSms(staffMember.phone, staffMember.name, inviteUrl);

  // Always provide a WhatsApp deep link for the owner to tap
  const whatsappLink = buildWhatsAppLink(staffMember.phone, staffMember.name, inviteUrl);

  return { staff: staffMember, invite, token, smsSent: smsResult.sent, whatsappLink };
}

export async function resendInvite(staffId: string) {
  const staffMember = await db.query.staff.findFirst({
    where: eq(staff.id, staffId),
    with: { invites: { orderBy: [desc(staffInvites.sentAt)] } },
  });
  if (!staffMember) throw new Error('Staff not found');

  const latestInvite = staffMember.invites[0];
  if (!latestInvite) throw new Error('No invite found for this staff member');

  const inviteUrl = `${process.env.CLIENT_URL}/invite/${latestInvite.token}`;
  const smsResult = await sendInviteSms(staffMember.phone, staffMember.name, inviteUrl);
  const whatsappLink = buildWhatsAppLink(staffMember.phone, staffMember.name, inviteUrl);

  return { smsSent: smsResult.sent, whatsappLink, token: latestInvite.token };
}

export async function acceptInvite(token: string) {
  const invite = await db.query.staffInvites.findFirst({
    where: eq(staffInvites.token, token),
    with: { staff: true },
  });

  if (!invite) throw new Error('Invite not found');
  if (invite.acceptedAt) throw new Error('Invite already accepted');

  await db
    .update(staffInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(staffInvites.id, invite.id));

  const staffJwt = signStaffJwt(invite.staff.id, invite.staff.venueId);

  return { staff: invite.staff, token: staffJwt };
}

export async function getStaffForVenue(venueId: string) {
  const allStaff = await db.query.staff.findMany({
    where: eq(staff.venueId, venueId),
    with: {
      invites: { orderBy: [desc(staffInvites.sentAt)] },
      points: true,
      ratings: true,
    },
  });

  return allStaff.map((s) => {
    const totalPoints = s.points.reduce((sum, p) => sum + p.points, 0);
    const ratingCount = s.ratings.length;
    const avgRating = ratingCount > 0
      ? Math.round((s.ratings.reduce((sum, r) => sum + r.waiterScore, 0) / ratingCount) * 10) / 10
      : null;
    const latestInvite = s.invites[0] ?? null;
    const inviteStatus = !latestInvite ? 'none'
      : latestInvite.acceptedAt ? 'active'
      : 'invited';

    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      role: s.role,
      isActive: s.isActive,
      inviteStatus,
      inviteToken: latestInvite?.acceptedAt ? null : latestInvite?.token ?? null,
      totalPoints,
      ratingCount,
      avgRating,
    };
  });
}
