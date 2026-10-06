# Ops log

Newest first. Every routine run and interactive session adds an entry.

## 2026-10-06 UTC · daily
- Checked: no open watchdog issues; /health and tabpro.lol both 200; last nightly Tests on main green; only open PR is draft #34 (Skuzi rebrand, not touched).
- Did: nothing to do. No `bot-ok` items in "Up next"; design polish skipped because of the rebrand freeze.
- Left off: still waiting on Jordan (Skuzi domain, pawaPay, outreach). Check whether the prod deploy applied migration 0021.

## 2026-10-05 UTC · weekly
- Checked: no open watchdog issues; /health and tabpro.lol both 200; last nightly Tests green (the failed run on PR #32 was the PR-triggered one; main is green); no open PRs, no `idea` PRs.
- Did: opened the weekly issue #33 (what happened, Jordan's plan, 2 strategic ideas, 3 posts). No code changed.
- Left off: next daily picks up the bill/payment screen design polish; check prod applied migration 0021.

## 2026-10-05 12:20 UTC · daily
- Checked: no open watchdog issues; /health and tabpro.lol both 200; last nightly Tests green; no open PRs (PR #19 is gone).
- Did: error log in the database (PR #32): unexpected server errors and background crashes are saved to
  new `error_logs` table (migration 0021). My own `tests/e2e/ci.sh` run: 126/126 pass; merged.
- Left off: next is the bill/payment screen design polish. Check that the prod deploy applied migration 0021.

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
