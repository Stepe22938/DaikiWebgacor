import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  followsTable,
  conversationsTable,
  conversationMembersTable,
  messagesTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListConversationsResponse,
  GetConversationResponse,
  ListMessagesResponse,
  ListConversationMembersResponse,
  SendMessageBody,
  CreateOrGetDmBody,
  CreateGroupBody,
  UpdateGroupBody,
  AddConversationMemberBody,
} from "@workspace/api-zod";

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

async function buildSummary(conv: typeof conversationsTable.$inferSelect, currentUserId: number) {
  const memberRows = await db
    .select({
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(eq(conversationMembersTable.conversationId, conv.id));

  const [lastMsg] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);

  let name = conv.name ?? null;
  let iconUrl = conv.iconUrl ?? null;
  let otherUserId: number | null = null;
  let otherUsername: string | null = null;
  let otherDisplayName: string | null = null;
  let otherAvatarUrl: string | null = null;

  if (conv.type === "dm") {
    const other = memberRows.find((m) => m.userId !== currentUserId);
    if (other) {
      otherUserId = other.userId;
      otherUsername = other.username;
      otherDisplayName = other.displayName ?? null;
      otherAvatarUrl = other.avatarUrl ?? null;
      name = other.displayName ?? other.username;
      iconUrl = other.avatarUrl ?? null;
    }
  }

  return {
    id: conv.id,
    type: conv.type,
    name,
    iconUrl,
    ownerId: conv.ownerId ?? null,
    memberCount: memberRows.length,
    otherUserId,
    otherUsername,
    otherDisplayName,
    otherAvatarUrl,
    lastMessageContent: lastMsg?.content ?? null,
    lastMessageAt: lastMsg ? serializeDates(lastMsg).createdAt : null,
    lastMessageSenderId: lastMsg?.senderId ?? null,
    createdAt: serializeDates(conv).createdAt,
  };
}

router.get("/conversations", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const memberships = await db
    .select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, user.id));

  const ids = memberships.map((m) => m.conversationId);
  if (ids.length === 0) { res.json([]); return; }

  const convs = await db
    .select()
    .from(conversationsTable)
    .where(inArray(conversationsTable.id, ids))
    .orderBy(desc(conversationsTable.updatedAt));

  const summaries = await Promise.all(convs.map((c) => buildSummary(c, user.id)));
  res.json(ListConversationsResponse.parse(summaries));
});

router.post("/conversations/dm", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const parsed = CreateOrGetDmBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.targetUserId === user.id) {
    res.status(400).json({ error: "Cannot DM yourself" }); return;
  }

  const target = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, parsed.data.targetUserId),
  });
  if (!target) { res.status(404).json({ error: "Target user not found" }); return; }

  if (target.messagePrivacy === "nobody") {
    res.status(403).json({ error: "This user does not accept messages" }); return;
  }

  // Enforce mutual friendship (both users follow each other)
  const [iFollow, theyFollow] = await Promise.all([
    db.query.followsTable.findFirst({
      where: and(eq(followsTable.followerId, user.id), eq(followsTable.followingId, target.id)),
    }),
    db.query.followsTable.findFirst({
      where: and(eq(followsTable.followerId, target.id), eq(followsTable.followingId, user.id)),
    }),
  ]);
  if (!iFollow || !theyFollow) {
    res.status(403).json({ error: "You can only start a DM with mutual friends (users who follow each other)" }); return;
  }

  const myDmIds = await db
    .select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable)
    .innerJoin(
      conversationsTable,
      and(
        eq(conversationMembersTable.conversationId, conversationsTable.id),
        eq(conversationsTable.type, "dm"),
      ),
    )
    .where(eq(conversationMembersTable.userId, user.id));

  for (const { conversationId } of myDmIds) {
    const other = await db.query.conversationMembersTable.findFirst({
      where: and(
        eq(conversationMembersTable.conversationId, conversationId),
        eq(conversationMembersTable.userId, target.id),
      ),
    });
    if (other) {
      const conv = await db.query.conversationsTable.findFirst({
        where: eq(conversationsTable.id, conversationId),
      });
      if (conv) {
        const summary = await buildSummary(conv, user.id);
        res.json(summary);
        return;
      }
    }
  }

  const [conv] = await db.insert(conversationsTable).values({ type: "dm" }).returning();
  await db.insert(conversationMembersTable).values([
    { conversationId: conv.id, userId: user.id },
    { conversationId: conv.id, userId: target.id },
  ]);

  const summary = await buildSummary(conv, user.id);
  res.status(201).json(summary);
});

