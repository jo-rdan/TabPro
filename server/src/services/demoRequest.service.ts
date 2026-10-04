import { db } from '../lib/db';
import { demoRequests } from '../models/schema';
import { notifyAdmin } from './push.service';

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
  await notifyAdmin(
    `📅 Demo request: ${request.venueName}`,
    `${request.name} · ${request.phone}${extra ? ` · ${extra}` : ''}`,
  ).catch((err) => console.error('[demo] notify', err));

  return request;
}
