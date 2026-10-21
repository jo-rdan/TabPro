CREATE TABLE IF NOT EXISTS "kitchen_spends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"amount_rwf" integer NOT NULL,
	"note" text,
	"spent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "kitchen_categories" text[];--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kitchen_spends" ADD CONSTRAINT "kitchen_spends_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
