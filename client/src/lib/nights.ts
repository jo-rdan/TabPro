// A bar's night runs 06:00 → 06:00 Kigali time (UTC+2, no daylight saving).
// Nights are keyed by the evening's date: "2026-10-04".
const DAY = 24 * 3600_000;
const KIGALI = 2 * 3600_000;

export function nightKey(offsetDays = 0) {
  const now = Date.now() + KIGALI;
  const local = new Date(now - (new Date(now).getUTCHours() < 6 ? DAY : 0) - offsetDays * DAY);
  return local.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay(); // 0 = Sunday

/** Most recent night before tonight that fell on this weekday (5 = Friday). */
export function lastWeekday(day: number) {
  let k = nightKey(1);
  while (weekdayOf(k) !== day) k = addDays(k, -1);
  return k;
}

export function nightLabel(key: string) {
  if (key === nightKey(0)) return "Tonight";
  if (key === nightKey(1)) return "Last night";
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
