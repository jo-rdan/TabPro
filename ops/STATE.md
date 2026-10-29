# TabPro state

Keep this short and current. The bot and interactive sessions both update it.

## Now
- **Rebrand in progress: TabPro → Skuzi** (decided 2026-10-05, mockups approved: https://claude.ai/artifact/VzVgGeyoc3b4bVaYpmPRV1). Until it ships, the bot must NOT change UI, colours, copy or branding, and must skip the "design polish" step. Bug fixes only. Rebrand work lives on branch `skuzi-rebrand`. **Jordan himself merged PR #34 into main on 2026-10-10.** The freeze stays until Jordan says it is over (bot has not been told); still waiting on the new domain. PR #51 (menu first; MoMo number asked at first order) merged 2026-10-12; PR #53 (menu photo reader fallback) merged 2026-10-13; PR #54 (creators net split) merged 2026-10-15; PR #55 (warmer waiter wording) merged 2026-10-15; PRs #56 (high-urgency notifications) and #57 (waiter notification opens right screen) merged 2026-10-16; PR #58 (guest tabs fixes) merged 2026-10-17; PRs #59 (pricing hidden), #60 (homepage shows less) and #61 (hero line) merged 2026-10-18; PRs #63, #65, #66 (tangerine retheme) and #67–#70 (guest menu: pills, orders notepad, floating buttons, Skuzi! before first order) merged 2026-10-19/20; PRs #72 (clock-in hidden), #73 (stock for managers) and #74 (packages Starter/Pro/Bar+, guests pay the venue's own MoMo code, no more 8%) merged 2026-10-21; PRs #75–#78 (MoMo code in setup, kitchen screen, auto-billing packages, waiter tips) merged 2026-10-21; PRs #79–#81 (new group bill fix, own bill per phone with 'Add a friend' QR, e2e wait fix) merged 2026-10-29.
- Launch outreach starts **2026-10-06**: Jordan contacts his cousin (Kigali food content
  creator) for warm intros, then pitches the first venue, **Bichu Lounge**.
- pawaPay production is **not approved yet**: Jordan sends the bank document on Mon 2026-10-05.
  Until then, real venues can run with cash/waiter payment; MoMo switches on later.

## Sales pipeline
(Weekly issue #62 opened 2026-10-19; outreach status not confirmed by Jordan yet.)
| Who | Status | Next step |
|---|---|---|
| Cousin (content creator) | Not contacted | Jordan messages her 2026-10-06: video + demo link + ask for 2–3 owner intros |
| Bichu Lounge | Not contacted | Intro via cousin, then 20-min pitch (script in Jordan's Sales folder) |

## Up next
- [ ] Tips by MoMo straight to the waiter (interactive; build once pawaPay production is approved)
- [ ] Real food photos for Demo Lounge menu (needs photos from Jordan or approved free images)
- [ ] Design polish of the customer bill and payment screens (on hold until the Skuzi rebrand ships)

## Done recently (2026-10-05)
- Error log in the database (`error_logs` table, PR #32).
- Manager accounts + waiters without a smartphone (alerts go to manager, else owner).
- "Book a demo" form + footer badge; no public contact details on the homepage.
- Notifications overhaul; calm "phone closed" sign; bills left open + 04:00 summary.
- Venue agreement, one-page pitch, pitch script, demo QR card, 16-table sticker sheet + clock-in sticker (Jordan's Sales folder).

## Needs Jordan
- **Aug 2027:** renew tabpro.lol before 2027-09-29 (auto-renew is OFF; renewal ≈ $26.26 at Porkbun).
- Email: info@tabpro.lol forwards to Gmail (done 2026-10-04). Still to do: Gmail Apps Script (EMAIL_SCRIPT_URL/SECRET on Render) for demo-request emails.
- Bank document → pawaPay email (Mon 2026-10-05).
- Buffer: an access token so posts can be scheduled automatically.

## Needs an interactive session
- Confirm the Skuzi rebrand freeze is over (PR #34 is merged), so the bot may resume design polish and the bill/payment screens item.
- ops/README.md still describes the old 8% model; update it to the packages model (Jordan to confirm the wording).