router.post("/conversations", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const memberIdsOnly = [...new Set(parsed.data.memberIds)].filter((id) => id !== user.id);
  for (const memberId of memberIdsOnly) {
    const [iFollow, theyFollow] = await Promise.all([
      db.query.followsTable.findFirst({
        where: and(eq(followsTable.followerId, user.id), eq(followsTable.followingId, memberId)),
      }),
      db.query.followsTable.findFirst({
        where: and(eq(followsTable.followerId, memberId), eq(followsTable.followingId, user.id)),
      }),
    ]);
    if (!iFollow || !theyFollow) {
      res.status(403).json({ error: "You can only add mutual friends (users who follow each other) to groups" });
      return;
    }
  }

  const [conv] = await db
    .insert(conversationsTable)
    .values({ type: "group", name: parsed.data.name, ownerId: user.id })
    .returning();

  const memberIds = [...new Set([user.id, ...parsed.data.memberIds])];
  await db.insert(conversationMembersTable).values(
    memberIds.map((uid) => ({ conversationId: conv.id, userId: uid })),
  );

  const summary = await buildSummary(conv, user.id);
  res.status(201).json(summary);
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  res.json(GetConversationResponse.parse(await buildSummary(conv, user.id)));
});

router.patch("/conversations/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  if (conv.ownerId !== user.id) { res.status(403).json({ error: "Not the group owner" }); return; }

  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(conversationsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(conversationsTable.id, id))
    .returning();

  res.json(await buildSummary(updated, user.id));
});

router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  if (conv.type === "group" && conv.ownerId !== user.id && !(await isMember(id, user.id))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }
  if (conv.type === "dm" && !(await isMember(id, user.id))) {
    res.status(403).json({ error: "Not a member" }); return;
  }

  if (conv.type === "group" && conv.ownerId === user.id) {
    await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
  } else {
    await db
      .delete(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, id),
          eq(conversationMembersTable.userId, user.id),
        ),
      );
  }

  res.status(204).send();
});

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const rows = await db
    .select({
      id: messagesTable.id,
      conversationId: messagesTable.conversationId,
      senderId: messagesTable.senderId,
      content: messagesTable.content,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: usersTable.username,
      senderDisplayName: usersTable.displayName,
      senderAvatarUrl: usersTable.avatarUrl,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt)
    .limit(50);

  res.json(ListMessagesResponse.parse(rows.map((r) => serializeDates(r))));
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [msg] = await db
    .insert(messagesTable)
    .values({ conversationId: id, senderId: user.id, content: parsed.data.content })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, id));

  res.status(201).json({
    ...serializeDates(msg),
    senderUsername: user.username,
    senderDisplayName: user.displayName ?? null,
    senderAvatarUrl: user.avatarUrl ?? null,
  });
});

router.delete("/conversations/:id/messages/:messageId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const messageId = parseInt(req.params.messageId as string, 10);

  const msg = await db.query.messagesTable.findFirst({
    where: and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, id)),
  });
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  if (msg.senderId !== user.id) { res.status(403).json({ error: "Not the message author" }); return; }

  await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  res.status(204).send();
});

router.get("/conversations/:id/members", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const rows = await db
    .select({
      userId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      joinedAt: conversationMembersTable.joinedAt,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(eq(conversationMembersTable.conversationId, id));

  res.json(ListConversationMembersResponse.parse(rows.map((r) => serializeDates(r))));
});

router.post("/conversations/:id/members", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv || conv.type !== "group") { res.status(404).json({ error: "Group not found" }); return; }
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const parsed = AddConversationMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const newUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, parsed.data.userId),
  });
  if (!newUser) { res.status(404).json({ error: "User not found" }); return; }

  const [iFollow, theyFollow] = await Promise.all([
    db.query.followsTable.findFirst({
      where: and(eq(followsTable.followerId, user.id), eq(followsTable.followingId, newUser.id)),
    }),
    db.query.followsTable.findFirst({
      where: and(eq(followsTable.followerId, newUser.id), eq(followsTable.followingId, user.id)),
    }),
  ]);
  if (!iFollow || !theyFollow) {
    res.status(403).json({ error: "You can only add mutual friends (users who follow each other) to groups" });
    return;
  }

  await db
    .insert(conversationMembersTable)
    .values({ conversationId: id, userId: parsed.data.userId })
    .onConflictDoNothing();

  res.status(201).json({
    userId: newUser.id,
    username: newUser.username,
    displayName: newUser.displayName ?? null,
    avatarUrl: newUser.avatarUrl ?? null,
    joinedAt: new Date().toISOString(),
  });
});

router.delete("/conversations/:id/members/:userId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const targetUserId = parseInt(req.params.userId as string, 10);

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  if (targetUserId !== user.id && conv.ownerId !== user.id) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  await db
    .delete(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, id),
        eq(conversationMembersTable.userId, targetUserId),
      ),
    );

  res.status(204).send();
});

export default router;
