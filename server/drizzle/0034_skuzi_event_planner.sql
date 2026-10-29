ALTER TABLE "venues" ADD COLUMN "vibe" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "photos" jsonb DEFAULT '[]'::jsonb NOT NULL;