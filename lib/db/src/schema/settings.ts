import { pgTable, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const systemSettingsTable = pgTable("system_settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SystemSettings = typeof systemSettingsTable.$inferSelect;
export type SystemSettingsInsert = typeof systemSettingsTable.$inferInsert;
