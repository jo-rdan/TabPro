/**
 * Messaging service — Africa's Talking (SMS) + WhatsApp deep links
 *
 * Required env vars for SMS (optional — invite still works without them):
 *   AT_USERNAME   your Africa's Talking username
 *   AT_API_KEY    your Africa's Talking API key
 *   AT_SENDER_ID  (optional) shortcode or alphanumeric sender e.g. Skuzi
 */

const AT_SMS_URL = 'https://api.africastalking.com/version1/messaging';

function formatRwandaPhone(raw: string): string {
  // Normalise to international format: +2507XXXXXXXX
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('250')) return `+${digits}`;
  if (digits.startsWith('0')) return `+250${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 9) return `+250${digits}`;
  return `+${digits}`;
}

export async function sendInviteSms(
  phone: string,
  staffName: string,
  inviteUrl: string
): Promise<{ sent: boolean; error?: string }> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;

  if (!username || !apiKey) {
    // Credentials not configured — skip silently
    return { sent: false, error: 'AT credentials not configured' };
  }

  const to = formatRwandaPhone(phone);
  const message =
    `Hi ${staffName}! You've been invited to Skuzi. ` +
    `Tap this link to set up your waiter account: ${inviteUrl}`;

  const params = new URLSearchParams({
    username,
    to,
    message,
    ...(process.env.AT_SENDER_ID ? { from: process.env.AT_SENDER_ID } : {}),
  });

  try {
    const res = await fetch(AT_SMS_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json() as any;
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    const status = recipient?.status ?? '';

    if (status === 'Success') return { sent: true };
    return { sent: false, error: status || 'Unknown AT error' };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

/**
 * Returns a wa.me deep-link the owner can tap to open WhatsApp
 * pre-filled with the invite message for the staff member.
 */
export function buildWhatsAppLink(phone: string, staffName: string, inviteUrl: string): string {
  const to = formatRwandaPhone(phone).replace('+', '');
  const text = encodeURIComponent(
    `Hi ${staffName}! You've been invited to Skuzi. ` +
    `Tap this link to set up your waiter account: ${inviteUrl}`
  );
  return `https://wa.me/${to}?text=${text}`;
}
