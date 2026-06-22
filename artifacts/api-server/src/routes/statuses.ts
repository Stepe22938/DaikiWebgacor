import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, gt, and, desc, inArray } from "drizzle-orm";
import { db, usersTable, statusesTable, followsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

// Helper to get user by Clerk auth
async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

// POST: Create a new status
router.post("/statuses", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getDbUser(auth.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { type, mediaUrl, caption, backgroundColor, textColor } = req.body;

  if (!type || (type !== "image" && type !== "text")) {
    res.status(400).json({ error: "Invalid status type (must be image or text)" });
    return;
  }

  if (type === "image" && !mediaUrl) {
    res.status(400).json({ error: "Media URL is required for image status" });
    return;
  }

  if (type === "text" && !caption) {
    res.status(400).json({ error: "Caption/text content is required for text status" });
    return;
  }

  try {
    // Expires in exactly 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [newStatus] = await db.insert(statusesTable).values({
      userId: user.id,
      type,
      mediaUrl: mediaUrl || null,
      caption: caption || null,
      backgroundColor: backgroundColor || null,
      textColor: textColor || null,
      expiresAt,
    }).returning();

    res.status(201).json(serializeDates(newStatus));
  } catch (err) {
    console.error("Failed to create status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Fetch active statuses grouped by user, prioritized by follow/self
router.get("/statuses", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getDbUser(auth.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    const now = new Date();

    // Query active statuses and join user details
    const activeStatuses = await db
      .select({
        status: statusesTable,
        user: {
          id: usersTable.id,
          username: usersTable.username,
          displayName: usersTable.displayName,
          avatarUrl: usersTable.avatarUrl,
          userTag: usersTable.userTag,
        },
      })
      .from(statusesTable)
      .innerJoin(usersTable, eq(statusesTable.userId, usersTable.id))
      .where(gt(statusesTable.expiresAt, now))
      .orderBy(desc(statusesTable.createdAt));

    console.log("[STATUS DEBUG] now:", now);
    console.log("[STATUS DEBUG] activeStatuses length:", activeStatuses.length);
    if (activeStatuses.length > 0) {
      console.log("[STATUS DEBUG] first active status:", activeStatuses[0]);
    }

    // Group by user
    const grouped: Record<number, {
      userId: number;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      userTag: string;
      statuses: Array<{
        id: number;
        type: string;
        mediaUrl: string | null;
        caption: string | null;
        backgroundColor: string | null;
        textColor: string | null;
        createdAt: string;
        expiresAt: string;
      }>;
    }> = {};

    for (const row of activeStatuses) {
      const u = row.user;
      const s = serializeDates(row.status) as any;
      
      if (!grouped[u.id]) {
        grouped[u.id] = {
          userId: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          userTag: u.userTag,
          statuses: [],
        };
      }
      grouped[u.id].statuses.push({
        id: s.id,
        type: s.type,
        mediaUrl: s.mediaUrl,
        caption: s.caption,
        backgroundColor: s.backgroundColor,
        textColor: s.textColor,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      });
    }

    // Get followed users to prioritize them
    const followed = await db
      .select({ id: followsTable.followingId })
      .from(followsTable)
      .where(eq(followsTable.followerId, user.id));
    const followedIds = new Set(followed.map((f) => f.id));

    // Sort: current user first, then followed users, then others
    const sortedList = Object.values(grouped).sort((a, b) => {
      if (a.userId === user.id) return -1;
      if (b.userId === user.id) return 1;

      const aFollowed = followedIds.has(a.userId);
      const bFollowed = followedIds.has(b.userId);
      if (aFollowed && !bFollowed) return -1;
      if (!aFollowed && bFollowed) return 1;

      return 0;
    });

    res.json(sortedList);
  } catch (err) {
    console.error("Failed to fetch statuses:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE: Delete a status
router.delete("/statuses/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getDbUser(auth.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const statusId = parseInt(req.params.id, 10);
  if (isNaN(statusId)) {
    res.status(400).json({ error: "Invalid status ID" });
    return;
  }

  try {
    const status = await db.query.statusesTable.findFirst({
      where: eq(statusesTable.id, statusId),
    });

    if (!status) {
      res.status(404).json({ error: "Status not found" });
      return;
    }

    if (status.userId !== user.id) {
      res.status(403).json({ error: "You are not authorized to delete this status" });
      return;
    }

    await db.delete(statusesTable).where(eq(statusesTable.id, statusId));

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
