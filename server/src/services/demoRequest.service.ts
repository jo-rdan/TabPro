import { db } from '../lib/db';
import { demoRequests } from '../models/schema';
import { notifyAdmin } from './push.service';
import { sendEmail, isEmailConfigured } from '../lib/email';

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function createDemoRequest(input: { name: string; venueName: string; phone: string; area?: string; bestTime?: string }) {
  const [request] = await db
    .insert(demoRequests)
    .values({
      name: input.name.trim(),
      venueName: input.venueName.trim(),
      phone: input.phone.trim(),
      area: input.area?.trim() || null,
      bestTime: input.bestTime?.trim() || null,
    })
    .returning();

  const extra = [request.area, request.bestTime && `best: ${request.bestTime}`].filter(Boolean).join(' · ');
  const title = `📅 Demo request: ${request.venueName}`;
  const line = `${request.name} · ${request.phone}${extra ? ` · ${extra}` : ''}`;

  // Email the founder; fall back to a phone alert if email isn't set up yet.
  const rows: [string, string | null][] = [
    ['Name', request.name],
    ['Venue', request.venueName],
    ['Phone', request.phone],
    ['Area', request.area],
    ['Best time to call', request.bestTime],
  ];
  const emailed = isEmailConfigured()
    ? await sendEmail({
        subject: title,
        text: `New demo request from the Skuzi website\n\n${rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')}`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#11201a">
  <p style="margin:0 0 12px"><b>New demo request</b> from the Skuzi website</p>
  <table style="border-collapse:collapse">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5b6b64">${k}</td><td style="padding:4px 0"><b>${esc(v!)}</b></td></tr>`)
    .join('')}</table>
  <p style="margin:16px 0 0"><a href="tel:${esc(request.phone.replace(/\s/g, ''))}" style="color:#1D9E75">Call ${esc(request.name)}</a></p>
</div>`,
      }).catch((err) => { console.error('[demo] email', err); return false; })
    : false;
  if (!emailed) await notifyAdmin(title, line).catch((err) => console.error('[demo] notify', err));

  return request;
}
