import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and } from "drizzle-orm";
import {
  db,
  usersTable,
  channelsTable,
  conversationsTable,
  conversationMembersTable,
  messagesTable,
  webhooksTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import { hasPermission } from "../lib/permissions";
import { dispatchBotWebhooks } from "./bots";
import crypto from "crypto";

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

// GET /api/channels/:channelId/webhooks
router.get("/channels/:channelId/webhooks", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const channelId = parseInt(req.params.channelId, 10);
  const channel = await db.query.channelsTable.findFirst({ where: eq(channelsTable.id, channelId) });
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  if (!(await isMember(channel.conversationId, user.id))) { res.status(403).json({ error: "Not a member of this conversation" }); return; }
  if (!(await isOwner(channel.conversationId, user.id)) && !(await hasPermission(channel.conversationId, user.id, "manageChannels"))) {
    res.status(403).json({ error: "Forbidden: You need manage channels permission to view webhooks" });
    return;
  }

  const whs = await db.select().from(webhooksTable).where(eq(webhooksTable.channelId, channelId));
  res.json(whs.map(serializeDates));
});

// POST /api/channels/:channelId/webhooks
router.post("/channels/:channelId/webhooks", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const channelId = parseInt(req.params.channelId, 10);
  const channel = await db.query.channelsTable.findFirst({ where: eq(channelsTable.id, channelId) });
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  if (!(await isMember(channel.conversationId, user.id))) { res.status(403).json({ error: "Not a member of this conversation" }); return; }
  if (!(await isOwner(channel.conversationId, user.id)) && !(await hasPermission(channel.conversationId, user.id, "manageChannels"))) {
    res.status(403).json({ error: "Forbidden: You need manage channels permission to create webhooks" });
    return;
  }

  const { name, avatarUrl } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Webhook name is required" }); return;
  }

  const token = `arc_wh_${crypto.randomBytes(32).toString("hex")}`;
  const [wh] = await db.insert(webhooksTable).values({
    channelId,
    name: name.trim(),
    avatarUrl: avatarUrl ? avatarUrl.trim() : null,
    token,
    creatorId: user.id,
  }).returning();

  res.status(201).json(serializeDates(wh));
});

// PATCH /api/webhooks/:id
router.patch("/webhooks/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const whId = parseInt(req.params.id, 10);
  const wh = await db.query.webhooksTable.findFirst({ where: eq(webhooksTable.id, whId) });
  if (!wh) { res.status(404).json({ error: "Webhook not found" }); return; }

  const channel = await db.query.channelsTable.findFirst({ where: eq(channelsTable.id, wh.channelId) });
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  if (!(await isMember(channel.conversationId, user.id))) { res.status(403).json({ error: "Not a member of this conversation" }); return; }
  if (!(await isOwner(channel.conversationId, user.id)) && !(await hasPermission(channel.conversationId, user.id, "manageChannels"))) {
    res.status(403).json({ error: "Forbidden: You need manage channels permission to edit webhooks" });
    return;
  }

  const { name, avatarUrl } = req.body;
  const updates: Record<string, any> = {};
  if (name && typeof name === "string" && name.trim().length > 0) {
    updates.name = name.trim();
  }
  if (avatarUrl !== undefined) {
    updates.avatarUrl = avatarUrl ? avatarUrl.trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No changes provided" }); return;
  }

  const [updatedWh] = await db.update(webhooksTable).set(updates).where(eq(webhooksTable.id, whId)).returning();
  res.json(serializeDates(updatedWh));
});

// DELETE /api/webhooks/:id
router.delete("/webhooks/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const whId = parseInt(req.params.id, 10);
  const wh = await db.query.webhooksTable.findFirst({ where: eq(webhooksTable.id, whId) });
  if (!wh) { res.status(404).json({ error: "Webhook not found" }); return; }

  const channel = await db.query.channelsTable.findFirst({ where: eq(channelsTable.id, wh.channelId) });
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  if (!(await isMember(channel.conversationId, user.id))) { res.status(403).json({ error: "Not a member of this conversation" }); return; }
  if (!(await isOwner(channel.conversationId, user.id)) && !(await hasPermission(channel.conversationId, user.id, "manageChannels"))) {
    res.status(403).json({ error: "Forbidden: You need manage channels permission to delete webhooks" });
    return;
  }

  await db.delete(webhooksTable).where(eq(webhooksTable.id, whId));
  res.status(204).send();
});

// POST /api/webhooks/:id/:token (Public webhook trigger)
router.post("/webhooks/:id/:token", async (req, res): Promise<void> => {
  const whId = parseInt(req.params.id, 10);
  const token = req.params.token;

  const wh = await db.query.webhooksTable.findFirst({
    where: and(eq(webhooksTable.id, whId), eq(webhooksTable.token, token)),
  });

  if (!wh) {
    res.status(401).json({ error: "Invalid webhook credentials" });
    return;
  }

  const channel = await db.query.channelsTable.findFirst({ where: eq(channelsTable.id, wh.channelId) });
  if (!channel) {
    res.status(404).json({ error: "Channel associated with webhook not found" });
    return;
  }

  const { content, username, avatar_url } = req.body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  const finalName = username ? username.trim() : wh.name;
  const finalAvatar = avatar_url ? avatar_url.trim() : wh.avatarUrl;

  const [msg] = await db.insert(messagesTable).values({
    conversationId: channel.conversationId,
    channelId: channel.id,
    senderId: null,
    content: content,
    webhookName: finalName,
    webhookAvatarUrl: finalAvatar,
  }).returning();

  await db.update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, channel.conversationId));

  // Trigger webhooks for other bots in the conversation
  dispatchBotWebhooks(channel.conversationId, channel.id, content, null, {
    id: 0,
    username: finalName,
    displayName: finalName,
    role: "webhook",
  }).catch((err) => console.error("[Webhook Bot Dispatch Error]:", err));

  res.status(201).json(serializeDates(msg));
});

export default router;
