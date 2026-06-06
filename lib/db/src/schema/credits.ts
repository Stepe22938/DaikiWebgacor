import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creditsTable = pgTable("credits", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  backgroundUrl: text("background_url"),
  role: varchar("role", { length: 255 }).notNull(),
  description: text("description"),
  borderType: varchar("border_type", { length: 50 }).notNull().default("frame1"), // 'frame1' through 'frame8'
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCreditSchema = createInsertSchema(creditsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCredit = z.infer<typeof insertCreditSchema>;
export type Credit = typeof creditsTable.$inferSelect;
