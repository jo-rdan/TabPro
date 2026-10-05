CREATE TABLE IF NOT EXISTS "error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"method" text,
	"path" text,
	"message" text NOT NULL,
	"stack" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
