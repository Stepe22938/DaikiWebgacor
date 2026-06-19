import { pgTable, serial, integer, varchar, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { conversationsTable } from "./conversations";

export const stickersTable = pgTable("stickers", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").references(() => conversationsTable.id, { onDelete: "cascade" }),
  originStickerId: integer("origin_sticker_id"),
  originConversationId: integer("origin_conversation_id").references(() => conversationsTable.id, { onDelete: "set null" }),
  scope: varchar("scope", { length: 30 }).notNull().default("local_server"), // local_server | global_cross_server
  name: varchar("name", { length: 40 }).notNull(),
  driveFileId: text("drive_file_id").notNull(),
  assetUrl: text("asset_url").notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  editorConfig: jsonb("editor_config").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("stickers_owner_idx").on(t.ownerUserId, t.createdAt),
  index("stickers_conversation_idx").on(t.conversationId, t.createdAt),
  index("stickers_scope_idx").on(t.scope, t.createdAt),
]);

export type Sticker = typeof stickersTable.$inferSelect;
