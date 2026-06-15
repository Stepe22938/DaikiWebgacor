import { db, conversationMembersTable, usersTable } from "./src/index.ts";
import { eq } from "drizzle-orm";

async function test() {
  try {
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

    console.log('Drizzle Rows for conv 9:', rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

test();
