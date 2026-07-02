ALTER TABLE "campaigns" ADD COLUMN "recipient_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "return_visits" integer DEFAULT 0 NOT NULL;