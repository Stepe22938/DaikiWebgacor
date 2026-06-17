ALTER TABLE "tickets"
  ADD COLUMN "ticket_type" varchar(20) NOT NULL DEFAULT 'support',
  ADD COLUMN "payment_status" varchar(20),
  ADD COLUMN "requested_tier" varchar(20),
  ADD COLUMN "requested_package_sku" varchar(50),
  ADD COLUMN "requested_conversation_id" integer,
  ADD COLUMN "admin_notes" text,
  ADD COLUMN "granted_at" timestamp;

DO $$ BEGIN
 ALTER TABLE "tickets"
   ADD CONSTRAINT "tickets_requested_conversation_id_conversations_id_fk"
   FOREIGN KEY ("requested_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "group_boost_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "slot_id" integer NOT NULL,
  "conversation_id" integer NOT NULL,
  "applied_by_user_id" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "applied_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "group_boost_assignments_slot_id_unique" UNIQUE("slot_id")
);

DO $$ BEGIN
 ALTER TABLE "group_boost_assignments"
   ADD CONSTRAINT "group_boost_assignments_slot_id_boost_slots_id_fk"
   FOREIGN KEY ("slot_id") REFERENCES "public"."boost_slots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "group_boost_assignments"
   ADD CONSTRAINT "group_boost_assignments_conversation_id_conversations_id_fk"
   FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "group_boost_assignments"
   ADD CONSTRAINT "group_boost_assignments_applied_by_user_id_users_id_fk"
   FOREIGN KEY ("applied_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "group_boost_assignments_conversation_idx" ON "group_boost_assignments" USING btree ("conversation_id","status");
