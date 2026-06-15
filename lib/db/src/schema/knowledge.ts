import { pgTable, serial, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const aiKnowledgeTable = pgTable("ai_knowledge", {
  id: serial("id").primaryKey(),
  topic: varchar("topic", { length: 255 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 500 }),
  learnedAt: timestamp("learned_at").defaultNow(),
  isRelevant: boolean("is_relevant").default(true),
});

export const insertAiKnowledgeSchema = createInsertSchema(aiKnowledgeTable).omit({ id: true, learnedAt: true });
