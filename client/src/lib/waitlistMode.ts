// Waitlist mode (VITE_WAITLIST_MODE=true): the site shows only the homepage, the
// waitlist and the legal pages. Every "Book a demo" button leads to the waitlist
// and the app (sign-in, dashboard, waiter, table menus) isn't reachable. Used for
// the Skuzi preview site before launch; tabpro.lol leaves it off.
export const WAITLIST_MODE = import.meta.env.VITE_WAITLIST_MODE === "true";

// Button wording that changes in waitlist mode.
export const cta = (demo: string) => (WAITLIST_MODE ? "Join the waitlist" : demo);
