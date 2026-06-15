import express from "express";
import router from "./routes/conversations.js";
import { db } from "@workspace/db";

// Mock req, res
const req = {
  params: { id: "9" },
  // mock clerk auth
  get: (h: string) => {
    if (h === "Authorization") return "Bearer mock_token";
    return undefined;
  }
} as any;

const res = {
  status: (code: number) => {
    console.log('STATUS:', code);
    return res;
  },
  json: (data: any) => {
    console.log('JSON RESPONSE:', JSON.stringify(data, null, 2));
    return res;
  }
} as any;

// We need to bypass getAuth(req) in conversations.ts if it throws or checks clerk.
// Let's see what getAuth does. It's imported from "../lib/auth".
// Let's print the routes directly or run the query logic.
// Actually we can run the route logic directly since we have the code.
// Let's just inspect what rows.map returns and if it matches ListConversationMembersResponse.
import { ListConversationMembersResponse } from "@workspace/api-zod";

async function run() {
  const { conversationMembersTable, usersTable, rolesTable, memberRolesTable } = await import("@workspace/db");
  const { eq, asc } = await import("drizzle-orm");

  const rows = await db
    .select({
      id: conversationMembersTable.id,
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      role: usersTable.role,
      joinedAt: conversationMembersTable.joinedAt,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(eq(conversationMembersTable.conversationId, 9));

  const enrichedMembers = await Promise.all(
    rows.map(async (row) => {
      const memberRoles = await db
        .select({
          id: rolesTable.id,
          name: rolesTable.name,
          color: rolesTable.color,
        })
        .from(memberRolesTable)
        .innerJoin(rolesTable, eq(memberRolesTable.roleId, rolesTable.id))
        .where(eq(memberRolesTable.conversationMemberId, row.id))
        .orderBy(asc(rolesTable.position));

      return {
        id: row.id,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        role: row.role,
        joinedAt: row.joinedAt.toISOString(),
        roles: memberRoles,
      };
    })
  );

  console.log('Enriched members:', enrichedMembers);
  try {
    const parsed = ListConversationMembersResponse.parse(enrichedMembers);
    console.log('Parsed successfully:', parsed);
  } catch (err) {
    console.error('Zod Parsing Error:', err);
  }
}

run();
