import { db } from '../lib/db';
import { staff, staffInvites, staffPoints, ratings, tableAssignments, venues } from '../models/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { autoAssignTablesForVenue, autoAssignShiftsForVenue } from './autoAssign.service';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendInviteSms, buildWhatsAppLink } from './messaging.service';
import { broadcastToVenue } from '../lib/websocket';
import { sendPushToOwner } from './push.service';

export async function setPin(staffId: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
  const hash = await bcrypt.hash(pin, 10);
  await db.update(staff).set({ pin: hash }).where(eq(staff.id, staffId));
}

export async function verifyPin(staffId: string, pin: string): Promise<boolean> {
  if (isLockedOut(staffId)) throw new Error('Too many wrong PINs. Try again in 15 minutes.');
  const member = await db.query.staff.findFirst({ where: eq(staff.id, staffId) });
  if (!member || !member.pin) return false;
  const ok = await bcrypt.compare(pin, member.pin);
  if (ok) failedLogins.delete(staffId);
  else recordFailedLogin(staffId);
  return ok;
}

// Staff phones are stored as 07XXXXXXXX so "+250 788…", "0788…" and
// "788…" all match the same person.
export function normalizeStaffPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('250')) return '0' + digits.slice(3);
  if (digits.length === 9 && digits.startsWith('7')) return '0' + digits;
  return digits;
}

// A 4-digit PIN is only safe if guessing is slow: lock a phone number out for
// 15 minutes after 5 wrong PINs.
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60_000;
const failedLogins = new Map<string, { count: number; firstAt: number }>();

function isLockedOut(key: string): boolean {
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOCKOUT_MS) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_LOGINS;
}

function recordFailedLogin(key: string) {
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCKOUT_MS) failedLogins.set(key, { count: 1, firstAt: Date.now() });
  else entry.count += 1;
}

export async function loginByPhone(phone: string, pin: string): Promise<{ token: string; staffId: string; venueId: string; name: string; role: 'waiter' | 'manager' } | null> {
  const normalizedPhone = normalizeStaffPhone(phone);
  if (isLockedOut(normalizedPhone)) {
    throw new Error('Too many wrong PINs. Try again in 15 minutes or ask your manager.');
  }

  // The same person can work at several venues — one staff record each.
  const members = await db.query.staff.findMany({
    where: and(eq(staff.phone, normalizedPhone), eq(staff.isActive, true)),
    orderBy: [desc(staff.createdAt)],
  });

  for (const member of members) {
    if (member.pin && (await bcrypt.compare(pin, member.pin))) {
      failedLogins.delete(normalizedPhone);
      const token = signStaffJwt(member.id, member.venueId);
      return { token, staffId: member.id, venueId: member.venueId, name: member.name, role: member.role };
    }
  }

  const pending = await db.query.staff.findFirst({
    where: and(eq(staff.phone, normalizedPhone), eq(staff.pendingApproval, true)),
  });
  if (pending?.pin && (await bcrypt.compare(pin, pending.pin))) {
    throw new Error('Your manager has not approved you yet. Ask them to tap "Approve" in TabPro.');
  }

  recordFailedLogin(normalizedPhone);
  return null;
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
    .set({ isActive, pendingApproval: false })
    .where(eq(staff.id, staffId))
    .returning();
  if (!updated) throw new Error('Staff not found');

  // Re-distribute tables and shifts after activation change
  await autoAssignTablesForVenue(updated.venueId);
  await autoAssignShiftsForVenue(updated.venueId);

  return updated;
}

