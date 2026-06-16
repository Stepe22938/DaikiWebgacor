import { pgTable, serial, varchar, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { conversationsTable, conversationMembersTable } from "./conversations";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#949BA4"), // hex color
  position: integer("position").notNull().default(0),
  permissions: jsonb("permissions").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.conversationId, t.name)]);

export const memberRolesTable = pgTable("member_roles", {
  id: serial("id").primaryKey(),
  conversationMemberId: integer("conversation_member_id").notNull().references(() => conversationMembersTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.conversationMemberId, t.roleId)]);

export type Role = typeof rolesTable.$inferSelect;
export type MemberRole = typeof memberRolesTable.$inferSelect;

export interface RolePermissions {
  manageChannels?: boolean;
  manageRoles?: boolean;
  manageMessages?: boolean;
  kickMembers?: boolean;
  sendMessages?: boolean;
  inviteMembers?: boolean;
  inviteBot?: boolean;
  postAnnouncements?: boolean;
}
