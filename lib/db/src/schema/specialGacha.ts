import { pgTable, serial, varchar, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const specialGachaEventsTable = pgTable("special_gacha_events", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(), // 'token_royal' | 'bidding' | 'rush_board'
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  isActive: boolean("is_active").notNull().default(false),
  // Token Royal
  costPerToken: integer("cost_per_token"),
  // Bidding
  startingBid: integer("starting_bid"),
  minBidIncrement: integer("min_bid_increment"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tokenRoyalPrizesTable = pgTable("token_royal_prizes", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => specialGachaEventsTable.id, { onDelete: "cascade" }),
  tokenPosition: integer("token_position").notNull(), // 1-5
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
});

export const userTokenProgressTable = pgTable("user_token_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => specialGachaEventsTable.id, { onDelete: "cascade" }),
  tokensCollected: integer("tokens_collected").notNull().default(0),
  completedAt: timestamp("completed_at"),
}, (t) => [unique().on(t.userId, t.eventId)]);

export const biddingEntriesTable = pgTable("bidding_entries", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => specialGachaEventsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  placedAt: timestamp("placed_at").notNull().defaultNow(),
});

// Sequential title numbers awarded to bidding winners
export const titleNumbersTable = pgTable("title_numbers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => specialGachaEventsTable.id, { onDelete: "cascade" }),
  titleNo: varchar("title_no", { length: 10 }).notNull().unique(), // '0001', '0002', ...
  awardedAt: timestamp("awarded_at").notNull().defaultNow(),
});

export type SpecialGachaEvent = typeof specialGachaEventsTable.$inferSelect;
export type TokenRoyalPrize = typeof tokenRoyalPrizesTable.$inferSelect;
export type UserTokenProgress = typeof userTokenProgressTable.$inferSelect;
export type BiddingEntry = typeof biddingEntriesTable.$inferSelect;
export type TitleNumber = typeof titleNumbersTable.$inferSelect;
