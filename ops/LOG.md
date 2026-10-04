# Ops log

Newest first. Every routine run and interactive session adds an entry.

## 2026-10-05 night · interactive
- Did: manager accounts + no-smartphone waiters (PR #30); stickers ready for setup day (PR #31):
  attendance unlocked (stale 'elite' gate), new clock-in stickers set up by scanning, friendly
  message for unset-up table stickers, `stickers:create`. 16 blank table codes created in prod.
- Left off: tips wait for pawaPay. Jordan: bank visit Mon, pawaPay email, print materials, Oct 6 outreach.

## 2026-10-04 evening · interactive
- Did: notifications overhaul (PRs #21, #22): devices re-register on every visit; alerts go to the
  table's waiter + owner; guests can opt in ("Notify me"); new alerts for seated, paid, cash close,
  payout delayed, order waiting 10 min, bad rating, join request. Defined missing brand shades
  (light borders in dark mode). 105 E2E checks.
- Left off: Jordan's real-device test on his Mac (Chrome/Arc). Venue agreement still to write.

## 2026-10-04 14:15 UTC · daily
- Checked: no open watchdog issues; /health and tabpro.lol both 200; last Tests runs green.
- Did: opened PR #19 "Tonight's summary" (PR creation works now). Merged main into the branch;
  my own `tests/e2e/ci.sh` run: 93/93 pass. Merge was REFUSED by GitHub ("not mergeable", state
  UNSTABLE): the `Tests` workflow runs on the PR are stuck at `action_required` (waiting for approval).
  I did not work around it (no admin merge, no approving runs).
- Left off: PR #19 is open and tested. Once Jordan approves the workflow run (or changes the setting),
  merge it. Photos item skipped (needs real photos).

## 2026-10-04 13:55 UTC · daily
- Checked: no open watchdog issues; /health and tabpro.lol both 200; last Tests runs green.
- Did: built "Tonight's summary" card on the owner dashboard (branch `dashboard-tonights-summary`,
  93/93 e2e pass locally). Could NOT open the PR: GitHub Actions is not allowed to create pull
  requests in this repo, so nothing was merged.
- Left off: open a PR from `dashboard-tonights-summary`, wait for Tests, merge. Photos item skipped
  (needs real photos).

## 2026-10-04 · interactive
- Did: watchdog (every 30 min) + nightly tests that open `watchdog` issues; this handbook,
  STATE and LOG; demo venue, waiter "Join the team", menu-from-photo (Gemini), pitch materials.
- Left off: daily + weekly Claude routines being created; Buffer not connected yet.
