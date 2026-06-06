import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, followsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListMembersResponse,
  GetPublicProfileParams,
  GetPublicProfileResponse,
  GetPublicProfileFollowersParams,
  GetPublicProfileFollowersResponse,
  GetPublicProfileFollowingParams,
  GetPublicProfileFollowingResponse,
  FollowUserBody,
  GetMyFollowingResponse,
  GetMyFollowersResponse,
  AdminCreateFollowBody,
  AdminBulkCreateFollowersBody,
  GetMyFriendsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildPublicUsers(currentUserId: number, targetUserIds?: number[], includeCurrentUser = false) {
  const allUsers = targetUserIds
    ? await db.select().from(usersTable).where(
        sql`${usersTable.id} = ANY(${sql.raw(`ARRAY[${targetUserIds.join(",")}]::int[]`)})`,
      )
    : await db.select().from(usersTable);

  const followerCounts = await db
    .select({ followingId: followsTable.followingId, count: sql<number>`count(*)::int` })
    .from(followsTable)
    .groupBy(followsTable.followingId);

  const followingCounts = await db
    .select({ followerId: followsTable.followerId, count: sql<number>`count(*)::int` })
    .from(followsTable)
    .groupBy(followsTable.followerId);

  const myFollows = await db
    .select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, currentUserId));

  const followingSet = new Set(myFollows.map((f) => f.followingId));
  const followerMap = new Map(followerCounts.map((r) => [r.followingId, r.count]));
  const followingMap = new Map(followingCounts.map((r) => [r.followerId, r.count]));

  return allUsers
    .filter((u) => includeCurrentUser || u.id !== currentUserId)
    .map((u) => ({
      ...serializeDates(u),
      isFollowing: followingSet.has(u.id),
      followerCount: followerMap.get(u.id) ?? 0,
      followingCount: followingMap.get(u.id) ?? 0,
    }));
}

async function buildPublicUser(currentUserId: number, targetUserId: number) {
  const [profile] = await buildPublicUsers(currentUserId, [targetUserId]);
  return profile;
}

router.get("/members", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const result = await buildPublicUsers(me.id);
  res.json(ListMembersResponse.parse(result));
});

router.get("/members/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const params = GetPublicProfileParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (params.data.id === me.id) {
    const followerCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(followsTable)
      .where(eq(followsTable.followingId, me.id));
    const followingCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(followsTable)
      .where(eq(followsTable.followerId, me.id));

    res.json(GetPublicProfileResponse.parse({
      ...serializeDates(me),
      isFollowing: false,
      followerCount: followerCount[0]?.count ?? 0,
      followingCount: followingCount[0]?.count ?? 0,
    }));
    return;
  }

  const profile = await buildPublicUser(me.id, params.data.id);
  if (!profile) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetPublicProfileResponse.parse(profile));
});

router.get("/members/:id/followers", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const params = GetPublicProfileFollowersParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, params.data.id) });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const rows = await db
    .select({ followerId: followsTable.followerId })
    .from(followsTable)
    .where(eq(followsTable.followingId, params.data.id));

  const ids = rows.map((row) => row.followerId);
  const result = ids.length > 0 ? await buildPublicUsers(me.id, ids, true) : [];
  res.json(GetPublicProfileFollowersResponse.parse(result));
});

router.get("/members/:id/following", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const params = GetPublicProfileFollowingParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, params.data.id) });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const rows = await db
    .select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, params.data.id));

  const ids = rows.map((row) => row.followingId);
  const result = ids.length > 0 ? await buildPublicUsers(me.id, ids, true) : [];
  res.json(GetPublicProfileFollowingResponse.parse(result));
});

router.post("/follows", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = FollowUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (me.id === parsed.data.userId) {
    res.status(400).json({ error: "Cannot follow yourself" });
    return;
  }

  const existing = await db.query.followsTable.findFirst({
    where: and(
      eq(followsTable.followerId, me.id),
      eq(followsTable.followingId, parsed.data.userId),
    ),
  });

  if (existing) {
    res.status(409).json({ error: "Already following" });
    return;
  }

  const [follow] = await db.insert(followsTable).values({
    followerId: me.id,
    followingId: parsed.data.userId,
  }).returning();

  res.status(201).json({ followerId: follow.followerId, followingId: follow.followingId });
});

