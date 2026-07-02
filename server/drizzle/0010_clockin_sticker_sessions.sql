ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "clock_in_sticker_code" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venues" ADD CONSTRAINT "venues_clock_in_sticker_code_unique" UNIQUE("clock_in_sticker_code");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clock_in_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clock_in_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clock_in_sessions" ADD CONSTRAINT "clock_in_sessions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
