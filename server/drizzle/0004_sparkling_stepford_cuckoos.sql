DO $$ BEGIN
 CREATE TYPE "public"."momo_payment_status" AS ENUM('pending', 'successful', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "momo_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"plan" "plan" NOT NULL,
	"reference_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"amount_rwf" integer NOT NULL,
	"status" "momo_payment_status" DEFAULT 'pending' NOT NULL,
	"momo_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "momo_payments_reference_id_unique" UNIQUE("reference_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "momo_payments" ADD CONSTRAINT "momo_payments_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
