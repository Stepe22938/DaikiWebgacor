import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, asc } from "drizzle-orm";
import { db, usersTable, creditsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import * as zod from "zod";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

// --- GET ALL CREDITS ---
router.get("/credits", async (req, res): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(creditsTable)
      .orderBy(asc(creditsTable.order), asc(creditsTable.id));
      
    res.json(list.map((c) => serializeDates(c)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- CREATE CREDIT (Admin Only) ---
const CreateCreditSchema = zod.object({
  name: zod.string().min(1).max(255),
  avatarUrl: zod.string().optional(),
  backgroundUrl: zod.string().optional(),
  role: zod.string().min(1).max(255),
  description: zod.string().optional(),
  borderType: zod.string().default("frame1"),
  order: zod.number().int().optional(),
});

router.post("/credits", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = CreateCreditSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [inserted] = await db.insert(creditsTable).values({
      name: parsed.data.name,
      avatarUrl: parsed.data.avatarUrl ?? null,
      backgroundUrl: parsed.data.backgroundUrl ?? null,
      role: parsed.data.role,
      description: parsed.data.description ?? null,
      borderType: parsed.data.borderType,
      order: parsed.data.order ?? 0,
    }).returning();

    res.status(201).json(serializeDates(inserted));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- UPDATE CREDIT (Admin Only) ---
const UpdateCreditSchema = zod.object({
  name: zod.string().min(1).max(255).optional(),
  avatarUrl: zod.string().optional(),
  backgroundUrl: zod.string().optional(),
  role: zod.string().min(1).max(255).optional(),
  description: zod.string().optional(),
  borderType: zod.string().optional(),
  order: zod.number().int().optional(),
});

router.patch("/credits/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const creditId = parseInt(req.params.id as string, 10);
  if (isNaN(creditId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateCreditSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const existing = await db.query.creditsTable.findFirst({ where: eq(creditsTable.id, creditId) });
    if (!existing) { res.status(404).json({ error: "Credit not found" }); return; }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.avatarUrl !== undefined) updateData.avatarUrl = parsed.data.avatarUrl || null;
    if (parsed.data.backgroundUrl !== undefined) updateData.backgroundUrl = parsed.data.backgroundUrl || null;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
    if (parsed.data.borderType !== undefined) updateData.borderType = parsed.data.borderType;
    if (parsed.data.order !== undefined) updateData.order = parsed.data.order;

    const [updated] = await db
      .update(creditsTable)
      .set(updateData)
      .where(eq(creditsTable.id, creditId))
      .returning();

    res.json(serializeDates(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE CREDIT (Admin Only) ---
router.delete("/credits/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const creditId = parseInt(req.params.id as string, 10);
  if (isNaN(creditId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  try {
    const existing = await db.query.creditsTable.findFirst({ where: eq(creditsTable.id, creditId) });
    if (!existing) { res.status(404).json({ error: "Credit not found" }); return; }

    await db.delete(creditsTable).where(eq(creditsTable.id, creditId));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
