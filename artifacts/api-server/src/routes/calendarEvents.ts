import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, asc } from "drizzle-orm";
import { db, calendarEventsTable, usersTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListCalendarEventsResponse,
  CreateCalendarEventBody,
  GetCalendarEventParams,
  GetCalendarEventResponse,
  UpdateCalendarEventParams,
  UpdateCalendarEventBody,
  UpdateCalendarEventResponse,
  DeleteCalendarEventParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function requireAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  if (!auth.userId) return false;
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  return user?.role === "admin" || user?.role === "dev_website";
}

router.get("/calendar-events", async (req, res): Promise<void> => {
  const items = await db.select().from(calendarEventsTable).orderBy(asc(calendarEventsTable.eventDate), asc(calendarEventsTable.startTime));
  res.json(ListCalendarEventsResponse.parse(serializeDates(items)));
});

router.post("/calendar-events", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateCalendarEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(calendarEventsTable).values(parsed.data).returning();
  res.status(201).json(GetCalendarEventResponse.parse(serializeDates(item)));
});

router.get("/calendar-events/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetCalendarEventParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const item = await db.query.calendarEventsTable.findFirst({ where: eq(calendarEventsTable.id, params.data.id) });
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(GetCalendarEventResponse.parse(serializeDates(item)));
});

router.patch("/calendar-events/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateCalendarEventParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateCalendarEventBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db.update(calendarEventsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(calendarEventsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(UpdateCalendarEventResponse.parse(serializeDates(updated)));
});

router.delete("/calendar-events/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteCalendarEventParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
