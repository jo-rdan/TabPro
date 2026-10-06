import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const planEnum = pgEnum("plan", ["basic", "pro", "elite"]);
export const tabStatusEnum = pgEnum("tab_status", [
  "open",
  "bill_requested",
  "abandoned",
  "closed",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "preparing",
  "delivered",
]);
export const orderSourceEnum = pgEnum("order_source", ["customer", "staff"]);
export const staffRoleEnum = pgEnum("staff_role", ["waiter", "manager"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
]);
export const qrStickerStatusEnum = pgEnum("qr_sticker_status", [
  "unclaimed",
  "claimed",
]);
export const inviteChannelEnum = pgEnum("invite_channel", ["sms", "whatsapp"]);
export const shiftLogStatusEnum = pgEnum("shift_log_status", [
  "on_time",
  "late",
  "absent",
]);

// ─── Owners ───────────────────────────────────────────────────────────────────

export const owners = pgTable("owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  googleId: text("google_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Venues ───────────────────────────────────────────────────────────────────

export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .references(() => owners.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  location: text("location"),
  logoUrl: text("logo_url"),
  plan: planEnum("plan").default("basic").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  trialEndsAt: timestamp("trial_ends_at").notNull(),
  clockInPin: text("clock_in_pin"),
  clockInStickerCode: text("clock_in_sticker_code").unique(),
  momoPhone: text("momo_phone"), // venue's Pawapay payout number
  // Demo venues show Skuzi to prospects: payments are simulated, never real.
  isDemo: boolean("is_demo").default(false).notNull(),
  // Venue terms the owner agreed to in the app ("I agree"), replacing paper.
  termsVersion: integer("terms_version"),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsAcceptedBy: text("terms_accepted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Every time an owner agrees to the venue terms: the permanent record.
export const venueTermsAcceptances = pgTable("venue_terms_acceptances", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "cascade" }).notNull(),
  ownerId: uuid("owner_id").references(() => owners.id, { onDelete: "cascade" }).notNull(),
  ownerName: text("owner_name").notNull(),
  version: integer("version").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
});

// ─── Staff ────────────────────────────────────────────────────────────────────

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: staffRoleEnum("role").default("waiter").notNull(),
  // Waiters without a smartphone still get tables, credit and tips; their
  // alerts go to a manager (or the owner if there's no manager).
  hasSmartphone: boolean("has_smartphone").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  pin: text("pin"), // bcrypt hash, null until waiter sets it on first login
  // Joined by scanning the clock-in sticker; inactive until the owner approves.
  pendingApproval: boolean("pending_approval").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const staffInvites = pgTable("staff_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id")
    .references(() => staff.id, { onDelete: "cascade" })
    .notNull(),
  channel: inviteChannelEnum("channel").default("whatsapp").notNull(),
  token: text("token").notNull().unique(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
});

// ─── Tables & QR ─────────────────────────────────────────────────────────────

export const tables = pgTable("tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  label: text("label").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const qrStickers = pgTable("qr_stickers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  tableId: uuid("table_id").references(() => tables.id, {
    onDelete: "set null",
  }),
  status: qrStickerStatusEnum("status").default("unclaimed").notNull(),
  claimedAt: timestamp("claimed_at"),
});

export const tableAssignments = pgTable("table_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id")
    .references(() => staff.id, { onDelete: "cascade" })
    .notNull(),
  tableId: uuid("table_id")
    .references(() => tables.id, { onDelete: "cascade" })
    .notNull(),
  shiftDate: text("shift_date").notNull(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export const tabs = pgTable("tabs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tableId: uuid("table_id")
    .references(() => tables.id)
    .notNull(),
  customerId: uuid("customer_id")
    .references(() => customers.id)
    .notNull(),
  staffId: uuid("staff_id").references(() => staff.id),
  status: tabStatusEnum("status").default("open").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
});

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tabId: uuid("tab_id")
    .references(() => tabs.id, { onDelete: "cascade" })
    .notNull(),
  status: orderStatusEnum("status").default("pending").notNull(),
  source: orderSourceEnum("source").default("customer").notNull(),
  isNudge: boolean("is_nudge").default(false).notNull(),
  placedAt: timestamp("placed_at").defaultNow().notNull(),
  // When staff were told this order has been waiting too long (once per order).
  waitAlertAt: timestamp("wait_alert_at"),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  menuItemId: uuid("menu_item_id")
    .references(() => menuItems.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceRwf: integer("unit_price_rwf").notNull(),
});

// ─── Menu ─────────────────────────────────────────────────────────────────────

export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  priceRwf: integer("price_rwf").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
});

// ─── Ratings ──────────────────────────────────────────────────────────────────