router.delete("/follows/:userId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const targetId = parseInt(req.params.userId as string, 10);
  if (isNaN(targetId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  await db.delete(followsTable).where(
    and(eq(followsTable.followerId, me.id), eq(followsTable.followingId, targetId)),
  );

  res.status(204).send();
});

router.get("/me/following", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const rows = await db.select({ followingId: followsTable.followingId }).from(followsTable).where(eq(followsTable.followerId, me.id));
  const ids = rows.map((r) => r.followingId);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const result = await buildPublicUsers(me.id, ids);
  res.json(GetMyFollowingResponse.parse(result));
});

router.get("/me/followers", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const rows = await db.select({ followerId: followsTable.followerId }).from(followsTable).where(eq(followsTable.followingId, me.id));
  const ids = rows.map((r) => r.followerId);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const result = await buildPublicUsers(me.id, ids);
  res.json(GetMyFollowersResponse.parse(result));
});

router.post("/admin/bulk-followers", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me || me.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = AdminBulkCreateFollowersBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { targetUserId, count } = parsed.data;
  const BATCH = 500;
  let botsCreated = 0;
  let followsCreated = 0;

  for (let offset = 0; offset < count; offset += BATCH) {
    const batchSize = Math.min(BATCH, count - offset);
    const botValues = Array.from({ length: batchSize }, () => {
      const rand = Math.random().toString(36).slice(2, 10);
      return { clerkId: `bot_${rand}_${Date.now()}`, username: `bot_${rand}`, role: "bot" as const };
    });

    const inserted = await db.insert(usersTable).values(
      botValues.map((b) => ({ clerkId: b.clerkId, username: b.username, role: "member" }))
    ).returning({ id: usersTable.id });

    botsCreated += inserted.length;

    const followValues = inserted.map((b) => ({ followerId: b.id, followingId: targetUserId }));
    await db.insert(followsTable).values(followValues);
    followsCreated += followValues.length;
  }

  res.status(201).json({ botsCreated, followsCreated });
});

router.get("/me/friends", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  console.log("[DEBUG] /me/friends - current user:", me.id, me.username);

  const iFollow = await db.select({ id: followsTable.followingId }).from(followsTable).where(eq(followsTable.followerId, me.id));
  const theyFollow = await db.select({ id: followsTable.followerId }).from(followsTable).where(eq(followsTable.followingId, me.id));

  console.log("[DEBUG] /me/friends - iFollow:", iFollow);
  console.log("[DEBUG] /me/friends - theyFollow:", theyFollow);

  const iFollowSet = new Set(iFollow.map((r) => r.id));
  const theyFollowSet = new Set(theyFollow.map((r) => r.id));
  const friendIds = [...iFollowSet].filter((id) => theyFollowSet.has(id));

  console.log("[DEBUG] /me/friends - friendIds:", friendIds);

  if (friendIds.length === 0) { res.json([]); return; }

  const result = await buildPublicUsers(me.id, friendIds);
  console.log("[DEBUG] /me/friends - result:", result);
  
  res.json(GetMyFriendsResponse.parse(result));
});

router.post("/admin/follows", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me || me.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = AdminCreateFollowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { followerId, followingId } = parsed.data;
  if (followerId === followingId) {
    res.status(400).json({ error: "Cannot follow yourself" });
    return;
  }

  const existing = await db.query.followsTable.findFirst({
    where: and(eq(followsTable.followerId, followerId), eq(followsTable.followingId, followingId)),
  });
  if (existing) {
    res.status(409).json({ error: "Already following" });
    return;
  }

  const [follow] = await db.insert(followsTable).values({ followerId, followingId }).returning();
  res.status(201).json({ followerId: follow.followerId, followingId: follow.followingId });
});

export default router;
