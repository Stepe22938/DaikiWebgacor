CREATE TABLE IF NOT EXISTS "stickers" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_user_id" integer NOT NULL,
  "conversation_id" integer,
  "scope" varchar(30) NOT NULL DEFAULT 'local_server',
  "name" varchar(40) NOT NULL,
  "drive_file_id" text NOT NULL,
  "asset_url" text NOT NULL,
  "mime_type" varchar(120) NOT NULL,
  "size_bytes" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

DO $$ BEGIN
 ALTER TABLE "stickers"
   ADD CONSTRAINT "stickers_owner_user_id_users_id_fk"
   FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "stickers"
   ADD CONSTRAINT "stickers_conversation_id_conversations_id_fk"
   FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "stickers_owner_idx" ON "stickers" USING btree ("owner_user_id","created_at");
CREATE INDEX IF NOT EXISTS "stickers_conversation_idx" ON "stickers" USING btree ("conversation_id","created_at");
CREATE INDEX IF NOT EXISTS "stickers_scope_idx" ON "stickers" USING btree ("scope","created_at");
