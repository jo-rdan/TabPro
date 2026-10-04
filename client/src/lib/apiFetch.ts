const API_BASE = import.meta.env.VITE_API_URL || '/api';

// fetch() against the API. In production the API can live on a different
// domain than the app, so never hard-code "/api" in a fetch call — use this.
export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, init);
}

// Fire-and-forget request that still goes out while the page is closing.
export function apiBeacon(path: string) {
  const url = `${API_BASE}${path}`;
  if (typeof navigator !== 'undefined' && navigator.sendBeacon?.(url)) return;
  fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
}
