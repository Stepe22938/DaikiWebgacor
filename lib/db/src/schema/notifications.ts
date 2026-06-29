import { pgTable, serial, integer, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { conversationsTable } from "./conversations";
import { messagesTable } from "./messages";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  senderId: integer("sender_id")
    .references(() => usersTable.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id")
    .references(() => conversationsTable.id, { onDelete: "cascade" })
    .notNull(),
  messageId: integer("message_id")
    .references(() => messagesTable.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
