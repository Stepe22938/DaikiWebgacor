ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_drive_file_id" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_url" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_name" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_mime" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_size" integer;
