const API_BASE = import.meta.env.VITE_API_URL || '/api';

// fetch() against the API. In production the API can live on a different
// domain than the app, so never hard-code "/api" in a fetch call — use this.
export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, init);
}
