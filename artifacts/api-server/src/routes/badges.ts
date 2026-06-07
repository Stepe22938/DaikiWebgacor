import { Router, type IRouter, type Request } from "express";
import { getAuth } from "../lib/auth";
import { asc, eq, and } from "drizzle-orm";
import { db, badgesTable, userBadgesTable, usersTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  AssignUserBadgeBody,
  AssignUserBadgeParams,
  GetPublicProfileBadgesParams,
  GetPublicProfileBadgesResponse,
  ListBadgesResponseItem,
  ListBadgesResponse,
  RemoveUserBadgeParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function requireAdmin(req: Request) {
  const auth = getAuth(req);
  if (!auth.userId) return null;
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  return user?.role === "admin" || user?.role === "dev_website" ? user : null;
}

async function getUserBadges(userId: number) {
  const rows = await db
    .select({
      id: badgesTable.id,
      key: badgesTable.key,
      label: badgesTable.label,
      color: badgesTable.color,
      description: badgesTable.description,
      order: badgesTable.order,
      createdAt: badgesTable.createdAt,
    })
    .from(userBadgesTable)
    .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
    .where(eq(userBadgesTable.userId, userId))
    .orderBy(asc(badgesTable.order), asc(badgesTable.id));

  return rows.map((badge) => serializeDates(badge));
}

router.get("/badges", async (_req, res): Promise<void> => {
  try {
    const badges = await db.select().from(badgesTable).orderBy(asc(badgesTable.order), asc(badgesTable.id));
    res.json(ListBadgesResponse.parse(badges.map((badge) => serializeDates(badge))));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/members/:id/badges", async (req, res): Promise<void> => {
  const params = GetPublicProfileBadgesParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  try {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, params.data.id) });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const badges = await getUserBadges(params.data.id);
    res.json(GetPublicProfileBadgesResponse.parse(badges));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/users/:id/badges", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req);
  if (!admin) { res.status(getAuth(req).userId ? 403 : 401).json({ error: getAuth(req).userId ? "Forbidden" : "Unauthorized" }); return; }

  const params = AssignUserBadgeParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = AssignUserBadgeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  try {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, params.data.id) });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const badge = await db.query.badgesTable.findFirst({ where: eq(badgesTable.id, body.data.badgeId) });
    if (!badge) { res.status(404).json({ error: "Badge not found" }); return; }

    const existing = await db.query.userBadgesTable.findFirst({
      where: and(eq(userBadgesTable.userId, params.data.id), eq(userBadgesTable.badgeId, body.data.badgeId)),
    });
    if (!existing) {
      await db.insert(userBadgesTable).values({ userId: params.data.id, badgeId: body.data.badgeId });
    }

    res.status(201).json(ListBadgesResponseItem.parse(serializeDates(badge)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/users/:id/badges/:badgeId", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req);
  if (!admin) { res.status(getAuth(req).userId ? 403 : 401).json({ error: getAuth(req).userId ? "Forbidden" : "Unauthorized" }); return; }

  const params = RemoveUserBadgeParams.safeParse({
    id: parseInt(req.params.id as string, 10),
    badgeId: parseInt(req.params.badgeId as string, 10),
  });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  try {
    await db.delete(userBadgesTable).where(
      and(eq(userBadgesTable.userId, params.data.id), eq(userBadgesTable.badgeId, params.data.badgeId)),
    );
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
