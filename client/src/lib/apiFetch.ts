import { ownTextFrom } from './i18n';
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// fetch() against the API. In production the API can live on a different
// domain than the app, so never hard-code "/api" in a fetch call — use this.
export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, init);
  // The venue's own names are never translated (see ownTextFrom).
  if (res.headers.get('content-type')?.includes('json')) {
    try { ownTextFrom(await res.clone().json()); } catch { /* not JSON after all */ }
  }
  return res;
}

// Fire-and-forget request that still goes out while the page is closing.
export function apiBeacon(path: string) {
  const url = `${API_BASE}${path}`;
  if (typeof navigator !== 'undefined' && navigator.sendBeacon?.(url)) return;
  fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
}
