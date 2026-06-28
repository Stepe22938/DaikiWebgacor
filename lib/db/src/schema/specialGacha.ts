import { pgTable, serial, varchar, text, integer, boolean, timestamp, unique, decimal } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const specialGachaEventsTable = pgTable("special_gacha_events", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(), // 'token_royal' | 'bidding' | 'rush_board'
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  isActive: boolean("is_active").notNull().default(false),
  // Spin system
  spinCost: integer("spin_cost").notNull().default(50),
  sharkRate: decimal("shark_rate", { precision: 5, scale: 2 }).notNull().default("0.30"), // 30% chance
  displayMode: varchar("display_mode", { length: 50 }).notNull().default("tiles"), // 'tiles' | 'list'
  // Bidding
  startingBid: integer("starting_bid"),
  minBidIncrement: integer("min_bid_increment"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Custom rewards for any event (Token Royal, Bidding, Rush Board, etc)
export const eventRewardsTable = pgTable("event_rewards", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => specialGachaEventsTable.id, { onDelete: "cascade" }),
  rewardType: varchar("reward_type", { length: 50 }).notNull(), // 'tier1' | 'tier2' | 'grand_prize' etc
  rewardTier: integer("reward_tier").notNull(), // 1, 2, 3, 4, 5 for visual ordering
  rewardName: varchar("reward_name", { length: 255 }).notNull(),
  rewardDescription: text("reward_description"),
  rewardImageUrl: text("reward_image_url"),
  rewardQuantity: integer("reward_quantity").notNull().default(1),
  isGrandPrize: boolean("is_grand_prize").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.eventId, t.rewardTier, t.rewardType)]);

// Track user progress (which rewards collected)
export const userEventRewardProgressTable = pgTable("user_event_reward_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => specialGachaEventsTable.id, { onDelete: "cascade" }),
  collectedRewardIds: integer("collected_reward_ids").array().default(sql`ARRAY[]::integer[]`),
  totalSpins: integer("total_spins").notNull().default(0),
  sharkCount: integer("shark_count").notNull().default(0),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.eventId)]);

// Audit log for all spins
export const eventSpinResultsTable = pgTable("event_spin_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => specialGachaEventsTable.id, { onDelete: "cascade" }),
  resultType: varchar("result_type", { length: 20 }).notNull(), // 'reward' | 'shark'
  rewardId: integer("reward_id").references(() => eventRewardsTable.id, { onDelete: "set null" }),
  isShark: boolean("is_shark").notNull().default(false),
  diamondsSpent: integer("diamonds_spent").notNull(),
  discountApplied: integer("discount_applied").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
export type EventReward = typeof eventRewardsTable.$inferSelect;
export type UserEventRewardProgress = typeof userEventRewardProgressTable.$inferSelect;
export type EventSpinResult = typeof eventSpinResultsTable.$inferSelect;
export type BiddingEntry = typeof biddingEntriesTable.$inferSelect;
export type TitleNumber = typeof titleNumbersTable.$inferSelect;
