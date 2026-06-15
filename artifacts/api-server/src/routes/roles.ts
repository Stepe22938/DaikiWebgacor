import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, asc } from "drizzle-orm";
import {
  db,
  usersTable,
  conversationsTable,
  conversationMembersTable,
  rolesTable,
  memberRolesTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

async function isMember(conversationId: number, userId: number) {
  const m = await db.query.conversationMembersTable.findFirst({
    where: and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, userId),
    ),
  });
  return !!m;
}

async function isOwner(conversationId: number, userId: number) {
  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, conversationId),
  });
  return conv?.ownerId === userId;
}

async function getMemberId(conversationId: number, userId: number) {
  const m = await db.query.conversationMembersTable.findFirst({
    where: and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, userId),
    ),
  });
  return m?.id ?? null;
}

// GET /conversations/:id/roles - list roles
router.get("/conversations/:id/roles", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const roles = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.conversationId, id))
    .orderBy(asc(rolesTable.position));

  res.json(roles.map(serializeDates));
});

// POST /conversations/:id/roles - create role
router.post("/conversations/:id/roles", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner can manage roles" }); return; }

  const { name, color, permissions } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Role name is required" });
    return;
  }
  if (name.length > 50) {
    res.status(400).json({ error: "Role name too long" });
    return;
  }

  const roleColor = (color && typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) ? color : "#949BA4";

  // Get max position
  const [maxPos] = await db
    .select({ pos: rolesTable.position })
    .from(rolesTable)
    .where(eq(rolesTable.conversationId, id))
    .orderBy(asc(rolesTable.position));

  const position = (maxPos?.pos ?? -1) + 1;

  const [role] = await db
    .insert(rolesTable)
    .values({
      conversationId: id,
      name: name.trim(),
      color: roleColor,
      position,
      permissions: permissions || {},
    })
    .returning();

  res.status(201).json(serializeDates(role));
});

// PATCH /conversations/:id/roles/:roleId - update role
router.patch("/conversations/:id/roles/:roleId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  const roleId = parseInt(req.params.roleId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner can manage roles" }); return; }

  const role = await db.query.rolesTable.findFirst({
    where: and(eq(rolesTable.id, roleId), eq(rolesTable.conversationId, id)),
  });
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }

  const { name, color, permissions, position } = req.body;
  const updates: Record<string, unknown> = {};
  if (name && typeof name === "string") updates.name = name.trim();
  if (color && typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) updates.color = color;
  if (permissions && typeof permissions === "object") updates.permissions = permissions;
  if (typeof position === "number") updates.position = position;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No updates provided" });
    return;
  }

  const [updated] = await db
    .update(rolesTable)
    .set(updates)
    .where(eq(rolesTable.id, roleId))
    .returning();

  res.json(serializeDates(updated));
});

// DELETE /conversations/:id/roles/:roleId - delete role
router.delete("/conversations/:id/roles/:roleId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  const roleId = parseInt(req.params.roleId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner can manage roles" }); return; }

  const role = await db.query.rolesTable.findFirst({
    where: and(eq(rolesTable.id, roleId), eq(rolesTable.conversationId, id)),
  });
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }

  await db.delete(rolesTable).where(eq(rolesTable.id, roleId));
  res.status(204).send();
});

// POST /conversations/:id/members/:memberId/roles - assign role to member
router.post("/conversations/:id/members/:memberId/roles", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  const memberId = parseInt(req.params.memberId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner can assign roles" }); return; }

  const { roleId } = req.body;
  if (!roleId || typeof roleId !== "number") {
    res.status(400).json({ error: "roleId is required" });
    return;
  }

  // Verify role exists in this conversation
  const role = await db.query.rolesTable.findFirst({
    where: and(eq(rolesTable.id, roleId), eq(rolesTable.conversationId, id)),
  });
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }

  // Verify member exists
  const member = await db.query.conversationMembersTable.findFirst({
    where: and(eq(conversationMembersTable.id, memberId), eq(conversationMembersTable.conversationId, id)),
  });
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  // Upsert member_roles
  try {
    const [mr] = await db
      .insert(memberRolesTable)
      .values({ conversationMemberId: memberId, roleId })
      .returning();
    res.status(201).json(serializeDates(mr));
  } catch {
    res.status(400).json({ error: "Role already assigned" });
  }
});

// DELETE /conversations/:id/members/:memberId/roles/:roleId - remove role
router.delete("/conversations/:id/members/:memberId/roles/:roleId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  const memberId = parseInt(req.params.memberId, 10);
  const roleId = parseInt(req.params.roleId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner can manage roles" }); return; }

  await db
    .delete(memberRolesTable)
    .where(and(
      eq(memberRolesTable.conversationMemberId, memberId),
      eq(memberRolesTable.roleId, roleId),
    ));

  res.status(204).send();
});

// GET /conversations/:id/members/:memberId/roles - list roles for a member
router.get("/conversations/:id/members/:memberId/roles", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  const memberId = parseInt(req.params.memberId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const member = await db.query.conversationMembersTable.findFirst({
    where: and(eq(conversationMembersTable.id, memberId), eq(conversationMembersTable.conversationId, id)),
  });
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  const memberRoles = await db
    .select({
      id: rolesTable.id,
      name: rolesTable.name,
      color: rolesTable.color,
      position: rolesTable.position,
      permissions: rolesTable.permissions,
    })
    .from(memberRolesTable)
    .innerJoin(rolesTable, eq(memberRolesTable.roleId, rolesTable.id))
    .where(eq(memberRolesTable.conversationMemberId, memberId))
    .orderBy(asc(rolesTable.position));

  res.json(memberRoles.map(serializeDates));
});

export default router;
