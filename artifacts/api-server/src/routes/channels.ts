import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, asc, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  conversationsTable,
  conversationMembersTable,
  channelsTable,
  channelCategoriesTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

async function isMember(conversationId: number, userId: number) {
  const m = await db.query.conversationMembersTable.findFirst({
    where: and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, userId),
    ),
  });
  return !!m;
}

async function isOwner(conversationId: number, userId: number) {
  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, conversationId),
  });
  return conv?.ownerId === userId;
}

// === CHANNEL CATEGORIES ===

// GET /conversations/:id/categories
router.get("/conversations/:id/categories", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const id = parseInt(req.params.id, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const cats = await db.select().from(channelCategoriesTable)
    .where(eq(channelCategoriesTable.conversationId, id))
    .orderBy(asc(channelCategoriesTable.position));
  res.json(cats.map(serializeDates));
});

// POST /conversations/:id/categories
router.post("/conversations/:id/categories", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const id = parseInt(req.params.id, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner" }); return; }

  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Category name required" }); return;
  }

  const [maxPos] = await db.select({ pos: channelCategoriesTable.position })
    .from(channelCategoriesTable).where(eq(channelCategoriesTable.conversationId, id))
    .orderBy(desc(channelCategoriesTable.position)).limit(1);
  const position = (maxPos?.pos ?? -1) + 1;

  const [cat] = await db.insert(channelCategoriesTable)
    .values({ conversationId: id, name: name.trim().toUpperCase(), position })
    .returning();
  res.status(201).json(serializeDates(cat));
});

// PATCH /conversations/:id/categories/:catId
router.patch("/conversations/:id/categories/:catId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const id = parseInt(req.params.id, 10);
  const catId = parseInt(req.params.catId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner" }); return; }

  const { name, position } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name.trim().toUpperCase();
  if (typeof position === "number") updates.position = position;
  if (!Object.keys(updates).length) { res.status(400).json({ error: "No updates" }); return; }

  const [updated] = await db.update(channelCategoriesTable).set(updates)
    .where(eq(channelCategoriesTable.id, catId)).returning();
  res.json(serializeDates(updated));
});

// DELETE /conversations/:id/categories/:catId
router.delete("/conversations/:id/categories/:catId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const id = parseInt(req.params.id, 10);
  const catId = parseInt(req.params.catId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner" }); return; }

  // Unlink channels from this category
  await db.update(channelsTable).set({ categoryId: null })
    .where(eq(channelsTable.categoryId, catId));
  await db.delete(channelCategoriesTable).where(eq(channelCategoriesTable.id, catId));
  res.status(204).send();
});

// === CHANNELS ===

// GET /conversations/:id/channels - list channels for a group
router.get("/conversations/:id/channels", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const channels = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.conversationId, id))
    .orderBy(asc(channelsTable.position));

  res.json(channels.map(serializeDates));
});

// POST /conversations/:id/channels - create channel
router.post("/conversations/:id/channels", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner can manage channels" }); return; }

  const { name, type, categoryId } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Channel name is required" }); return;
  }
  if (name.length > 100) { res.status(400).json({ error: "Channel name too long" }); return; }
  const channelType = type === "voice" ? "voice" : "text";

  // Verify category if provided
  let validCategoryId: number | null = null;
  if (categoryId && typeof categoryId === "number") {
    const cat = await db.query.channelCategoriesTable.findFirst({
      where: and(eq(channelCategoriesTable.id, categoryId), eq(channelCategoriesTable.conversationId, id)),
    });
    if (!cat) { res.status(400).json({ error: "Invalid category" }); return; }
    validCategoryId = cat.id;
  }

  const [maxPos] = await db
    .select({ pos: channelsTable.position })
    .from(channelsTable)
    .where(eq(channelsTable.conversationId, id))
    .orderBy(desc(channelsTable.position))
    .limit(1);

  const position = (maxPos?.pos ?? -1) + 1;

  const [channel] = await db
    .insert(channelsTable)
    .values({
      conversationId: id,
      name: name.trim().toLowerCase().replace(/\s+/g, "-"),
      type: channelType,
      position,
      categoryId: validCategoryId,
    })
    .returning();

  res.status(201).json(serializeDates(channel));
});

// PATCH /conversations/:id/channels/:channelId - update channel
router.patch("/conversations/:id/channels/:channelId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  const channelId = parseInt(req.params.channelId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner can manage channels" }); return; }

  const channel = await db.query.channelsTable.findFirst({
    where: and(eq(channelsTable.id, channelId), eq(channelsTable.conversationId, id)),
  });
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  const { name, position, categoryId } = req.body;
  const updates: Record<string, unknown> = {};
  if (name && typeof name === "string") updates.name = name.trim().toLowerCase().replace(/\s+/g, "-");
  if (typeof position === "number") updates.position = position;
  if (categoryId !== undefined) updates.categoryId = categoryId;

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No updates provided" }); return; }

  const [updated] = await db.update(channelsTable).set(updates)
    .where(eq(channelsTable.id, channelId)).returning();
  res.json(serializeDates(updated));
});

// DELETE /conversations/:id/channels/:channelId - delete channel
router.delete("/conversations/:id/channels/:channelId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  const channelId = parseInt(req.params.channelId, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }
  if (!(await isOwner(id, user.id))) { res.status(403).json({ error: "Only owner can manage channels" }); return; }

  const channel = await db.query.channelsTable.findFirst({
    where: and(eq(channelsTable.id, channelId), eq(channelsTable.conversationId, id)),
  });
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  const textChannels = await db.select().from(channelsTable)
    .where(and(eq(channelsTable.conversationId, id), eq(channelsTable.type, "text")));
  if (textChannels.length <= 1 && channel.type === "text") {
    res.status(400).json({ error: "Cannot delete the last text channel" }); return;
  }

  await db.delete(channelsTable).where(eq(channelsTable.id, channelId));
  res.status(204).send();
});

export default router;
