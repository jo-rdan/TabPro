ALTER TYPE "staff_role" ADD VALUE 'cashier';--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "momo_check_at" timestamp;--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "momo_remind_at" timestamp;--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "momo_reminders" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "momo_remind_to" text;--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "momo_failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "momo_confirmers" text[] DEFAULT ARRAY['owner','manager','cashier']::text[] NOT NULL;