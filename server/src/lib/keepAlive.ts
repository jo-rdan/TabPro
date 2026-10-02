// Render's free instances sleep after 15 minutes without incoming traffic,
// which makes the next visitor wait ~1 minute (and pauses the payment
// reconciler). Calling our own public URL counts as traffic, so ping it
// every 10 minutes.
//
// Runs only when a public URL is known: RENDER_EXTERNAL_URL is set by Render
// automatically; PUBLIC_API_URL works elsewhere. Nothing happens locally.

const INTERVAL_MS = 10 * 60_000;

export function startKeepAlive() {
  const base = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!base.startsWith('https://')) return;

  setInterval(() => {
    fetch(`${base}/health`, { signal: AbortSignal.timeout(30_000) })
      .catch((err) => console.warn('[keep-alive] ping failed:', err.message));
  }, INTERVAL_MS);
  console.log(`✅ Keep-alive: pinging ${base}/health every 10 minutes`);
}
