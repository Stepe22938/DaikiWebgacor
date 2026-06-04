import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, asc } from "drizzle-orm";
import { db, developmentsTable, usersTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListDevelopmentsResponse,
  CreateDevelopmentBody,
  GetDevelopmentParams,
  GetDevelopmentResponse,
  UpdateDevelopmentParams,
  UpdateDevelopmentBody,
  UpdateDevelopmentResponse,
  DeleteDevelopmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function requireAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  if (!auth.userId) return false;
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  return user?.role === "admin";
}

router.get("/developments", async (req, res): Promise<void> => {
  const items = await db.select().from(developmentsTable).orderBy(asc(developmentsTable.order), asc(developmentsTable.createdAt));
  res.json(ListDevelopmentsResponse.parse(serializeDates(items)));
});

router.post("/developments", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = CreateDevelopmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(developmentsTable).values(parsed.data).returning();
  res.status(201).json(GetDevelopmentResponse.parse(serializeDates(item)));
});

router.get("/developments/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDevelopmentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const item = await db.query.developmentsTable.findFirst({ where: eq(developmentsTable.id, params.data.id) });
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(GetDevelopmentResponse.parse(serializeDates(item)));
});

router.patch("/developments/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDevelopmentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateDevelopmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db.update(developmentsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(developmentsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(UpdateDevelopmentResponse.parse(serializeDates(updated)));
});

router.delete("/developments/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDevelopmentParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(developmentsTable).where(eq(developmentsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
