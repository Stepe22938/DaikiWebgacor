import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const statusesTable = pgTable("statuses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull().default("image"), // "image" | "text"
  mediaUrl: text("media_url"),
  caption: text("caption"),
  backgroundColor: varchar("background_color", { length: 50 }),
  textColor: varchar("text_color", { length: 50 }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Status = typeof statusesTable.$inferSelect;
export type InsertStatus = typeof statusesTable.$inferInsert;
