ALTER TABLE "demo_requests" ADD COLUMN "source" text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_requests" ADD COLUMN "venue_type" text;