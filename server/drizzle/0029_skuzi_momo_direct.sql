ALTER TABLE "tabs" ADD COLUMN "paid_with" text;--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "paid_claim_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "momo_pay_code" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "paid_until" timestamp;
