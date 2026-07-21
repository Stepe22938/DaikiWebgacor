import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const calendarEventsTable = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventDate: varchar("event_date", { length: 100 }).notNull(), // stored as YYYY-MM-DD
  startTime: varchar("start_time", { length: 50 }).notNull(),   // e.g. "14:00"
  endTime: varchar("end_time", { length: 50 }).notNull(),       // e.g. "16:00"
  color: varchar("color", { length: 50 }).default("violet"),    // e.g. violet, indigo, amber, emerald, rose
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEventsTable.$inferSelect;
