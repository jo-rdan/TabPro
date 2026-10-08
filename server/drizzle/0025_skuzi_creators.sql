CREATE TABLE IF NOT EXISTS "creator_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"amount_rwf" integer NOT NULL,
	"people" integer NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creator_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"payer_phone" text NOT NULL,
	"momo_payment_id" uuid NOT NULL,
	"venue_id" uuid,
	"bill_rwf" integer NOT NULL,
	"earning_rwf" integer NOT NULL,
	"payout_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_referrals_payer_phone_unique" UNIQUE("payer_phone"),
	CONSTRAINT "creator_referrals_momo_payment_id_unique" UNIQUE("momo_payment_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"handle" text,
	"phone" text NOT NULL,
	"wanted_code" text,
	"code" text,
	"status" text DEFAULT 'applied' NOT NULL,
	"access_token" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	CONSTRAINT "creators_code_unique" UNIQUE("code"),
	CONSTRAINT "creators_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "creator_id" uuid;--> statement-breakpoint
ALTER TABLE "qr_stickers" ADD COLUMN "printed_label" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "creator_payouts" ADD CONSTRAINT "creator_payouts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "creator_referrals" ADD CONSTRAINT "creator_referrals_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "creator_referrals" ADD CONSTRAINT "creator_referrals_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "creator_referrals" ADD CONSTRAINT "creator_referrals_payout_id_creator_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."creator_payouts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
