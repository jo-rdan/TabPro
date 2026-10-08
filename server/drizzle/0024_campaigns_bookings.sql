DO $$ BEGIN
 CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'declined', 'cancelled', 'expired', 'seated');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"customer_id" uuid,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"party_size" integer NOT NULL,
	"starts_at" timestamp NOT NULL,
	"note" text,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"table_id" uuid,
	"access_token" text NOT NULL,
	"campaign_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"reminder_sent_at" timestamp,
	"seated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"was_regular" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"came_at" timestamp,
	"came_tab_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_link_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "offer_type" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "offer_label" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "event_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "audience" text DEFAULT 'regulars' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "send_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "invites_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "invites_opt_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "opening_hours" jsonb;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "bookings_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "listed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_link_codes" ADD CONSTRAINT "guest_link_codes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_recipients_once" ON "campaign_recipients" USING btree ("campaign_id","customer_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_slug_unique" UNIQUE("slug");