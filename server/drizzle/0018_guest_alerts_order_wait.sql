ALTER TABLE "orders" ADD COLUMN "wait_alert_at" timestamp;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "tab_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tab_id_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."tabs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Orders that existed before this alert: don't alert about them all at once.
UPDATE "orders" SET "wait_alert_at" = now() WHERE "wait_alert_at" IS NULL;
