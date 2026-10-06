// CLIENT_URL is the site's main address (used in links we generate).
// EXTRA_CLIENT_ORIGINS lists other addresses serving the same site, comma
// separated — e.g. the onrender.com address and www. while moving domains.
// A function, so it reads the settings after dotenv has loaded them.
export function allowedOrigins(): string[] {
  return [process.env.CLIENT_URL || 'http://localhost:5173',
    ...(process.env.EXTRA_CLIENT_ORIGINS || '').split(',')]
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

// The site to send someone back to: the address they came from if it's one of
// ours (so signing in on the Skuzi preview site returns there), else the main one.
export function siteFor(origin?: string | null): string {
  const clean = (origin || '').trim().replace(/\/$/, '');
  const ours = allowedOrigins();
  return ours.includes(clean) ? clean : ours[0];
}

export function originOf(url?: string | null): string | null {
  try { return url ? new URL(url).origin : null; } catch { return null; }
}
