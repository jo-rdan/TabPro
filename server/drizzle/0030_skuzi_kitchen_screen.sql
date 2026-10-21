ALTER TYPE "staff_role" ADD VALUE 'kitchen';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "kitchen_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "kitchen_ready_at" timestamp;