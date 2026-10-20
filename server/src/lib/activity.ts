// Neon's free plan bills compute by the hour the database is AWAKE, not by the
// number of queries. Our background timers polled every 30 seconds forever, so
// the database never got to suspend: that burned the whole 100 CU-hour monthly
// allowance in 17 days and took Skuzi down on 2026-10-19, in front of a
// restaurant manager scanning a table sticker.
//
// So the periodic jobs only run while someone is actually using Skuzi. Every
// real API request marks the app awake; after IDLE_AFTER_MS of silence the
// jobs stop querying and the database is free to suspend until the next guest,
// waiter or owner shows up.
//
// What does NOT count as use: /health (Render's own check and our keep-alive
// ping hit it every few minutes and must never wake the database).

const IDLE_AFTER_MS = 10 * 60_000;

let lastRequestAt = Date.now();

/** A real request came in: Skuzi is in use. */
export function markActive() {
  lastRequestAt = Date.now();
}

/** Nobody has used Skuzi for a while, so let the database sleep. */
export function isIdle() {
  return Date.now() - lastRequestAt > IDLE_AFTER_MS;
}

type PollOptions = {
  /**
   * How often to still run the job while the app is idle. Leave unset for jobs
   * that only matter when there are live tabs (they have nothing to do when
   * nobody is using Skuzi). Set it for work that is due at a wall-clock time
   * regardless of traffic, e.g. sending a scheduled campaign.
   */
  whenIdleEveryMs?: number;
};

/**
 * Runs `job` every `everyMs` while Skuzi is in use, and either not at all or
 * far less often while it is idle. Errors are logged, never thrown: one bad
 * tick must not stop the timer.
 */
export function startPolling(
  name: string,
  everyMs: number,
  job: () => Promise<unknown>,
  { whenIdleEveryMs }: PollOptions = {},
) {
  let lastRun = 0;
  const run = () => {
    const due = isIdle() ? whenIdleEveryMs : everyMs;
    if (due === undefined) return; // idle, and this job has nothing to do
    if (Date.now() - lastRun < due) return;
    lastRun = Date.now();
    job().catch((err) => console.error(`[${name}]`, err?.message ?? err));
  };
  setInterval(run, everyMs);
  return run;
}
