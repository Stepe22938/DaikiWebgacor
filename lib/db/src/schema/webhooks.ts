import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { channelsTable } from "./channels";
import { usersTable } from "./users";

export const webhooksTable = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => channelsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  avatarUrl: text("avatar_url"),
  token: varchar("token", { length: 255 }).notNull().unique(),
  creatorId: integer("creator_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Webhook = typeof webhooksTable.$inferSelect;
