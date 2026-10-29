import { sendDueCampaigns } from '../services/campaign.service';
import { runBookingJobs } from '../services/booking.service';
import { sendPlanReminders, reconcilePlanPayments } from '../services/plan.service';
import { sendNightReports } from '../services/nightReport.service';
import { ensureVenueSlugs } from '../services/venue.service';
import { startPolling } from './activity';

// Every minute: send scheduled campaigns, expire unanswered booking requests,
// remind guests 2 hours before, and run package payments and reminders. A failure is logged and retried next minute.
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await sendDueCampaigns();
    await runBookingJobs();
    // Packages: settle MoMo payments whose owner closed the page, and remind
    // owners before and after their trial or month runs out.
    await reconcilePlanPayments();
    await sendPlanReminders();
    // 2am, closing time: each owner's "your night's report is ready".
    await sendNightReports();
  } catch (err: any) {
    console.error('[scheduler]', err?.message);
  } finally {
    running = false;
  }
}

// Unlike the other timers this one is due at a wall-clock time whether or not
// anyone is using Skuzi (a campaign scheduled for 20:00 must go out at 20:00),
// so it keeps running when idle — just every half hour instead of every
// minute, which lets the database sleep most of a quiet night. A scheduled
// campaign can therefore go out up to 30 minutes late on a dead-quiet day.
export function startScheduler() {
  ensureVenueSlugs().catch((err) => console.error('[slugs]', err.message));
  startPolling('scheduler', 60_000, tick, { whenIdleEveryMs: 30 * 60_000 });
  setTimeout(tick, 5_000);
}
