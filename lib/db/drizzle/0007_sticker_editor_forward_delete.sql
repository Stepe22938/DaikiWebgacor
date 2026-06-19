ALTER TABLE "stickers"
  ADD COLUMN IF NOT EXISTS "origin_sticker_id" integer,
  ADD COLUMN IF NOT EXISTS "origin_conversation_id" integer,
  ADD COLUMN IF NOT EXISTS "editor_config" jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE "stickers"
    ADD CONSTRAINT "stickers_origin_sticker_id_stickers_id_fk"
    FOREIGN KEY ("origin_sticker_id") REFERENCES "public"."stickers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stickers"
    ADD CONSTRAINT "stickers_origin_conversation_id_conversations_id_fk"
    FOREIGN KEY ("origin_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "forwarded_from_message_id" integer,
  ADD COLUMN IF NOT EXISTS "forwarded_from_conversation_id" integer,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp,
  ADD COLUMN IF NOT EXISTS "deleted_by_user_id" integer,
  ADD COLUMN IF NOT EXISTS "deleted_scope" varchar(20) NOT NULL DEFAULT 'visible';

DO $$ BEGIN
  ALTER TABLE "messages"
    ADD CONSTRAINT "messages_forwarded_from_conversation_id_conversations_id_fk"
    FOREIGN KEY ("forwarded_from_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "messages"
    ADD CONSTRAINT "messages_deleted_by_user_id_users_id_fk"
    FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "message_hidden_for_users" (
  "id" serial PRIMARY KEY NOT NULL,
  "message_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "hidden_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "message_hidden_for_users_message_id_user_id_unique" UNIQUE("message_id", "user_id")
);

DO $$ BEGIN
  ALTER TABLE "message_hidden_for_users"
    ADD CONSTRAINT "message_hidden_for_users_message_id_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "message_hidden_for_users"
    ADD CONSTRAINT "message_hidden_for_users_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "message_hidden_for_users_user_idx" ON "message_hidden_for_users" USING btree ("user_id","hidden_at");
