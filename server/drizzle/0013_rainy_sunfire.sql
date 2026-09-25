ALTER TABLE "momo_payments" ALTER COLUMN "plan" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "type" text DEFAULT 'subscription' NOT NULL;--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "tab_id" uuid;--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "tabpro_commission_rwf" integer;--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "venue_payout_rwf" integer;--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "disbursement_reference_id" text;--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "disbursement_status" text;--> statement-breakpoint
ALTER TABLE "momo_payments" ADD COLUMN "disbursed_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "momo_phone" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "momo_payments" ADD CONSTRAINT "momo_payments_tab_id_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."tabs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "momo_payments" ADD CONSTRAINT "momo_payments_disbursement_reference_id_unique" UNIQUE("disbursement_reference_id");