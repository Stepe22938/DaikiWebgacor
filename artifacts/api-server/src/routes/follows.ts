import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, followsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListMembersResponse,
  FollowUserBody,
  GetMyFollowingResponse,
  GetMyFollowersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildPublicUsers(currentUserId: number, targetUserIds?: number[]) {
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
    .filter((u) => u.id !== currentUserId)
    .map((u) => ({
      ...serializeDates(u),
      isFollowing: followingSet.has(u.id),
      followerCount: followerMap.get(u.id) ?? 0,
      followingCount: followingMap.get(u.id) ?? 0,
    }));
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

export default router;
