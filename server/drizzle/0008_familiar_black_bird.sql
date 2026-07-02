CREATE TABLE IF NOT EXISTS "shift_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "table_assignments" ALTER COLUMN "shift_date" SET DATA TYPE text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
