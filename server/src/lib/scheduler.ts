import { sendDueCampaigns } from '../services/campaign.service';
import { runBookingJobs } from '../services/booking.service';
import { ensureVenueSlugs } from '../services/venue.service';

// Every minute: send scheduled campaigns, expire unanswered booking requests,
// remind guests 2 hours before. A failure is logged and retried next minute.
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await sendDueCampaigns();
    await runBookingJobs();
  } catch (err: any) {
    console.error('[scheduler]', err?.message);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  ensureVenueSlugs().catch((err) => console.error('[slugs]', err.message));
  setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}
