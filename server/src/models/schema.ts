import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  date,
  pgEnum,
  jsonb,
  uniqueIndex,
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
  // The venue's own page on Skuzi: /v/<slug>. Set from the name, unique.
  slug: text("slug").unique(),
  // { mon: { open: "11:00", close: "01:00" } | null, … }. A close at or before
  // the open time means after midnight. null = not set yet (defaults apply).
  openingHours: jsonb("opening_hours"),
  bookingsEnabled: boolean("bookings_enabled").default(true).notNull(),
  // Shown on Explore. Demo venues never are, whatever this says.
  listed: boolean("listed").default(true).notNull(),
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
  // The big number printed on the sticker ("5"): the table is named after it.
  printedLabel: text("printed_label"),
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
  // "Want invites to Kigali's best nights?" Yes = campaigns may reach them.
  invitesOptIn: boolean("invites_opt_in").default(false).notNull(),
  invitesOptInAt: timestamp("invites_opt_in_at"),
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
  // The guest came because of this campaign (opened within 7 days of it).
  campaignId: uuid("campaign_id"),
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
  // Chef's pick: shown first on the venue's page and on Explore (max 3).
  featured: boolean("featured").default(false).notNull(),
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
  title: text("title"),
  message: text("message").notNull(),
  // 'none' | 'free_item' (offerLabel, e.g. "Free shot", served by staff) |
  // 'discount_10' (10% off, applied when the guest pays with Skuzi).
  offerType: text("offer_type").default("none").notNull(),
  offerLabel: text("offer_label"),
  // When the event happens (shown on Explore and the venue page), if any.
  eventAt: timestamp("event_at"),
  // 'regulars' = guests of this venue; 'everyone' = plus other Skuzi guests.
  audience: text("audience").default("regulars").notNull(),
  // 'scheduled' | 'sent' | 'cancelled' ('draft' for old rows).
  status: text("status").default("draft").notNull(),
  sendAt: timestamp("send_at"),
  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count").default(0).notNull(),
  returnVisits: integer("return_visits").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Who a campaign reached, and whether they came (a tab within 7 days).
export const campaignRecipients = pgTable("campaign_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  // Had a tab at the venue before the campaign was sent.
  wasRegular: boolean("was_regular").default(false).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  cameAt: timestamp("came_at"),
  cameTabId: uuid("came_tab_id"),
}, (t) => ({
  oncePerCampaign: uniqueIndex("campaign_recipients_once").on(t.campaignId, t.customerId),
}));

// ─── Skuzi Creators ───────────────────────────────────────────────────────────
// Creators (TikTok, Instagram…) bring new guests with their code. They earn
// 500 RWF per new person who pays with Skuzi (bill 6,500 RWF or more), 1.5% of
// smaller bills, paid monthly from what Skuzi already earned.
export const creators = pgTable("creators", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  handle: text("handle"),               // @their_tiktok
  phone: text("phone").notNull(),       // MoMo number for payouts (07XXXXXXXX)
  wantedCode: text("wanted_code"),
  code: text("code").unique(),          // set when approved
  // 'applied' | 'active' | 'paused' | 'declined'
  status: text("status").default("applied").notNull(),
  // Their private page: /creator/<accessToken>
  accessToken: text("access_token").notNull().unique(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
});

export const creatorPayouts = pgTable("creator_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").references(() => creators.id, { onDelete: "cascade" }).notNull(),
  amountRwf: integer("amount_rwf").notNull(),
  people: integer("people").notNull(),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
});

// One row per new person a creator brought (a person counts once, ever).
export const creatorReferrals = pgTable("creator_referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").references(() => creators.id, { onDelete: "cascade" }).notNull(),
  payerPhone: text("payer_phone").notNull().unique(),
  momoPaymentId: uuid("momo_payment_id").notNull().unique(),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "set null" }),
  billRwf: integer("bill_rwf").notNull(),
  earningRwf: integer("earning_rwf").notNull(),
  payoutId: uuid("payout_id").references(() => creatorPayouts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending", "confirmed", "declined", "cancelled", "expired", "seated",
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  partySize: integer("party_size").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  note: text("note"),
  status: bookingStatusEnum("status").default("pending").notNull(),
  tableId: uuid("table_id").references(() => tables.id, { onDelete: "set null" }),
  // The guest's private link to see or cancel it: /booking/<id>?t=<token>
  accessToken: text("access_token").notNull(),
  campaignId: uuid("campaign_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  seatedAt: timestamp("seated_at"),
});

// One-time codes that carry a guest from Safari to the Skuzi icon on their
// Home Screen (iPhone keeps the two apart), so invites reach the right person.
export const guestLinkCodes = pgTable("guest_link_codes", {
  code: text("code").primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
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
export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignRecipients.campaignId], references: [campaigns.id] }),
  customer: one(customers, { fields: [campaignRecipients.customerId], references: [customers.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  venue: one(venues, { fields: [bookings.venueId], references: [venues.id] }),
  customer: one(customers, { fields: [bookings.customerId], references: [customers.id] }),
  table: one(tables, { fields: [bookings.tableId], references: [tables.id] }),
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
  // Set for a guest's device outside a bill: invites (if they said yes) and
  // updates about their bookings.
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
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
  // The creator whose code the guest typed when paying (Skuzi Creators).
  creatorId: uuid("creator_id"),
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
  // 'demo' = asked for a demo; 'waitlist' = owner joined the launch waitlist
  source: text("source").default("demo").notNull(),
  venueType: text("venue_type"),
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
