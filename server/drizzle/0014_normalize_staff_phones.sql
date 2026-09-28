-- Store every staff phone as 07XXXXXXXX (see normalizeStaffPhone in staff.service.ts)
UPDATE "staff" SET "phone" = regexp_replace("phone", '\D', '', 'g');--> statement-breakpoint
UPDATE "staff" SET "phone" = '0' || substr("phone", 4) WHERE "phone" LIKE '250%';--> statement-breakpoint
UPDATE "staff" SET "phone" = '0' || "phone" WHERE length("phone") = 9 AND "phone" LIKE '7%';
