// Opening hours and booking times, in Kigali time (UTC+2 all year, no DST).
// A venue's night belongs to the day it starts: Friday 18:00 → 02:00 is
// "Friday", so a 00:30 booking that night is on Friday's list.

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type DayHours = { open: string; close: string } | null;
export type OpeningHours = Record<DayKey, DayHours>;

export const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const KIGALI_OFFSET_MS = 2 * 60 * 60_000;
const SLOT_MIN = 30;
// The last booking starts an hour before closing; nothing within 30 minutes of now.
const LAST_SLOT_BEFORE_CLOSE_MIN = 60;
const LEAD_MIN = 30;
export const MAX_DAYS_AHEAD = 30;

// Used until the owner sets their own hours.
export const DEFAULT_HOURS: OpeningHours = {
  sun: { open: '11:00', close: '23:00' }, mon: { open: '11:00', close: '23:00' },
  tue: { open: '11:00', close: '23:00' }, wed: { open: '11:00', close: '23:00' },
  thu: { open: '11:00', close: '23:00' }, fri: { open: '11:00', close: '23:00' },
  sat: { open: '11:00', close: '23:00' },
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const fmt = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Valid hours: every day present, each null or { open, close } as HH:MM, open ≠ close. */
export function parseHours(raw: unknown): OpeningHours | null {
  if (!raw || typeof raw !== 'object') return null;
  const out = {} as OpeningHours;
  for (const k of DAY_KEYS) {
    const d = (raw as any)[k];
    if (d === null || d === undefined) { out[k] = null; continue; }
    if (typeof d !== 'object' || !HHMM.test(d.open) || !HHMM.test(d.close) || d.open === d.close) return null;
    out[k] = { open: d.open, close: d.close };
  }
  return out;
}

export const hoursOf = (raw: unknown): OpeningHours => parseHours(raw) ?? DEFAULT_HOURS;

/** "YYYY-MM-DD" of an instant, in Kigali. */
export function kigaliDateKey(d: Date): string {
  return new Date(d.getTime() + KIGALI_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant of a Kigali date at minute-of-day `min` (may exceed 1440: next day). */
function instant(dateKey: string, min: number): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, min) - KIGALI_OFFSET_MS);
}

export function addDaysKey(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const dayKeyOf = (dateKey: string): DayKey => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

/** The night's [start, end) for a Kigali date, or null when closed that day. */
export function nightWindow(hours: OpeningHours, dateKey: string): { start: Date; end: Date } | null {
  const h = hours[dayKeyOf(dateKey)];
  if (!h) return null;
  const open = toMin(h.open);
  let close = toMin(h.close);
  if (close <= open) close += 1440;
  return { start: instant(dateKey, open), end: instant(dateKey, close) };
}

/** Open right now? Checks tonight and last night (which may run past midnight). */
export function openStatus(hours: OpeningHours, now = new Date()): { open: boolean; closesAt?: string; opensAt?: string } {
  const today = kigaliDateKey(now);
  for (const key of [addDaysKey(today, -1), today]) {
    const w = nightWindow(hours, key);
    if (w && now >= w.start && now < w.end) return { open: true, closesAt: hours[dayKeyOf(key)]!.close };
  }
  for (let i = 0; i < 7; i++) {
    const key = addDaysKey(today, i);
    const w = nightWindow(hours, key);
    if (w && w.start > now) return { open: false, opensAt: i === 0 ? hours[dayKeyOf(key)]!.open : `${dayKeyOf(key)} ${hours[dayKeyOf(key)]!.open}` };
  }
  return { open: false };
}

/** Bookable times on a Kigali date: every 30 min from opening to an hour before closing. */
export function bookingSlots(hours: OpeningHours, dateKey: string, now = new Date()): { time: string; startsAt: Date }[] {
  const w = nightWindow(hours, dateKey);
  if (!w) return [];
  const earliest = now.getTime() + LEAD_MIN * 60_000;
  const last = w.end.getTime() - LAST_SLOT_BEFORE_CLOSE_MIN * 60_000;
  const slots: { time: string; startsAt: Date }[] = [];
  for (let t = w.start.getTime(); t <= last; t += SLOT_MIN * 60_000) {
    if (t < earliest) continue;
    const startsAt = new Date(t);
    slots.push({ time: fmt(Math.round((t + KIGALI_OFFSET_MS) / 60_000)), startsAt });
  }
  return slots;
}

/** "HH:MM" of an instant in Kigali. */
export const kigaliTime = (d: Date) => fmt(Math.round((d.getTime() + KIGALI_OFFSET_MS) / 60_000));
