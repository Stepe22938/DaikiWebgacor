import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("diamond"), // 'diamond' | 'rp'
  type: varchar("type", { length: 50 }).notNull(), // 'claim_free' | 'spin_cost' | 'duplicate_refund' | 'admin_adjust' | 'topup' | 'convert_spend' | 'convert_receive'
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactionsTable.$inferInsert;
