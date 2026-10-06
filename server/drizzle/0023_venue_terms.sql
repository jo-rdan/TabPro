CREATE TABLE IF NOT EXISTS "venue_terms_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_name" text NOT NULL,
	"version" integer NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "terms_version" integer;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "terms_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "terms_accepted_by" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_terms_acceptances" ADD CONSTRAINT "venue_terms_acceptances_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_terms_acceptances" ADD CONSTRAINT "venue_terms_acceptances_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
