import { pgTable, serial, varchar, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const cosmeticsTable = pgTable("cosmetics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("badge"), // 'badge' | 'border' | 'background'
  rarity: varchar("rarity", { length: 10 }).notNull().default("C"), // 'S' | 'A' | 'B' | 'C' | 'D'
  value: text("value").notNull(), // Raw CSS classes, image URL, or styling config
  description: text("description"),
  price: integer("price").notNull().default(0), // Price in Tokens
  isGacha: boolean("is_gacha").notNull().default(true), // Appears in Gacha pool
  isShop: boolean("is_shop").notNull().default(false), // Appears in Shop
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userCosmeticsTable = pgTable("user_cosmetics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  cosmeticId: integer("cosmetic_id").notNull().references(() => cosmeticsTable.id, { onDelete: "cascade" }),
  isEquipped: boolean("is_equipped").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.cosmeticId),
]);

export const insertCosmeticSchema = createInsertSchema(cosmeticsTable).omit({ id: true, createdAt: true });
export type InsertCosmetic = z.infer<typeof insertCosmeticSchema>;
export type Cosmetic = typeof cosmeticsTable.$inferSelect;
export type UserCosmetic = typeof userCosmeticsTable.$inferSelect;
