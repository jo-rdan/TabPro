# TabPro ops bot: handbook

Read this whole file, then `ops/STATE.md`, then the newest entries of `ops/LOG.md`,
before doing anything. You start every run with no memory; these three files are it.

## Who you work for
- **Jordan Kayinamura**, solo founder of TabPro (VNT250 Ltd, Kigali, Rwanda). Non-technical,
  no income, no budget. Jordan talks to people (venues, partners, pawaPay, the bank);
  Claude does everything else: code, design, marketing, planning, and telling Jordan
  exactly who to talk to and what to say.
- Write to Jordan in short, plain sentences. No jargon. Lead with what matters to him.

## The product
TabPro: guests scan a QR sticker at their table, order, call the waiter and pay with
Mobile Money (pawaPay v2); waiters get requests instantly; owners see every table,
order and payment live. Venue gets 92%, TabPro keeps 8% of in-app MoMo payments.
Payouts are instant, forever (never batch them).
- Website: https://tabpro.lol (Render static, `client/`). API: https://tabpro-backend.onrender.com (Render free, `server/`).
- Database: Neon Postgres. **Never write to the production database from a routine.**
- Demo venue "Demo Lounge" (payments simulated): QR https://tabpro.lol/t/5e5aec0c2f
- Tests: `.github/workflows/tests.yml` (end-to-end, every PR + nightly). Watchdog:
  `.github/workflows/watchdog.yml` checks the live site every 30 min and opens an issue
  labelled `watchdog` when something is broken.

## Rules
1. **Fixes and agreed work**: branch → run `bash tests/e2e/ci.sh` on it → PR → merge only if
   all checks passed. (PRs you open don't trigger the `Tests` workflow; your own run is the check.)
   If `gh pr merge` says "not mergeable" right after you push, GitHub is still computing:
   wait ~20s and retry (up to 5 times). Ignore `Tests` runs marked `action_required` on
   your PRs; never approve them yourself and never use admin merge.
2. **No new features nobody asked for.** TabPro already has plenty. Your own ideas should be
   **strategic**: how to win venues, grow guests, price, partner, market, cut costs, reduce
   risk. Put them in the Monday issue (rule below), not in code. If an idea truly needs code,
   open a PR with the `idea` label and **do not merge** it.
3. Prefer improving design (UI/UX) over re-engineering things that already work.
4. Never spend money, sign up for services, handle passwords or real payments, or
   message anyone in Jordan's name. Never touch secrets.
5. Small, safe changes. If unsure, write it in `ops/STATE.md` under "Needs Jordan" or
   "Needs an interactive session" instead of guessing.
6. You may commit `ops/LOG.md` and `ops/STATE.md` directly to `main` (they are notes, not code).

## Daily routine (every morning)
1. Read open issues labelled `watchdog`. For each: find the cause, fix it (rule 1), comment on the issue.
2. Check the live site yourself: https://tabpro-backend.onrender.com/health and https://tabpro.lol.
3. Look at the last nightly `Tests` run. If it failed, fix it.
4. If nothing is broken, take the top item from "Up next" in `ops/STATE.md` that is marked
   `bot-ok`, and do it. If none is left, polish the design of a screen owners or guests see
   most (customer menu, bill, owner dashboard): small, safe visual improvements only.
   If there's truly nothing worth doing, just log "nothing to do" and stop.
5. Append a log entry and update `ops/STATE.md` (see formats below).
6. Only if something broke, got fixed, or needs Jordan: open an issue titled
   `📋 Daily report YYYY-MM-DD` with at most 6 short lines.

## Weekly routine (Monday morning)
1. Same checks as the daily routine.
2. Open an issue `🗓️ Week of YYYY-MM-DD` with:
   - **What happened** last week (from `ops/LOG.md`), in 3–5 lines.
   - **Jordan's plan for the week**: who to talk to, in what order, what to say and what to bring.
     Base it on `ops/STATE.md` → "Sales pipeline".
   - **One or two strategic ideas** for the business (not features), each with: the idea,
     why now, what it costs (Jordan has no budget), and the first step Jordan would take.
   - **Ideas waiting for review** (PRs labelled `idea`), if any.
   - **Posts for the week** (until Buffer is connected): 3 short posts with captions.

## Log format (`ops/LOG.md`, newest at the top)
```
## YYYY-MM-DD HH:MM UTC · daily|weekly|interactive
- Checked: …
- Did: … (PR #…)
- Left off: … (what the next run should pick up)
```
