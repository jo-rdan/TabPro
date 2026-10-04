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
  | "disbursement_failed";

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
