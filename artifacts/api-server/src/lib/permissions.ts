import { db, conversationsTable, conversationMembersTable, memberRolesTable, rolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/**
 * Checks if a user has a specific permission in a conversation (group chat).
 * Group owner always has all permissions.
 */
export async function hasPermission(
  conversationId: number,
  userId: number,
  permission: "manageChannels" | "manageRoles" | "manageMessages" | "kickMembers" | "sendMessages" | "inviteMembers" | "inviteBot" | "postAnnouncements"
): Promise<boolean> {
  // 1. Fetch conversation to check owner
  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, conversationId),
  });
  if (!conv) return false;

  // Group owner has absolute privileges (similar to Discord server owner)
  if (conv.ownerId === userId) return true;

  // 2. Fetch the conversation member record
  const member = await db.query.conversationMembersTable.findFirst({
    where: and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, userId)
    ),
  });
  if (!member) return false;

  // 3. Fetch all roles assigned to this member
  const memberRoles = await db
    .select({
      permissions: rolesTable.permissions,
    })
    .from(memberRolesTable)
    .innerJoin(rolesTable, eq(memberRolesTable.roleId, rolesTable.id))
    .where(eq(memberRolesTable.conversationMemberId, member.id));

  // 4. Check if any assigned role grants the specified permission
  for (const mr of memberRoles) {
    const perms = mr.permissions as Record<string, unknown> | null;
    if (perms && perms[permission] === true) {
      return true;
    }
  }

  return false;
}
