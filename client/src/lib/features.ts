// Features that are built but switched off until a restaurant needs them.
// Switching one back on is a one-line change here.

/**
 * Staff clock-in by sticker + venue PIN, and shifts. Off since 2026-10-20 to keep
 * the product simple while signing the first restaurants. The server side stays
 * live. Before turning it back on: new venues have no shifts, so give every
 * venue a default "All day" shift or waiters see "You have no shifts assigned".
 */
export const CLOCK_IN_ENABLED = false;
