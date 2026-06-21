import { pgTable, serial, integer, text, timestamp, index, varchar, unique, boolean, type AnyPgColumn } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { conversationsTable } from "./conversations";
import { channelsTable } from "./channels";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  channelId: integer("channel_id").references(() => channelsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").references(() => usersTable.id, { onDelete: "set null" }),
  webhookName: varchar("webhook_name", { length: 100 }),
  webhookAvatarUrl: text("webhook_avatar_url"),
  title: text("title"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  attachmentDriveFileId: text("attachment_drive_file_id"),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  attachmentMime: text("attachment_mime"),
  attachmentSize: integer("attachment_size"),
  forwardedFromMessageId: integer("forwarded_from_message_id"),
  forwardedFromConversationId: integer("forwarded_from_conversation_id").references(() => conversationsTable.id, { onDelete: "set null" }),
  replyToMessageId: integer("reply_to_message_id").references((): AnyPgColumn => messagesTable.id, { onDelete: "set null" }),
  pinned: boolean("pinned").notNull().default(false),
  pinnedAt: timestamp("pinned_at"),
  pinnedByUserId: integer("pinned_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at"),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  deletedScope: varchar("deleted_scope", { length: 20 }).notNull().default("visible"), // visible | everyone
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("messages_conv_idx").on(t.conversationId, t.createdAt)]);

export const messageHiddenForUsersTable = pgTable("message_hidden_for_users", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  hiddenAt: timestamp("hidden_at").notNull().defaultNow(),
}, (t) => [unique().on(t.messageId, t.userId), index("message_hidden_for_users_user_idx").on(t.userId, t.hiddenAt)]);

export const starredMessagesTable = pgTable("starred_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  starredAt: timestamp("starred_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.messageId),
  index("starred_messages_user_idx").on(t.userId)
]);

export const messageReactionsTable = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.messageId, t.userId, t.emoji),
  index("message_reactions_message_idx").on(t.messageId)
]);

export type Message = typeof messagesTable.$inferSelect;