export async function createStaff(
  venueId: string,
  name: string,
  rawPhone: string,
  { role = 'waiter', hasSmartphone = true }: { role?: 'waiter' | 'manager'; hasSmartphone?: boolean } = {},
) {
  const phone = normalizeStaffPhone(rawPhone);

  // Re-inviting someone already on this venue's staff re-uses their record.
  const existing = await db.query.staff.findFirst({
    where: and(eq(staff.venueId, venueId), eq(staff.phone, phone)),
  });

  let staffMember = existing;

  // The owner adding someone who already asked to join counts as approval.
  if (staffMember?.pendingApproval) {
    [staffMember] = await db
      .update(staff)
      .set({ pendingApproval: false, isActive: true, name })
      .where(eq(staff.id, staffMember.id))
      .returning();
  }

  if (!staffMember) {
    const [created] = await db
      .insert(staff)
      .values({ venueId, name, phone, role, hasSmartphone })
      .returning();
    staffMember = created;
  }

  // ── Auto-assign tables and shifts evenly across all active waiters ────────
  await autoAssignTablesForVenue(venueId);
  await autoAssignShiftsForVenue(venueId);

  // No smartphone: nothing to send. They're on the team right away.
  if (!hasSmartphone) {
    return { staff: staffMember, invite: null, token: null, smsSent: false, whatsappLink: null };
  }

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
  // The link stays usable until the waiter has actually set a PIN — otherwise
  // opening it once (then getting interrupted) locks them out for good, since
  // "resend" sends the same link.
  if (invite.acceptedAt && invite.staff.pin) throw new Error('Invite already accepted');

  if (!invite.acceptedAt) {
    await db
      .update(staffInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(staffInvites.id, invite.id));
  }

  const staffJwt = signStaffJwt(invite.staff.id, invite.staff.venueId);

  // Let the owner dashboard know in real time so "Invite sent" flips to "Active"
  // without needing a manual page refresh.
  broadcastToVenue(invite.staff.venueId, {
    type: 'staff_invite_accepted',
    payload: { staffId: invite.staff.id, name: invite.staff.name },
    venueId: invite.staff.venueId,
    timestamp: new Date().toISOString(),
  });

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
    const inviteStatus = !s.hasSmartphone ? 'no_phone' : !latestInvite ? (s.pin ? 'active' : 'none')
      : latestInvite.acceptedAt ? 'active'
      : 'invited';

    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      role: s.role,
      hasSmartphone: s.hasSmartphone,
      isActive: s.isActive,
      pendingApproval: s.pendingApproval,
      inviteStatus,
      inviteToken: latestInvite?.acceptedAt ? null : latestInvite?.token ?? null,
      totalPoints,
      ratingCount,
      avgRating,
    };
  });
}


// ─── Join requests (waiter scans the venue's clock-in sticker) ─────────────────
// Waiters who missed setup day add themselves; nothing changes until the owner
// approves, so a photo of the sticker can't put a stranger on the team.

const MAX_PENDING_PER_VENUE = 20;

export async function requestToJoin(stickerCode: string, name: string, rawPhone: string, pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
  const phone = normalizeStaffPhone(rawPhone);
  if (!/^07\d{8}$/.test(phone)) throw new Error('Enter a Rwandan phone number, e.g. 0781234567');

  const venue = await db.query.venues.findFirst({ where: eq(venues.clockInStickerCode, stickerCode.trim().toUpperCase()) });
  if (!venue) throw new Error('This sticker isn\'t recognized.');

  const existing = await db.query.staff.findFirst({
    where: and(eq(staff.venueId, venue.id), eq(staff.phone, phone)),
  });
  if (existing && !existing.pendingApproval) {
    throw new Error(existing.isActive
      ? 'You are already on the team. Log in with your phone number and PIN.'
      : 'Your account here was switched off. Ask your manager to switch it back on.');
  }

  const pinHash = await bcrypt.hash(pin, 10);
  let member;
  if (existing) {
    [member] = await db.update(staff).set({ name: name.trim(), pin: pinHash }).where(eq(staff.id, existing.id)).returning();
  } else {
    const pending = await db.query.staff.findMany({
      where: and(eq(staff.venueId, venue.id), eq(staff.pendingApproval, true)),
    });
    if (pending.length >= MAX_PENDING_PER_VENUE) {
      throw new Error('Too many people are waiting for approval. Ask your manager to review them first.');
    }
    [member] = await db
      .insert(staff)
      .values({ venueId: venue.id, name: name.trim(), phone, role: 'waiter', pin: pinHash, isActive: false, pendingApproval: true })
      .returning();
  }

  broadcastToVenue(venue.id, {
    type: 'staff_join_request',
    payload: { staffId: member.id, name: member.name },
    venueId: venue.id,
    timestamp: new Date().toISOString(),
  });

  await sendPushToOwner(venue.id, `👋 ${member.name} wants to join your team`, 'Open TabPro to approve or decline.');

  return { name: member.name, venueName: venue.name };
}

export async function approveJoinRequest(staffId: string) {
  const [member] = await db
    .update(staff)
    .set({ isActive: true, pendingApproval: false })
    .where(and(eq(staff.id, staffId), eq(staff.pendingApproval, true)))
    .returning();
  if (!member) throw new Error('This request was already handled.');

  await autoAssignTablesForVenue(member.venueId);
  await autoAssignShiftsForVenue(member.venueId);
  return member;
}

export async function declineJoinRequest(staffId: string) {
  const [member] = await db
    .delete(staff)
    .where(and(eq(staff.id, staffId), eq(staff.pendingApproval, true)))
    .returning();
  if (!member) throw new Error('This request was already handled.');
}

// ─── Owner edits a team member: manager or waiter, smartphone or not ─────────
export async function updateStaff(staffId: string, changes: { role?: 'waiter' | 'manager'; hasSmartphone?: boolean }) {
  const [updated] = await db.update(staff).set(changes).where(eq(staff.id, staffId)).returning();
  if (!updated) throw new Error('Staff not found');
  // Managers don't serve tables when there are waiters: share tables out again.
  if (changes.role) await autoAssignTablesForVenue(updated.venueId);
  return updated;
}
