ALTER TYPE "tab_status" ADD VALUE 'abandoned';--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "last_seen_at" timestamp DEFAULT now();