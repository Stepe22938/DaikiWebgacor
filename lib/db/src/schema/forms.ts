import { pgTable, serial, integer, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Main form/poll container
export const formsTable = pgTable("forms", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default("form"), // 'form' | 'poll'
  status: varchar("status", { length: 20 }).notNull().default("open"), // 'open' | 'closed'
  createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  deadline: timestamp("deadline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Fields for form-type (dynamic questions)
export const formFieldsTable = pgTable("form_fields", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => formsTable.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 500 }).notNull(),
  fieldType: varchar("field_type", { length: 30 }).notNull().default("text"), // 'text' | 'textarea' | 'radio' | 'checkbox' | 'select'
  options: text("options"), // JSON array string for radio/checkbox/select
  required: boolean("required").notNull().default(false),
  order: integer("order").notNull().default(0),
});

// Options for poll-type (voting choices)
export const pollOptionsTable = pgTable("poll_options", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => formsTable.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 500 }).notNull(),
  order: integer("order").notNull().default(0),
});

// User responses (one per user per form)
export const formResponsesTable = pgTable("form_responses", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => formsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  selectedOptionId: integer("selected_option_id").references(() => pollOptionsTable.id, { onDelete: "set null" }), // for polls
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Field answers for form-type submissions
export const formAnswersTable = pgTable("form_answers", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => formResponsesTable.id, { onDelete: "cascade" }),
  fieldId: integer("field_id").notNull().references(() => formFieldsTable.id, { onDelete: "cascade" }),
  value: text("value").notNull().default(""),
});

export type Form = typeof formsTable.$inferSelect;
export type FormField = typeof formFieldsTable.$inferSelect;
export type PollOption = typeof pollOptionsTable.$inferSelect;
export type FormResponse = typeof formResponsesTable.$inferSelect;
export type FormAnswer = typeof formAnswersTable.$inferSelect;
