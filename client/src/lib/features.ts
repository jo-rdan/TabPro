// Features that are built but switched off until a restaurant needs them.
// Switching one back on is a one-line change here.

/**
 * Staff clock-in by sticker + venue PIN, and shifts. Off since 2026-10-20 to keep
 * the product simple while signing the first restaurants. The server side stays
 * live. Before turning it back on: new venues have no shifts, so give every
 * venue a default "All day" shift or waiters see "You have no shifts assigned".
 */
export const CLOCK_IN_ENABLED = false;

/**
 * Hidden 2026-10-29 to keep Skuzi focused on what owners pay for. Everything
 * still exists (pages, server, data); these only take the doors away.
 *  - Bookings: Explore didn't show them (bug parked); owners' Bookings page too.
 *  - Explore: the guests' "places to go tonight" list. Back once there are many venues.
 *  - Creators: the creator programme (parked).
 *  - Skuzi money: guests' credit from creators, spent on in-app payments.
 */
export const BOOKINGS_ENABLED = false;
export const EXPLORE_ENABLED = false;
export const CREATORS_ENABLED = false;
export const SKUZI_MONEY_ENABLED = false;

/** Where a guest's own Skuzi opens: Explore, or their invites page while it's hidden. */
export const GUEST_HOME = EXPLORE_ENABLED ? "/explore" : "/me";
