import { pgTable, serial, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull(),
  userTag: varchar("user_tag", { length: 4 }).notNull().default("#001"),
  displayName: varchar("display_name", { length: 100 }),
  avatarUrl: text("avatar_url"),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  bio: text("bio"),
  youtubeLiveUrl: text("youtube_live_url"),
  messagePrivacy: varchar("message_privacy", { length: 20 }).notNull().default("friends_only"),
  mcUsername: varchar("mc_username", { length: 100 }),
  diamonds: integer("diamonds").notNull().default(1000),
  connectedVoiceChannelId: integer("connected_voice_channel_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true, connectedVoiceChannelId: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
