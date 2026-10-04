CREATE TABLE IF NOT EXISTS "demo_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"venue_name" text NOT NULL,
	"phone" text NOT NULL,
	"area" text,
	"best_time" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
