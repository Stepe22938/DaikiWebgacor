import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, asc } from "drizzle-orm";
import { db, usersTable, boostPackagesTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const PackageSchema = z.object({
  sku: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  boostCount: z.number().int().positive(),
  priceIdr: z.number().int().min(1000),
  discountPriceIdr: z.number().int().min(1000).optional().nullable(),
  durationDays: z.number().int().positive().default(30),
  active: z.boolean().default(true),
});

const PackageUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  boostCount: z.number().int().positive().optional(),
  priceIdr: z.number().int().min(1000).optional(),
  discountPriceIdr: z.number().int().min(1000).optional().nullable(),
  durationDays: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

async function getAdminUser(clerkId: string) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
  return user && (user.role === "admin" || user.role === "dev_website") ? user : null;
}

// GET /api/admin/boost-packages — list all packages (admin)
router.get("/admin/boost-packages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = await getAdminUser(auth.userId);
  if (!admin) { res.status(403).json({ error: "Forbidden" }); return; }

  try {
    const packages = await db.query.boostPackagesTable.findMany({
      orderBy: [asc(boostPackagesTable.boostCount)],
    });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: "Failed to list boost packages" });
  }
});

// POST /api/admin/boost-packages — create new package
router.post("/admin/boost-packages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = await getAdminUser(auth.userId);
  if (!admin) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = PackageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [pkg] = await db.insert(boostPackagesTable).values({
      sku: parsed.data.sku,
      displayName: parsed.data.displayName,
      description: parsed.data.description ?? null,
      boostCount: parsed.data.boostCount,
      priceIdr: parsed.data.priceIdr,
      discountPriceIdr: parsed.data.discountPriceIdr ?? null,
      durationDays: parsed.data.durationDays,
      active: parsed.data.active,
    }).returning();
    res.status(201).json(pkg);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "SKU sudah dipakai. Gunakan SKU yang berbeda." });
    } else {
      res.status(500).json({ error: "Failed to create boost package" });
    }
  }
});

// PATCH /api/admin/boost-packages/:id — update package
router.patch("/admin/boost-packages/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = await getAdminUser(auth.userId);
  if (!admin) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = PackageUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [updated] = await db.update(boostPackagesTable)
      .set(parsed.data)
      .where(eq(boostPackagesTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Package tidak ditemukan" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update boost package" });
  }
});

// DELETE /api/admin/boost-packages/:id — delete package
router.delete("/admin/boost-packages/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = await getAdminUser(auth.userId);
  if (!admin) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  try {
    const [deleted] = await db.delete(boostPackagesTable)
      .where(eq(boostPackagesTable.id, id))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Package tidak ditemukan" }); return; }
    res.json({ success: true });
  } catch (err: any) {
    if (err?.code === "23503") {
      res.status(409).json({ error: "Package sudah punya order aktif, tidak bisa dihapus." });
    } else {
      res.status(500).json({ error: "Failed to delete boost package" });
    }
  }
});

export default router;
