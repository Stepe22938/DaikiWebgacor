import { pgTable, serial, integer, varchar, timestamp, text, boolean, bigint, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { conversationsTable } from "./conversations";

export const userTierSubscriptionsTable = pgTable("user_tier_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tier: varchar("tier", { length: 20 }).notNull().default("free"), // free | premium | premium_plus
  status: varchar("status", { length: 20 }).notNull().default("active"), // active | expired | revoked | scheduled
  source: varchar("source", { length: 50 }).notNull().default("manual"),
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at"),
  autoRenews: boolean("auto_renews").notNull().default(false),
  revokedAt: timestamp("revoked_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("user_tier_subscriptions_user_idx").on(t.userId, t.startsAt),
]);

export const storagePoolsTable = pgTable("storage_pools", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull().default("shared_storage"),
  capacityBytes: bigint("capacity_bytes", { mode: "number" }).notNull().default(5497558138880),
  usedBytes: bigint("used_bytes", { mode: "number" }).notNull().default(0),
  proxyUploadsEnabled: boolean("proxy_uploads_enabled").notNull().default(true),
  validationMode: varchar("validation_mode", { length: 20 }).notNull().default("proxy"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const storageObjectsTable = pgTable("storage_objects", {
  id: serial("id").primaryKey(),
  poolId: integer("pool_id").notNull().references(() => storagePoolsTable.id, { onDelete: "cascade" }),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  providerFileId: text("provider_file_id"),
  objectKey: text("object_key"),
  originalName: text("original_name").notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  checksumSha256: varchar("checksum_sha256", { length: 64 }),
  validationStatus: varchar("validation_status", { length: 20 }).notNull().default("pending"), // pending | validated | rejected | deleted
  visibilityScope: varchar("visibility_scope", { length: 20 }).notNull().default("private"),
  uploadedVia: varchar("uploaded_via", { length: 20 }).notNull().default("proxy"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  validatedAt: timestamp("validated_at"),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("storage_objects_owner_idx").on(t.ownerUserId, t.createdAt),
  index("storage_objects_pool_idx").on(t.poolId, t.createdAt),
]);

export const boostPackagesTable = pgTable("boost_packages", {
  id: serial("id").primaryKey(),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  boostCount: integer("boost_count").notNull(),
  priceIdr: integer("price_idr").notNull(),
  durationDays: integer("duration_days").notNull().default(30),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const boostOrdersTable = pgTable("boost_orders", {
  id: serial("id").primaryKey(),
  buyerUserId: integer("buyer_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  packageId: integer("package_id").notNull().references(() => boostPackagesTable.id, { onDelete: "restrict" }),
  totalBoostCount: integer("total_boost_count").notNull(),
  totalPriceIdr: integer("total_price_idr").notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("paid"), // pending | paid | refunded | cancelled
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const boostSlotsTable = pgTable("boost_slots", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => boostOrdersTable.id, { onDelete: "cascade" }),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  assignedUserId: integer("assigned_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).notNull().default("available"), // available | active | expired | revoked
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  lastTransferredAt: timestamp("last_transferred_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("boost_slots_owner_idx").on(t.ownerUserId, t.status),
  index("boost_slots_assigned_idx").on(t.assignedUserId, t.status),
]);

export const boostSlotEventsTable = pgTable("boost_slot_events", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").notNull().references(() => boostSlotsTable.id, { onDelete: "cascade" }),
  actorUserId: integer("actor_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fromUserId: integer("from_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  toUserId: integer("to_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 20 }).notNull(), // assign | transfer | revoke | expire
  notes: text("notes"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
}, (t) => [
  index("boost_slot_events_slot_idx").on(t.slotId, t.occurredAt),
]);

export const groupBoostAssignmentsTable = pgTable("group_boost_assignments", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").notNull().references(() => boostSlotsTable.id, { onDelete: "cascade" }).unique(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  appliedByUserId: integer("applied_by_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active | revoked | expired
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("group_boost_assignments_conversation_idx").on(t.conversationId, t.status),
]);

export type UserTierSubscription = typeof userTierSubscriptionsTable.$inferSelect;
export type StoragePool = typeof storagePoolsTable.$inferSelect;
export type StorageObject = typeof storageObjectsTable.$inferSelect;
export type BoostPackage = typeof boostPackagesTable.$inferSelect;
export type BoostOrder = typeof boostOrdersTable.$inferSelect;
export type BoostSlot = typeof boostSlotsTable.$inferSelect;
export type BoostSlotEvent = typeof boostSlotEventsTable.$inferSelect;
export type GroupBoostAssignment = typeof groupBoostAssignmentsTable.$inferSelect;
