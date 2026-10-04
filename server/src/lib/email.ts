// Email through Resend's HTTP API (free tier). Render's free plan blocks the
// SMTP ports, so plain Gmail sending wouldn't work from the server.
// Until a domain is verified in Resend, it can only send to the address the
// Resend account was created with, from onboarding@resend.dev.
export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }) {
  if (!isEmailConfigured()) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'TabPro <onboarding@resend.dev>', to, subject, text, html }),
  });
  if (!res.ok) {
    console.error('[email] send failed', res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return true;
}
