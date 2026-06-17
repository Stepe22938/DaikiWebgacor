CREATE TABLE IF NOT EXISTS "user_tier_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "tier" varchar(20) NOT NULL DEFAULT 'free',
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "source" varchar(50) NOT NULL DEFAULT 'manual',
  "starts_at" timestamp NOT NULL DEFAULT now(),
  "ends_at" timestamp,
  "auto_renews" boolean NOT NULL DEFAULT false,
  "revoked_at" timestamp,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "user_tier_subscriptions" ADD CONSTRAINT "user_tier_subscriptions_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "user_tier_subscriptions_user_idx" ON "user_tier_subscriptions" ("user_id","starts_at");

CREATE TABLE IF NOT EXISTS "storage_pools" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "provider" varchar(50) NOT NULL DEFAULT 'shared_storage',
  "capacity_bytes" bigint NOT NULL DEFAULT 5497558138880,
  "used_bytes" bigint NOT NULL DEFAULT 0,
  "proxy_uploads_enabled" boolean NOT NULL DEFAULT true,
  "validation_mode" varchar(20) NOT NULL DEFAULT 'proxy',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "storage_pools_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "storage_objects" (
  "id" serial PRIMARY KEY NOT NULL,
  "pool_id" integer NOT NULL,
  "owner_user_id" integer NOT NULL,
  "provider_file_id" text,
  "object_key" text,
  "original_name" text NOT NULL,
  "mime_type" varchar(255) NOT NULL,
  "size_bytes" bigint NOT NULL,
  "checksum_sha256" varchar(64),
  "validation_status" varchar(20) NOT NULL DEFAULT 'pending',
  "visibility_scope" varchar(20) NOT NULL DEFAULT 'private',
  "uploaded_via" varchar(20) NOT NULL DEFAULT 'proxy',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "validated_at" timestamp,
  "deleted_at" timestamp
);
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_pool_id_storage_pools_id_fk"
FOREIGN KEY ("pool_id") REFERENCES "storage_pools"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_owner_user_id_users_id_fk"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "storage_objects_owner_idx" ON "storage_objects" ("owner_user_id","created_at");
CREATE INDEX IF NOT EXISTS "storage_objects_pool_idx" ON "storage_objects" ("pool_id","created_at");

CREATE TABLE IF NOT EXISTS "boost_packages" (
  "id" serial PRIMARY KEY NOT NULL,
  "sku" varchar(50) NOT NULL,
  "display_name" varchar(100) NOT NULL,
  "boost_count" integer NOT NULL,
  "price_idr" integer NOT NULL,
  "duration_days" integer NOT NULL DEFAULT 30,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "boost_packages_sku_unique" UNIQUE("sku")
);

CREATE TABLE IF NOT EXISTS "boost_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "buyer_user_id" integer NOT NULL,
  "package_id" integer NOT NULL,
  "total_boost_count" integer NOT NULL,
  "total_price_idr" integer NOT NULL,
  "payment_status" varchar(20) NOT NULL DEFAULT 'paid',
  "purchased_at" timestamp NOT NULL DEFAULT now(),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "boost_orders" ADD CONSTRAINT "boost_orders_buyer_user_id_users_id_fk"
FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "boost_orders" ADD CONSTRAINT "boost_orders_package_id_boost_packages_id_fk"
FOREIGN KEY ("package_id") REFERENCES "boost_packages"("id") ON DELETE restrict ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "boost_slots" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "owner_user_id" integer NOT NULL,
  "assigned_user_id" integer,
  "status" varchar(20) NOT NULL DEFAULT 'available',
  "activated_at" timestamp,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "last_transferred_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "boost_slots" ADD CONSTRAINT "boost_slots_order_id_boost_orders_id_fk"
FOREIGN KEY ("order_id") REFERENCES "boost_orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "boost_slots" ADD CONSTRAINT "boost_slots_owner_user_id_users_id_fk"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "boost_slots" ADD CONSTRAINT "boost_slots_assigned_user_id_users_id_fk"
FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "boost_slots_owner_idx" ON "boost_slots" ("owner_user_id","status");
CREATE INDEX IF NOT EXISTS "boost_slots_assigned_idx" ON "boost_slots" ("assigned_user_id","status");

CREATE TABLE IF NOT EXISTS "boost_slot_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "slot_id" integer NOT NULL,
  "actor_user_id" integer NOT NULL,
  "from_user_id" integer,
  "to_user_id" integer,
  "event_type" varchar(20) NOT NULL,
  "notes" text,
  "occurred_at" timestamp NOT NULL DEFAULT now()
);
ALTER TABLE "boost_slot_events" ADD CONSTRAINT "boost_slot_events_slot_id_boost_slots_id_fk"
FOREIGN KEY ("slot_id") REFERENCES "boost_slots"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "boost_slot_events" ADD CONSTRAINT "boost_slot_events_actor_user_id_users_id_fk"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "boost_slot_events" ADD CONSTRAINT "boost_slot_events_from_user_id_users_id_fk"
FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "boost_slot_events" ADD CONSTRAINT "boost_slot_events_to_user_id_users_id_fk"
FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "boost_slot_events_slot_idx" ON "boost_slot_events" ("slot_id","occurred_at");
