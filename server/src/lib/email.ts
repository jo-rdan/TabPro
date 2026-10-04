// Email from the founder's own Gmail, through a small Google Apps Script web
// app in his Google account (free, ~100 emails/day, no extra service).
// Render's free plan blocks the SMTP ports, so this goes over HTTPS instead.
// The script only sends when it receives the shared secret.
export function isEmailConfigured() {
  return !!(process.env.EMAIL_SCRIPT_URL && process.env.EMAIL_SCRIPT_SECRET);
}

export async function sendEmail({ subject, text, html }: { subject: string; text: string; html?: string }) {
  if (!isEmailConfigured()) return false;
  const res = await fetch(process.env.EMAIL_SCRIPT_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.EMAIL_SCRIPT_SECRET, subject, text, html }),
  });
  const reply = (await res.text()).trim();
  if (!res.ok || reply !== 'ok') {
    console.error('[email] send failed', res.status, reply.slice(0, 200));
    return false;
  }
  return true;
}
