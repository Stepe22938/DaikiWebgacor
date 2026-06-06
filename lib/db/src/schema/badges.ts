import { pgTable, serial, varchar, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const badgesTable = pgTable("badges", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 80 }).notNull().unique(),
  label: varchar("label", { length: 120 }).notNull(),
  color: varchar("color", { length: 32 }).notNull().default("#facc15"),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badgesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.badgeId),
]);

export const insertBadgeSchema = createInsertSchema(badgesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badgesTable.$inferSelect;
export type UserBadge = typeof userBadgesTable.$inferSelect;
