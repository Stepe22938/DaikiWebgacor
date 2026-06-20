import { pgTable, serial, integer, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { conversationsTable } from "./conversations";

export const emojisTable = pgTable("emojis", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").references(() => conversationsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 40 }).notNull(), // shortname, e.g. "pepe" (stored without colons)
  driveFileId: text("drive_file_id").notNull(),
  assetUrl: text("asset_url").notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("emojis_owner_idx").on(t.ownerUserId, t.createdAt),
  index("emojis_conversation_idx").on(t.conversationId, t.createdAt),
]);

export type Emoji = typeof emojisTable.$inferSelect;
