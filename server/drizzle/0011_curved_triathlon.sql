DO $$ BEGIN
 CREATE TYPE "public"."tab_payment_status" AS ENUM('pending', 'successful', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clock_in_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clock_in_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tab_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tab_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"reference_id" uuid NOT NULL,
	"customer_phone" text NOT NULL,
	"total_amount_rwf" integer NOT NULL,
	"tabpro_fee_rwf" integer NOT NULL,
	"venue_amount_rwf" integer NOT NULL,
	"status" "tab_payment_status" DEFAULT 'pending' NOT NULL,
	"momo_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "tab_payments_reference_id_unique" UNIQUE("reference_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clock_in_sessions" ADD CONSTRAINT "clock_in_sessions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tab_payments" ADD CONSTRAINT "tab_payments_tab_id_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."tabs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tab_payments" ADD CONSTRAINT "tab_payments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;