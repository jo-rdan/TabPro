CREATE TABLE IF NOT EXISTS "tab_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tab_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tab_members_tab_customer" UNIQUE("tab_id","customer_id")
);
--> statement-breakpoint
ALTER TABLE "tabs" ADD COLUMN "join_code" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tab_members" ADD CONSTRAINT "tab_members_tab_id_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."tabs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tab_members" ADD CONSTRAINT "tab_members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_join_code_unique" UNIQUE("join_code");