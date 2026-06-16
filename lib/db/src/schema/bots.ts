import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { conversationsTable } from "./conversations";

export const botsTable = pgTable("bots", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("offline"), // 'online' | 'offline'
  category: varchar("category", { length: 50 }).notNull().default("General"), // e.g. 'Moderation', 'Utility', 'Games', 'Fun', 'General'
  webhookUrl: text("webhook_url"),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }), // corresponding user record in usersTable
  lastHeartbeat: timestamp("last_heartbeat"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const botConversationsTable = pgTable("bot_conversations", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
});

export type Bot = typeof botsTable.$inferSelect;
export type BotConversation = typeof botConversationsTable.$inferSelect;