export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tabId: uuid("tab_id")
    .references(() => tabs.id)
    .notNull(),
  venueId: uuid("venue_id")
    .references(() => venues.id)
    .notNull(),
  staffId: uuid("staff_id").references(() => staff.id),
  foodScore: integer("food_score").notNull(),
  waiterScore: integer("waiter_score").notNull(),
  overallScore: integer("overall_score").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Staff Points ─────────────────────────────────────────────────────────────

export const staffPoints = pgTable("staff_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id")
    .references(() => staff.id, { onDelete: "cascade" })
    .notNull(),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  message: text("message").notNull(),
  status: text("status").default("draft").notNull(),
  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count").default(0).notNull(),
  returnVisits: integer("return_visits").default(0).notNull(),
});

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  plan: planEnum("plan").default("basic").notNull(),
  status: subscriptionStatusEnum("status").default("trialing").notNull(),
  cardLast4: text("card_last4"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const ownersRelations = relations(owners, ({ many }) => ({
  venues: many(venues),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  owner: one(owners, { fields: [venues.ownerId], references: [owners.id] }),
  tables: many(tables),
  staff: many(staff),
  menuItems: many(menuItems),
  campaigns: many(campaigns),
  subscription: one(subscriptions, {
    fields: [venues.id],
    references: [subscriptions.venueId],
  }),
  ratings: many(ratings),
}));

export const staffRelations = relations(staff, ({ one, many }) => ({
  venue: one(venues, { fields: [staff.venueId], references: [venues.id] }),
  tableAssignments: many(tableAssignments),
  invites: many(staffInvites),
  points: many(staffPoints),
  ratings: many(ratings),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  venue: one(venues, { fields: [tables.venueId], references: [venues.id] }),
  qrSticker: one(qrStickers, {
    fields: [tables.id],
    references: [qrStickers.tableId],
  }),
  assignments: many(tableAssignments),
  tabs: many(tabs),
}));

export const tabsRelations = relations(tabs, ({ one, many }) => ({
  table: one(tables, { fields: [tabs.tableId], references: [tables.id] }),
  customer: one(customers, {
    fields: [tabs.customerId],
    references: [customers.id],
  }),
  staff: one(staff, { fields: [tabs.staffId], references: [staff.id] }),
  orders: many(orders),
  rating: one(ratings, { fields: [tabs.id], references: [ratings.tabId] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tab: one(tabs, { fields: [orders.tabId], references: [tabs.id] }),
  items: many(orderItems),
}));

export const staffPointsRelations = relations(staffPoints, ({ one }) => ({
  staff: one(staff, { fields: [staffPoints.staffId], references: [staff.id] }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  tab: one(tabs, { fields: [ratings.tabId], references: [tabs.id] }),
  venue: one(venues, { fields: [ratings.venueId], references: [venues.id] }),
  staff: one(staff, { fields: [ratings.staffId], references: [staff.id] }),
}));

export const staffInvitesRelations = relations(staffInvites, ({ one }) => ({
  staff: one(staff, { fields: [staffInvites.staffId], references: [staff.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  tabs: many(tabs),
}));

export const qrStickersRelations = relations(qrStickers, ({ one }) => ({
  table: one(tables, { fields: [qrStickers.tableId], references: [tables.id] }),
}));

export const tableAssignmentsRelations = relations(
  tableAssignments,
  ({ one }) => ({
    staff: one(staff, {
      fields: [tableAssignments.staffId],
      references: [staff.id],
    }),
    table: one(tables, {
      fields: [tableAssignments.tableId],
      references: [tables.id],
    }),
  }),
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  venue: one(venues, {
    fields: [subscriptions.venueId],
    references: [venues.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  venue: one(venues, { fields: [campaigns.venueId], references: [venues.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

// ─── Push Subscriptions ───────────────────────────────────────────────────────

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  // Set for a guest's phone: alerts about their own bill only.
  tabId: uuid("tab_id").references(() => tabs.id, { onDelete: "cascade" }),
  // Not unique: one browser can be signed up as the owner and as a waiter.
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    staff: one(staff, {
      fields: [pushSubscriptions.staffId],
      references: [staff.id],
    }),
    venue: one(venues, {
      fields: [pushSubscriptions.venueId],
      references: [venues.id],
    }),
  }),
);

// ─── MoMo Payments ────────────────────────────────────────────────────────────

export const momoPaymentStatusEnum = pgEnum("momo_payment_status", [
  "pending",
  "successful",
  "failed",
]);

export const momoPayments = pgTable("momo_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull().default("subscription"), // 'subscription' | 'tab'
  plan: planEnum("plan"), // null for tab payments
  tabId: uuid("tab_id").references(() => tabs.id, { onDelete: "set null" }),
  referenceId: uuid("reference_id").notNull().unique(),
  phone: text("phone").notNull(),
  amountRwf: integer("amount_rwf").notNull(),
  tabproCommissionRwf: integer("tabpro_commission_rwf"),
  venuePayoutRwf: integer("venue_payout_rwf"),
  disbursementReferenceId: text("disbursement_reference_id").unique(),
  disbursementStatus: text("disbursement_status"),
  disbursedAt: timestamp("disbursed_at"),
  status: momoPaymentStatusEnum("status").default("pending").notNull(),
  momoStatus: text("momo_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const momoPaymentsRelations = relations(momoPayments, ({ one }) => ({
  venue: one(venues, {
    fields: [momoPayments.venueId],
    references: [venues.id],
  }),
  tab: one(tabs, {
    fields: [momoPayments.tabId],
    references: [tabs.id],
  }),
}));

// ─── Shifts ───────────────────────────────────────────────────────────────────

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),     // HH:MM
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  venue: one(venues, { fields: [shifts.venueId], references: [venues.id] }),
  assignments: many(shiftAssignments),
}));

export const shiftAssignments = pgTable("shift_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id")
    .references(() => staff.id, { onDelete: "cascade" })
    .notNull(),
  shiftId: uuid("shift_id")
    .references(() => shifts.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shiftAssignmentsRelations = relations(shiftAssignments, ({ one }) => ({
  staff: one(staff, { fields: [shiftAssignments.staffId], references: [staff.id] }),
  shift: one(shifts, { fields: [shiftAssignments.shiftId], references: [shifts.id] }),
}));

// ─── Shift Logs (clock-in / clock-out) ─────────────────────────────────────────

export const shiftLogs = pgTable("shift_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  staffId: uuid("staff_id")
    .references(() => staff.id, { onDelete: "cascade" })
    .notNull(),
  shiftId: uuid("shift_id")
    .references(() => shifts.id, { onDelete: "cascade" })
    .notNull(),
  clockedInAt: timestamp("clocked_in_at").defaultNow().notNull(),
  clockedOutAt: timestamp("clocked_out_at"),
  status: shiftLogStatusEnum("status").default("on_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shiftLogsRelations = relations(shiftLogs, ({ one }) => ({
  staff: one(staff, { fields: [shiftLogs.staffId], references: [staff.id] }),
  shift: one(shifts, { fields: [shiftLogs.shiftId], references: [shifts.id] }),
}));

// ─── Tab Payments ─────────────────────────────────────────────────────────────

export const tabPaymentStatusEnum = pgEnum("tab_payment_status", [
  "pending",
  "successful",
  "failed",
]);

export const tabPayments = pgTable("tab_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tabId: uuid("tab_id")
    .references(() => tabs.id, { onDelete: "cascade" })
    .notNull(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  referenceId: uuid("reference_id").notNull().unique(),
  customerPhone: text("customer_phone").notNull(),
  totalAmountRwf: integer("total_amount_rwf").notNull(),
  tabproFeeRwf: integer("tabpro_fee_rwf").notNull(),    // 3%
  venueAmountRwf: integer("venue_amount_rwf").notNull(), // 97%
  status: tabPaymentStatusEnum("status").default("pending").notNull(),
  momoStatus: text("momo_status"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const tabPaymentsRelations = relations(tabPayments, ({ one }) => ({
  tab: one(tabs, { fields: [tabPayments.tabId], references: [tabs.id] }),
  venue: one(venues, { fields: [tabPayments.venueId], references: [venues.id] }),
}));

// ─── Clock-in Sessions ──────────────────────────────────────────────────────────
// Created the moment a phone scans the static wall sticker. Short-lived (90s) and
// single-use — the sticker itself never changes, only the session born from a scan.

export const clockInSessions = pgTable("clock_in_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id")
    .references(() => venues.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clockInSessionsRelations = relations(clockInSessions, ({ one }) => ({
  venue: one(venues, { fields: [clockInSessions.venueId], references: [venues.id] }),
}));

// ─── Demo requests from the website ─────────────────────────────────────────

export const demoRequests = pgTable("demo_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  venueName: text("venue_name").notNull(),
  phone: text("phone").notNull(),
  area: text("area"),
  bestTime: text("best_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Server error log ───────────────────────────────────────────────────────
// Unexpected (5xx) errors and crashes in background jobs, so we can see what
// went wrong without digging through Render's logs.

export const errorLogs = pgTable("error_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  method: text("method"),
  path: text("path"),
  message: text("message").notNull(),
  stack: text("stack"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
