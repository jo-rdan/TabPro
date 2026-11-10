import type { PlanId } from "@tabpro/shared";
import { BOOKINGS_ENABLED } from "./features";

// What each package gives, in owners' words: shown on the Plan page and on the
// website's prices. Setup and WhatsApp help are for everyone, so not listed.
export const INCLUDED: Record<PlanId, string[]> = {
  basic: [
    "Your menu on every table: guests scan and order right away",
    "Orders go straight to your waiters' own phones",
    "Kitchen & bar screen: every order clear, no lost tickets",
    "Cashier screen: every bill closed right",
    "Tonight, live: tables, orders and sales from anywhere",
  ],
  pro: [
    "Everything in Go",
    "Every night saved: look back at any day, week or month",
    "Stock that counts itself: snap a crate, Skuzi adds it",
    "Bring guests back: send an offer to past guests in one tap",
    ...(BOOKINGS_ENABLED ? ["Bookings and your page on Explore"] : []),
    "Free replacement table stickers",
  ],
  elite: [
    "Everything in Pro",
    "Skuzi AI: plans your next big night, makes the poster and invites your guests",
    "See how many guests each night brought",
  ],
};
