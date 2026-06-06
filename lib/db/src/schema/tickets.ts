import { pgTable, serial, integer, text, varchar, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"), // open, in_progress, resolved, closed
  adminId: integer("admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ticketMessagesTable = pgTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketReasonsTable = pgTable("ticket_reasons", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 120 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  unique().on(t.label),
]);

export type Ticket = typeof ticketsTable.$inferSelect;
export type TicketMessage = typeof ticketMessagesTable.$inferSelect;
export type TicketReason = typeof ticketReasonsTable.$inferSelect;
