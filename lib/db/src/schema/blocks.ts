import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userBlocksTable = pgTable("user_blocks", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  blockedId: integer("blocked_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  blockedAt: timestamp("blocked_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.blockerId, t.blockedId),
]);

export type UserBlock = typeof userBlocksTable.$inferSelect;
