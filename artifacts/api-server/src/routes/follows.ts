import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, sql, inArray, asc, isNull } from "drizzle-orm";
import { db, usersTable, followsTable, userCosmeticsTable, cosmeticsTable } from "@workspace/db";
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

async function attachEquippedCosmetics<T extends { id: number }>(users: T[]): Promise<(T & { equippedBorder: string | null; equippedBadge: string | null; equippedBackground: string | null })[]> {
  if (users.length === 0) return [];
  const userIds = users.map(u => u.id);
  const equipped = await db
    .select({
      userId: userCosmeticsTable.userId,
      type: cosmeticsTable.type,
      value: cosmeticsTable.value,
    })
    .from(userCosmeticsTable)
    .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
    .where(
      and(
        inArray(userCosmeticsTable.userId, userIds),
        eq(userCosmeticsTable.isEquipped, true)
      )
    );
  const cosmeticsMap = new Map<number, { border: string | null; badge: string | null; background: string | null }>();
  for (const item of equipped) {
    if (!cosmeticsMap.has(item.userId)) {
      cosmeticsMap.set(item.userId, { border: null, badge: null, background: null });
    }
    const userCos = cosmeticsMap.get(item.userId)!;
    if (item.type === "border") userCos.border = item.value;
    else if (item.type === "badge") userCos.badge = item.value;
    else if (item.type === "background") userCos.background = item.value;
  }
  return users.map(u => {
    const cos = cosmeticsMap.get(u.id) || { border: null, badge: null, background: null };
    return {
      ...u,
      equippedBorder: cos.border,
      equippedBadge: cos.badge,
      equippedBackground: cos.background,
    };
  });
}

async function attachEquippedCosmeticsToSingle<T extends { id: number }>(user: T) {
  const [withCosmetics] = await attachEquippedCosmetics([user]);
  return withCosmetics;
}

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

  const serializedList = allUsers
    .filter((u) => includeCurrentUser || u.id !== currentUserId)
    .map((u) => ({
      ...serializeDates(u),
      isFollowing: followingSet.has(u.id),
      followerCount: followerMap.get(u.id) ?? 0,
      followingCount: followingMap.get(u.id) ?? 0,
    }));

  return attachEquippedCosmetics(serializedList);
}

async function buildPublicUser(currentUserId: number, targetUserId: number) {
  const [profile] = await buildPublicUsers(currentUserId, [targetUserId]);
  return profile;
}

router.get("/users/resolve/:target", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  const targetParam = req.params.target;
  let targetUser;

  const targetId = parseInt(targetParam, 10);
  if (!isNaN(targetId) && String(targetId) === targetParam) {
    targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  } else {
    targetUser = await db.query.usersTable.findFirst({
      where: sql`lower(${usersTable.username}) = ${targetParam.toLowerCase()}`,
    });
  }

  if (!targetUser) {
    res.status(404).json({ error: "Target user not found" });
    return;
  }

  const profile = await buildPublicUser(me.id, targetUser.id);
  res.json(profile);
});

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

    const meWithCosmetics = await attachEquippedCosmeticsToSingle(me);
    res.json(GetPublicProfileResponse.parse({
      ...serializeDates(meWithCosmetics),
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
  if (!me || (me.role !== "admin" && me.role !== "dev_website")) { res.status(403).json({ error: "Forbidden" }); return; }

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

  const iFollowRows = await db
    .select({ id: followsTable.followingId, pinnedAt: followsTable.pinnedAt })
    .from(followsTable)
    .where(eq(followsTable.followerId, me.id));
  const theyFollow = await db
    .select({ id: followsTable.followerId })
    .from(followsTable)
    .where(eq(followsTable.followingId, me.id));

  const theyFollowSet = new Set(theyFollow.map((r) => r.id));
  const friendRows = iFollowRows.filter((r) => theyFollowSet.has(r.id));
  const friendIds = friendRows.map((r) => r.id);
  const pinnedAtMap = new Map(friendRows.map((r) => [r.id, r.pinnedAt]));

  if (friendIds.length === 0) { res.json([]); return; }

  const users = await buildPublicUsers(me.id, friendIds);

  const result = users
    .map((u) => ({ ...u, pinnedAt: pinnedAtMap.get(u.id)?.toISOString() ?? null }))
    .sort((a, b) => {
      if (a.pinnedAt && !b.pinnedAt) return -1;
      if (!a.pinnedAt && b.pinnedAt) return 1;
      if (a.pinnedAt && b.pinnedAt) return a.pinnedAt > b.pinnedAt ? -1 : 1;
      return (a.username ?? "").localeCompare(b.username ?? "");
    });

  res.json(result);
});

router.post("/follows/:userId/pin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  const targetId = parseInt(req.params.userId as string, 10);

  await db.update(followsTable)
    .set({ pinnedAt: new Date() })
    .where(and(eq(followsTable.followerId, me.id), eq(followsTable.followingId, targetId)));

  res.json({ success: true });
});

router.delete("/follows/:userId/pin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  const targetId = parseInt(req.params.userId as string, 10);

  await db.update(followsTable)
    .set({ pinnedAt: null })
    .where(and(eq(followsTable.followerId, me.id), eq(followsTable.followingId, targetId)));

  res.json({ success: true });
});

router.post("/admin/follows", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me || (me.role !== "admin" && me.role !== "dev_website")) {
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
