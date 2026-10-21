// ─── Enums ────────────────────────────────────────────────────────────────────

export type Plan = "basic" | "pro" | "elite";
export type VenueStatus = "trial" | "active" | "grace" | "suspended";
export type TabStatus = "open" | "bill_requested" | "closed";
export type OrderStatus = "pending" | "preparing" | "delivered";
export type OrderSource = "customer" | "staff";
export type StaffRole = "waiter" | "manager";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled";
export type QrStickerStatus = "unclaimed" | "claimed";
export type InviteChannel = "sms" | "whatsapp";

// ─── Owner ────────────────────────────────────────────────────────────────────

export interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  googleId: string;
  createdAt: string;
  /** The Skuzi founder: sees Skuzi-wide tools (creators). */
  isAdmin?: boolean;
}

// ─── Venue ────────────────────────────────────────────────────────────────────

export interface Venue {
  id: string;
  ownerId: string;
  name: string;
  location: string | null;
  plan: Plan;
  isActive: boolean;
  trialEndsAt: string;
  createdAt: string;
  logoUrl?: string | null;
  momoPhone?: string | null;
  isDemo?: boolean;
  /** Venue terms the owner agreed to in the app, and when/by whom. */
  termsVersion?: number | null;
  termsAcceptedAt?: string | null;
  termsAcceptedBy?: string | null;
  /** The venue's own page on Skuzi: /v/<slug>. */
  slug?: string | null;
  /** { mon: { open: "11:00", close: "01:00" } | null, … }; null = not set yet. */
  openingHours?: Record<string, { open: string; close: string } | null> | null;
  bookingsEnabled?: boolean;
  /** The package right now (from /auth/me). */
  planStatus?: PlanStatus;
}

/**
 * A venue's package right now. trial = free with everything (Bar+); grace =
 * unpaid up to 3 days; locked = the owner's dashboard is behind a wall
 * (after 10 days, orderingPaused: guests can't order from their phones).
 */
export interface PlanStatus {
  plan: PlanId;
  planName: string;
  priceRwf: number;
  effectivePlan: PlanId;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  paidUntil: string | null;
  runsOutAt: string;
  daysLeft: number;
  state: "trial" | "paid" | "grace" | "locked";
  locksAt: string;
  pausesAt: string;
  orderingPaused: boolean;
  momoPayCode: string | null;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface Staff {
  id: string;
  venueId: string;
  name: string;
  phone: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export interface StaffInvite {
  id: string;
  staffId: string;
  channel: InviteChannel;
  token: string;
  sentAt: string;
  acceptedAt: string | null;
}

// ─── Tables & QR ─────────────────────────────────────────────────────────────

export interface Table {
  id: string;
  venueId: string;
  label: string;
  isActive: boolean;
}

export interface QrSticker {
  id: string;
  code: string;
  tableId: string | null;
  status: QrStickerStatus;
  claimedAt: string | null;
}

export interface TableAssignment {
  id: string;
  staffId: string;
  tableId: string;
  shiftDate: string;
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  firstSeen: string;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export interface Tab {
  id: string;
  tableId: string;
  customerId: string;
  staffId: string | null;
  status: TabStatus;
  openedAt: string;
  closedAt: string | null;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  tabId: string;
  status: OrderStatus;
  source: OrderSource;
  isNudge: boolean;
  placedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPriceRwf: number;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuItem {
  id: string;
  venueId: string;
  name: string;
  category: string;
  priceRwf: number;
  isAvailable: boolean;
}

// ─── Ratings ──────────────────────────────────────────────────────────────────

export interface Rating {
  id: string;
  tabId: string;
  venueId: string;
  staffId: string | null;
  foodScore: number;
  waiterScore: number;
  overallScore: number;
  comment: string | null;
  createdAt: string;
}

// ─── Staff Points ─────────────────────────────────────────────────────────────

export interface StaffPoint {
  id: string;
  staffId: string;
  points: number;
  reason: string;
  createdAt: string;
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  venueId: string;
  message: string;
  status: string;
  sentAt: string | null;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  venueId: string;
  plan: Plan;
  status: SubscriptionStatus;
  cardLast4: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

// ─── WebSocket event payloads ─────────────────────────────────────────────────

export type WsEventType =
  | "new_order"
  | "order_status_update"
  | "new_nudge"
  | "bill_requested"
  | "tab_opened"
  | "tab_closed"
  | "new_rating"
  | "customer_away"
  | "customer_back"
  | "staff_invite_accepted"
  | "staff_join_request"
  | "tab_paid"
  | "disbursement_failed"
  | "booking_update"
  | "stock_update"
  | "payment_claimed"
  | "kitchen_update"
  | "food_ready"
  | "item_unavailable";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
  venueId: string;
  tableId?: string;
  timestamp: string;
}

// ─── API Response wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Packages (2026-10-21) ────────────────────────────────────────────────────
// Monthly packages replace the 8% fee. Stored in venues.plan with the old enum
// names: basic = Starter, pro = Pro, elite = Bar+.
export type PlanId = "basic" | "pro" | "elite";
export type PlanFeature = "history" | "bookings" | "campaigns" | "momo" | "stock" | "kitchen";

export const PLANS: Record<PlanId, { name: string; priceRwf: number; trialDays: number; features: PlanFeature[] }> = {
  basic: { name: "Starter", priceRwf: 25000, trialDays: 14, features: [] },
  pro: { name: "Pro", priceRwf: 45000, trialDays: 30, features: ["history", "bookings", "campaigns", "momo"] },
  elite: { name: "Bar+", priceRwf: 70000, trialDays: 30, features: ["history", "bookings", "campaigns", "momo", "stock", "kitchen"] },
};

/** The cheapest package that includes a feature. */
export const PLAN_FOR: Record<PlanFeature, PlanId> = {
  history: "pro",
  bookings: "pro",
  campaigns: "pro",
  momo: "pro",
  stock: "elite",
  kitchen: "elite",
};

export function planAllows(plan: string | null | undefined, feature: PlanFeature): boolean {
  const p = PLANS[(plan as PlanId) ?? "basic"] ?? PLANS.basic;
  return p.features.includes(feature);
}
