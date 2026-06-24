import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and } from "drizzle-orm";
import { db, usersTable, userBlocksTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/me/blocks", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  const blocks = await db
    .select({
      id: userBlocksTable.id,
      blockedId: userBlocksTable.blockedId,
      blockedAt: userBlocksTable.blockedAt,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      userTag: usersTable.userTag,
    })
    .from(userBlocksTable)
    .innerJoin(usersTable, eq(userBlocksTable.blockedId, usersTable.id))
    .where(eq(userBlocksTable.blockerId, me.id));

  res.json(blocks.map(b => ({
    ...serializeDates(b),
    userId: b.blockedId,
  })));
});

router.post("/blocks/:userId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  const targetId = parseInt(req.params.userId as string, 10);
  if (targetId === me.id) { res.status(400).json({ error: "Cannot block yourself" }); return; }

  const target = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetId) });
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(userBlocksTable)
    .values({ blockerId: me.id, blockedId: targetId })
    .onConflictDoNothing();

  res.status(201).json({ success: true });
});

router.delete("/blocks/:userId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const me = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!me) { res.status(404).json({ error: "User not found" }); return; }

  const targetId = parseInt(req.params.userId as string, 10);

  await db.delete(userBlocksTable)
    .where(and(eq(userBlocksTable.blockerId, me.id), eq(userBlocksTable.blockedId, targetId)));

  res.json({ success: true });
});

export default router;
