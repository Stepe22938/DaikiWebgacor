import { pgTable, serial, varchar, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";

export const channelCategoriesTable = pgTable("channel_categories", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.conversationId, t.name)]);

export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => channelCategoriesTable.id, { onDelete: "set null" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 10 }).notNull().default("text"), // 'text' | 'voice'
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.conversationId, t.name)]);

export type ChannelCategory = typeof channelCategoriesTable.$inferSelect;
export type Channel = typeof channelsTable.$inferSelect;
