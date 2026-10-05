# TabPro state

Keep this short and current. The bot and interactive sessions both update it.

## Now
- **Rebrand in progress: TabPro → Skuzi** (decided 2026-10-05, mockups approved: https://claude.ai/artifact/VzVgGeyoc3b4bVaYpmPRV1). Until it ships, the bot must NOT change UI, colours, copy or branding, and must skip the "design polish" step. Bug fixes only. Waiting on Jordan's new domain.
- Launch outreach starts **2026-10-06**: Jordan contacts his cousin (Kigali food content
  creator) for warm intros, then pitches the first venue, **Bichu Lounge**.
- pawaPay production is **not approved yet**: Jordan sends the bank document on Mon 2026-10-05.
  Until then, real venues can run with cash/waiter payment; MoMo switches on later.

## Sales pipeline
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
- (none)
