// The Skuzi venue terms that owners agree to in the app ("I agree" replaces
// signing paper). Keep in step with the server's VENUE_TERMS_VERSION and the
// printable PDF; when the terms change, bump the version on the server and
// owners are asked to agree again.

export const TERMS_DATE = "October 2026";

export const TERMS_SUMMARY: { icon: string; tint: string; title: string; text: string }[] = [
  { icon: "💰", tint: "#E4EADF", title: "You keep 92%", text: "of bills paid by MoMo through Skuzi, sent to your MoMo in seconds. Skuzi keeps 8%." },
  { icon: "💵", tint: "#F5E6C4", title: "Cash is free.", text: "No setup fee, no monthly fee, no machine." },
  { icon: "🧾", tint: "#F0E8DD", title: "Your sales, your receipts.", text: "You issue your own EBM receipts and handle your taxes." },
  { icon: "👋", tint: "#FBF1EC", title: "Stop anytime,", text: "with nothing to pay or return." },
];

export const TERMS_CLAUSES: { title: string; text: string }[] = [
  {
    title: "What Skuzi provides",
    text: "Ordering from the table, \"Skuzi!\" waiter calls and alerts for waiters, the owner dashboard, Mobile Money payment of bills, and the table stickers. Setup and staff training are free.",
  },
  {
    title: "How payouts work",
    text: "Payments are processed by Skuzi's licensed payment partner. The venue's share is sent automatically to its payout number as soon as each payment is confirmed. If a payout is delayed, Skuzi retries automatically and tells the owner. The venue keeps its payout number up to date in the app.",
  },
  {
    title: "What the venue does",
    text: "Keeps its menu and prices correct in Skuzi, serves the orders guests place, keeps the stickers on its tables, and makes sure its staff use Skuzi during opening hours.",
  },
  {
    title: "Your sales, your receipts",
    text: "The venue is responsible for its food, drinks and service, for its own taxes, and for issuing official receipts (EBM) for its sales. Skuzi's fee is for its service only.",
  },
  {
    title: "Refunds",
    text: "Questions about an order are handled by the venue with its guest. If the venue agrees to refund a guest, the venue pays them back directly (cash or MoMo). Skuzi provides the payment record.",
  },
  {
    title: "Guests' data",
    text: "Guest data is handled as described in Skuzi's Privacy Policy. The venue uses guests' phone numbers only to run its service and to follow up on bills left unpaid, never for anything else.",
  },
  {
    title: "If Skuzi is unavailable",
    text: "The venue keeps serving as usual and takes cash. Skuzi is not responsible for indirect losses, and its total responsibility is limited to the fees it received from the venue in the last three months.",
  },
  {
    title: "Changes and ending",
    text: "Either side can end this agreement at any time, with nothing to pay or return. Payments already made are settled as usual. Skuzi gives 30 days' notice before changing its fee, and asks the venue to agree again in the app.",
  },
  {
    title: "Law",
    text: "This agreement is governed by the laws of Rwanda.",
  },
];
