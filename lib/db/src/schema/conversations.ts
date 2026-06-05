import { pgTable, serial, varchar, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 10 }).notNull(),
  name: varchar("name", { length: 100 }),
  iconUrl: text("icon_url"),
  ownerId: integer("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const conversationMembersTable = pgTable("conversation_members", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [unique().on(t.conversationId, t.userId)]);

export type Conversation = typeof conversationsTable.$inferSelect;
export type ConversationMember = typeof conversationMembersTable.$inferSelect;
