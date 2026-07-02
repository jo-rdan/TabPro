DO $$ BEGIN
 CREATE TYPE "public"."shift_log_status" AS ENUM('on_time', 'late', 'absent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"clocked_in_at" timestamp DEFAULT now() NOT NULL,
	"clocked_out_at" timestamp,
	"status" "shift_log_status" DEFAULT 'on_time' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "clock_in_pin" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
