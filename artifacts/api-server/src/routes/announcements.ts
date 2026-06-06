import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc } from "drizzle-orm";
import { db, announcementsTable, usersTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListAnnouncementsResponse,
  CreateAnnouncementBody,
  GetAnnouncementParams,
  GetAnnouncementResponse,
  UpdateAnnouncementParams,
  UpdateAnnouncementBody,
  UpdateAnnouncementResponse,
  DeleteAnnouncementParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getActor(req: any): Promise<{ role?: string; userId?: number; username?: string }> {
  const auth = getAuth(req);
  if (!auth.userId) return {};
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  return { role: user?.role, userId: user?.id, username: user?.username };
}

router.get("/announcements", async (req, res): Promise<void> => {
  const items = await db.select().from(announcementsTable).orderBy(desc(announcementsTable.pinned), desc(announcementsTable.createdAt));
  res.json(ListAnnouncementsResponse.parse(serializeDates(items)));
});

router.post("/announcements", async (req, res): Promise<void> => {
  const { role, userId, username } = await getActor(req);
  if (role !== "admin" && role !== "staff") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(announcementsTable).values({
    ...parsed.data,
    authorId: userId ?? null,
    authorName: username ?? null,
  }).returning();

  res.status(201).json(GetAnnouncementResponse.parse(serializeDates(item)));
});

router.get("/announcements/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAnnouncementParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const item = await db.query.announcementsTable.findFirst({ where: eq(announcementsTable.id, params.data.id) });
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(GetAnnouncementResponse.parse(serializeDates(item)));
});

router.patch("/announcements/:id", async (req, res): Promise<void> => {
  const { role } = await getActor(req);
  if (role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAnnouncementParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateAnnouncementBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db.update(announcementsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(announcementsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(UpdateAnnouncementResponse.parse(serializeDates(updated)));
});

router.delete("/announcements/:id", async (req, res): Promise<void> => {
  const { role } = await getActor(req);
  if (role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAnnouncementParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(announcementsTable).where(eq(announcementsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
