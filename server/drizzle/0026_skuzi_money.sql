CREATE TABLE IF NOT EXISTS "guest_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"amount_rwf" integer NOT NULL,
	"creator_id" uuid,
	"momo_payment_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guest_credits_momo_payment_id_unique" UNIQUE("momo_payment_id")
);
--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "wallet_used_rwf" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guest_credits" ADD CONSTRAINT "guest_credits_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_credits_phone_idx" ON "guest_credits" USING btree ("phone");