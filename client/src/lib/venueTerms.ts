// The Skuzi venue terms that owners agree to in the app ("I agree" replaces
// signing paper). Keep in step with the server's VENUE_TERMS_VERSION and the
// printable PDF; when the terms change, bump the version on the server and
// owners are asked to agree again.

export const TERMS_DATE = "October 2026";

export const TERMS_SUMMARY: { icon: string; tint: string; title: string; text: string }[] = [
  { icon: "💯", tint: "#E4EADF", title: "100% of your sales are yours.", text: "Guests pay your own MoMo Pay code or cash. Skuzi takes nothing from your bills." },
  { icon: "📦", tint: "#FFEDB8", title: "One monthly package.", text: "Starter 25,000 · Pro 45,000 · Bar+ 70,000 RWF. No setup fee, no machine." },
  { icon: "🎁", tint: "#FCE3D3", title: "Free to start.", text: "2 weeks on Starter, 1 month on Pro and Bar+." },
  { icon: "🧾", tint: "#EFEBF2", title: "Your sales, your receipts.", text: "You issue your own EBM receipts and handle your taxes." },
  { icon: "👋", tint: "#FEF3EC", title: "Stop anytime,", text: "with nothing to return." },
];

// Shown to owners who agreed to an earlier version: what changed in this one.
export const TERMS_WHATS_NEW: string[] = [
  "No more 8% or 15%: Skuzi takes nothing from your sales. Guests pay your own MoMo Pay code (or cash), and your waiter taps Paid.",
  "Skuzi is now a monthly package: Starter 25,000, Pro 45,000 or Bar+ 70,000 RWF, after a free trial (2 weeks on Starter, 1 month on Pro and Bar+).",
];

export const TERMS_CLAUSES: { title: string; text: string }[] = [
  {
    title: "What Skuzi provides",
    text: "Ordering from the table, \"Skuzi!\" calls and alerts for waiters, the owner dashboard, the table stickers, and, depending on the package, payment of bills to the venue's own MoMo Pay code, history, the venue's Skuzi page and bookings, campaigns, and bar stock and kitchen spending. Setup and staff training are free.",
  },
  {
    title: "Packages and payment",
    text: "The venue chooses a monthly package: Starter (25,000 RWF), Pro (45,000 RWF) or Bar+ (70,000 RWF). The first 2 weeks (Starter) or month (Pro, Bar+) are free. The free trial includes every Bar+ feature. After that the package is paid monthly in advance to VNT250 Ltd by Mobile Money, from the Plan page; the app reminds the venue before it is due. If a payment is 3 days late, the owner's dashboard locks until it is paid; if it is 10 days late, guests can no longer order from their phones (the menu stays visible and staff keep working). Everything comes back as soon as the payment goes through. Prices include no setup fee and no equipment.",
  },
  {
    title: "Guests' payments",
    text: "Guests pay the venue directly: to the venue's own MoMo Pay code shown on their bill, or in cash. Skuzi never holds the venue's money and takes nothing from its sales. The venue's staff confirm each payment in the app once they see it.",
  },
  {
    title: "What the venue does",
    text: "Keeps its menu, prices and MoMo Pay code correct in Skuzi, serves the orders guests place, keeps the stickers on its tables, and makes sure its staff use Skuzi during opening hours.",
  },
  {
    title: "Campaigns and bookings",
    text: "Campaigns reach only guests who said yes to Skuzi invites, at most 2 campaigns a week per venue. Any offer the venue chooses is its own promotion. Guests can ask to book a table on the venue's Skuzi page; the venue accepts or declines each request in the app.",
  },
  {
    title: "Your sales, your receipts",
    text: "The venue is responsible for its food, drinks and service, for its own taxes, and for issuing official receipts (EBM) for its sales.",
  },
  {
    title: "Refunds",
    text: "Questions about an order are handled by the venue with its guest. Because guests pay the venue directly, any refund is paid by the venue.",
  },
  {
    title: "Guests' data",
    text: "Guest data is handled as described in Skuzi's Privacy Policy. The venue uses guests' phone numbers only to run its service, to follow up on bills left unpaid and to answer bookings, never for anything else. Guests who say yes to Skuzi invites are reached only through Skuzi campaigns; their numbers are never shared with venues.",
  },
  {
    title: "If Skuzi is unavailable",
    text: "The venue keeps serving as usual and takes payment directly. Skuzi is not responsible for indirect losses, and its total responsibility is limited to the package fees the venue paid in the last three months.",
  },
  {
    title: "Changes and ending",
    text: "Either side can end this agreement at any time; a month already paid is not refunded. Skuzi gives 30 days' notice before changing package prices, and asks the venue to agree again in the app.",
  },
  {
    title: "Law",
    text: "This agreement is governed by the laws of Rwanda.",
  },
];
