DO $$ BEGIN
 CREATE TYPE "public"."invite_channel" AS ENUM('sms', 'whatsapp');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."order_source" AS ENUM('customer', 'staff');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."order_status" AS ENUM('pending', 'preparing', 'delivered');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."plan" AS ENUM('basic', 'pro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."qr_sticker_status" AS ENUM('unclaimed', 'claimed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."staff_role" AS ENUM('waiter', 'manager');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tab_status" AS ENUM('open', 'bill_requested', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price_rwf" integer NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_rwf" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tab_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"source" "order_source" DEFAULT 'customer' NOT NULL,
	"is_nudge" boolean DEFAULT false NOT NULL,
	"placed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"google_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "owners_email_unique" UNIQUE("email"),
	CONSTRAINT "owners_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qr_stickers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"table_id" uuid,
	"status" "qr_sticker_status" DEFAULT 'unclaimed' NOT NULL,
	"claimed_at" timestamp,
	CONSTRAINT "qr_stickers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tab_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"staff_id" uuid,
	"food_score" integer NOT NULL,
	"waiter_score" integer NOT NULL,
	"overall_score" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"role" "staff_role" DEFAULT 'waiter' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"channel" "invite_channel" DEFAULT 'whatsapp' NOT NULL,
	"token" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	CONSTRAINT "staff_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"plan" "plan" DEFAULT 'basic' NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"card_last4" text,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_venue_id_unique" UNIQUE("venue_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "table_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"shift_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"staff_id" uuid,
	"status" "tab_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"plan" "plan" DEFAULT 'basic' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"trial_ends_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_tab_id_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."tabs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qr_stickers" ADD CONSTRAINT "qr_stickers_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_tab_id_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."tabs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ratings" ADD CONSTRAINT "ratings_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff" ADD CONSTRAINT "staff_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_points" ADD CONSTRAINT "staff_points_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "table_assignments" ADD CONSTRAINT "table_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "table_assignments" ADD CONSTRAINT "table_assignments_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tables" ADD CONSTRAINT "tables_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tabs" ADD CONSTRAINT "tabs_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tabs" ADD CONSTRAINT "tabs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tabs" ADD CONSTRAINT "tabs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venues" ADD CONSTRAINT "venues_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
