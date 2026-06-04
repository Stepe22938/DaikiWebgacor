import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
  ListUsersResponse,
  UpdateUserRoleParams,
  UpdateUserRoleBody,
  UpdateUserRoleResponse,
  AdminUpdateUserParams,
  AdminUpdateUserBody,
  AdminUpdateUserResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrCreateUser(clerkId: string, username: string, avatarUrl?: string | null) {
  let user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
  if (!user) {
    const [created] = await db.insert(usersTable).values({
      clerkId,
      username,
      avatarUrl: avatarUrl ?? null,
      role: "member",
    }).returning();
    user = created;
  }
  return user;
}

router.get("/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const clerkUser = auth as { userId: string; sessionClaims?: { username?: string; image_url?: string } };
  const username = clerkUser.sessionClaims?.username ?? auth.userId;
  const avatarUrl = clerkUser.sessionClaims?.image_url ?? null;

  const user = await getOrCreateUser(auth.userId, username, avatarUrl);
  res.json(GetMeResponse.parse(serializeDates(user)));
});

router.patch("/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { username, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (username !== undefined) updateData.username = username;

  const [updated] = await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.clerkId, auth.userId))
    .returning();

  res.json(UpdateMeResponse.parse(serializeDates(updated)));
});

router.get("/users", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!currentUser || currentUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(serializeDates(users)));
});

router.patch("/users/:id/role", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!currentUser || currentUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateUserRoleParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateUserRoleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ role: body.data.role, updatedAt: new Date() })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(UpdateUserRoleResponse.parse(serializeDates(updated)));
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!currentUser || currentUser.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminUpdateUserParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = AdminUpdateUserBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.username !== undefined) updateData.username = body.data.username;
  if (body.data.displayName !== undefined) updateData.displayName = body.data.displayName;
  if (body.data.bio !== undefined) updateData.bio = body.data.bio;
  if (body.data.role !== undefined) updateData.role = body.data.role;

  const [updated] = await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(AdminUpdateUserResponse.parse(serializeDates(updated)));
});

export default router;
