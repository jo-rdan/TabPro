import axios from "axios";

// Guests' own Skuzi (Explore, venue pages, bookings, invites). Its own API
// client: an owner signed in on the same phone must never be logged out by a
// guest request, and guest requests never carry the owner's token.
export const guestApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "skuzi_guest_token";
const NAME_KEY = "skuzi_guest_name";
const BOOKINGS_KEY = "skuzi_bookings";

// Storage can be missing (private mode) or full: never let that break a page.
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => {
  try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ }
};

export const guestToken = () => read(TOKEN_KEY);
export const setGuestToken = (t: string | null) => write(TOKEN_KEY, t);
export const guestName = () => read(NAME_KEY);
export const setGuestName = (n: string | null) => n && write(NAME_KEY, n);

guestApi.interceptors.request.use((config) => {
  const t = guestToken();
  if (t && !config.headers.Authorization) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const apiError = (err: any, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.error || (err?.response ? fallback : "No connection. Check your internet and try again.");

// ─── Bookings saved on this phone (id + private token) ───────────────────────
export type SavedBooking = { id: string; token: string };
export function savedBookings(): SavedBooking[] {
  try { return JSON.parse(read(BOOKINGS_KEY) || "[]").filter((b: any) => b?.id && b?.token); } catch { return []; }
}
export function saveBooking(b: SavedBooking) {
  write(BOOKINGS_KEY, JSON.stringify([b, ...savedBookings().filter((x) => x.id !== b.id)].slice(0, 30)));
}

// ─── Device: iPhone, Home Screen, notifications ──────────────────────────────
export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
/** iPhone in Safari: notifications only work once Skuzi is on the Home Screen. */
export const needsHomeScreen = () => isIOS() && !isStandalone();

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Asks for notification permission (must run from a tap) and returns this
 * device's push subscription, or null if it isn't possible or was refused.
 */
export async function getDeviceSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported()) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const keyRes = await guestApi.get("/push/vapid-key");
    const publicKey = keyRes.data?.data?.publicKey ?? keyRes.data?.data;
    if (!publicKey) return null;
    const existing = await registration.pushManager.getSubscription();
    const sub = existing ?? (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
    }));
    return sub.toJSON();
  } catch {
    return null;
  }
}

/** Kigali "YYYY-MM-DD" for a day offset from today. */
export function kigaliDay(offset = 0) {
  const d = new Date(Date.now() + 2 * 3600e3 + offset * 86400e3);
  return d.toISOString().slice(0, 10);
}
export function dayLabel(key: string, short = false) {
  const today = kigaliDay(0);
  if (key === today) return "Today";
  if (key === kigaliDay(1)) return "Tomorrow";
  const d = new Date(key + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", short ? { weekday: "short", day: "numeric", timeZone: "UTC" } : { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
}
export const rwf = (n: number) => `${n.toLocaleString("en-US")} RWF`;
export const kigaliTime = (iso: string) =>
  new Date(new Date(iso).getTime() + 2 * 3600e3).toISOString().slice(11, 16);
