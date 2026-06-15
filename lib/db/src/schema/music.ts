import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const musicTable = pgTable("music", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  artist: varchar("artist", { length: 255 }).notNull(),
  album: varchar("album", { length: 255 }).notNull().default(""),
  file: text("file").notNull(),
  cover: text("cover").notNull(),
  duration: varchar("duration", { length: 50 }).notNull(),
  type: varchar("type", { length: 100 }).notNull().default("Global Charts"),
  releaseDate: varchar("release_date", { length: 50 }).notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMusicSchema = createInsertSchema(musicTable).omit({ id: true, createdAt: true });
export type InsertMusic = z.infer<typeof insertMusicSchema>;
export type Music = typeof musicTable.$inferSelect;
