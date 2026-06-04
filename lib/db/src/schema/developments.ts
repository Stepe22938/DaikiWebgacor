import { pgTable, serial, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const developmentsTable = pgTable("developments", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("planned"),
  progress: integer("progress"),
  iconName: varchar("icon_name", { length: 100 }),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDevelopmentSchema = createInsertSchema(developmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDevelopment = z.infer<typeof insertDevelopmentSchema>;
export type Development = typeof developmentsTable.$inferSelect;
