import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { db, usersTable, botsTable, botConversationsTable, conversationsTable, conversationMembersTable, messagesTable, cosmeticsTable, userCosmeticsTable, channelsTable, channelCategoriesTable } from "@workspace/db";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { serializeDates } from "../lib/serialize";
import { hasPermission } from "../lib/permissions";
import crypto from "crypto";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

async function generateBotUserTag(name: string) {
  const base = name.trim().replace(/\s+/g, " ").toLowerCase();
  const rows = await db
    .select({ userTag: usersTable.userTag })
    .from(usersTable)
    .where(sql`lower(regexp_replace(trim(coalesce(nullif(${usersTable.displayName}, ''), ${usersTable.username})), '\\s+', ' ', 'g')) = ${base}`);

  const highest = rows.reduce((max, row) => {
    const parsed = Number.parseInt(row.userTag.replace("#", ""), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return `#${String(highest + 1).padStart(3, "0")}`;
}

// Helper to check and mark expired heartbeats as offline
async function cleanupOfflineBots() {
  const cutoff = new Date(Date.now() - 30000); // 30 seconds timeout
  await db
    .update(botsTable)
    .set({ status: "offline" })
    .where(
      and(
        eq(botsTable.status, "online"),
        sql`${botsTable.lastHeartbeat} < ${cutoff}`
      )
    );
}

// Helper to notify other bots via webhook when a message is sent
export async function dispatchBotWebhooks(
  conversationId: number,
  channelId: number | null,
  messageContent: string,
  imageUrl: string | null,
  sender: { id: number; username: string; displayName: string | null; role: string }
) {
  await cleanupOfflineBots();

  const activeBots = await db
    .select({
      id: botsTable.id,
      name: botsTable.name,
      webhookUrl: botsTable.webhookUrl,
      status: botsTable.status,
      userId: botsTable.userId,
    })
    .from(botConversationsTable)
    .innerJoin(botsTable, eq(botConversationsTable.botId, botsTable.id))
    .where(eq(botConversationsTable.conversationId, conversationId));

  for (const bot of activeBots) {
    // Prevent sending message back to the sending bot
    if (bot.userId === sender.id) continue;

    if (bot.status === "online" && bot.webhookUrl) {
      fetch(bot.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "MESSAGE_CREATE",
          bot: { id: bot.id, name: bot.name },
          message: {
            conversationId,
            channelId,
            content: messageContent,
            imageUrl,
            sender: {
              id: sender.id,
              username: sender.username,
              displayName: sender.displayName,
              role: sender.role,
            },
          },
        }),
      }).catch((err) => {
        console.error(`[Bot Webhook] Failed sending to bot ${bot.name} at ${bot.webhookUrl}:`, err);
      });
    }
  }
}

// GET /api/bots/active - list active bots grouped by category
router.get("/bots/active", async (req, res): Promise<void> => {
  await cleanupOfflineBots();

  const bots = await db
    .select({
      id: botsTable.id,
      name: botsTable.name,
      category: botsTable.category,
      status: botsTable.status,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(botsTable)
    .innerJoin(usersTable, eq(botsTable.userId, usersTable.id))
    .where(eq(botsTable.status, "online"));

  res.json(bots);
});

// GET /api/bots - list all bots owned by user
router.get("/bots", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await cleanupOfflineBots();

  const bots = await db
    .select({
      id: botsTable.id,
      name: botsTable.name,
      token: botsTable.token,
      status: botsTable.status,
      category: botsTable.category,
      webhookUrl: botsTable.webhookUrl,
      userId: botsTable.userId,
      lastHeartbeat: botsTable.lastHeartbeat,
      createdAt: botsTable.createdAt,
    })
    .from(botsTable)
    .where(eq(botsTable.ownerId, user.id))
    .orderBy(desc(botsTable.createdAt));

  res.json(bots.map(serializeDates));
});

// GET /api/bots/system - list all bots for group invites
router.get("/bots/system", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  await cleanupOfflineBots();

  const bots = await db
    .select({
      id: botsTable.id,
      name: botsTable.name,
      status: botsTable.status,
      category: botsTable.category,
      avatarUrl: usersTable.avatarUrl,
      userId: botsTable.userId,
    })
    .from(botsTable)
    .innerJoin(usersTable, eq(botsTable.userId, usersTable.id))
    .orderBy(botsTable.name);

  res.json(bots);
});

// GET /api/bots/my-invitable-groups - list all groups where the user can invite bots
router.get("/bots/my-invitable-groups", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Find all group conversations the user is a member of
  const memberships = await db
    .select({
      id: conversationsTable.id,
      name: conversationsTable.name,
      ownerId: conversationsTable.ownerId,
    })
    .from(conversationMembersTable)
    .innerJoin(conversationsTable, eq(conversationMembersTable.conversationId, conversationsTable.id))
    .where(
      and(
        eq(conversationMembersTable.userId, user.id),
        eq(conversationsTable.type, "group")
      )
    );

  const invitableGroups = [];

  for (const group of memberships) {
    const isOwner = group.ownerId === user.id;
    const hasInvitePerm = isOwner || (await hasPermission(group.id, user.id, "inviteBot"));
    if (hasInvitePerm) {
      invitableGroups.push({
        id: group.id,
        name: group.name || `Group #${group.id}`,
      });
    }
  }

  res.json(invitableGroups);
});

// POST /api/bots - register a new bot
router.post("/bots", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { name, category } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Bot name is required" }); return;
  }

  const botName = name.trim();
  const botCategory = category || "General";
  
  // 1. Generate Token
  const token = `arc_bot_${crypto.randomBytes(24).toString("hex")}`;
  
  // 2. Create User Account for the Bot
  const botClerkId = `bot_${crypto.randomUUID()}`;
  const botUsername = `bot_${botName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15)}_${crypto.randomBytes(3).toString("hex")}`;
  const botUserTag = await generateBotUserTag(botName);
  
  const [botUser] = await db
    .insert(usersTable)
    .values({
      clerkId: botClerkId,
      username: botUsername,
      userTag: botUserTag,
      displayName: botName,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(botName)}`,
      role: "bot" as any, // Assign 'bot' role
      messagePrivacy: "everyone",
    })
    .returning();

  // 3. Create Bot Entry
  const [bot] = await db
    .insert(botsTable)
    .values({
      name: botName,
      token,
      category: botCategory,
      ownerId: user.id,
      userId: botUser.id,
    })
    .returning();

  res.status(201).json(serializeDates(bot));
});

// PATCH /api/bots/:id - edit bot config
router.patch("/bots/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const botId = parseInt(req.params.id, 10);
  const bot = await db.query.botsTable.findFirst({
    where: and(eq(botsTable.id, botId), eq(botsTable.ownerId, user.id)),
  });

  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  const { name, category, webhookUrl } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };

  if (name && typeof name === "string" && name.trim().length > 0) {
    updates.name = name.trim();
    // Sync displayName in usersTable
    await db
      .update(usersTable)
      .set({ displayName: name.trim(), avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`, updatedAt: new Date() })
      .where(eq(usersTable.id, bot.userId));
  }
  if (category && typeof category === "string") {
    updates.category = category;
  }
  if (webhookUrl !== undefined) {
    updates.webhookUrl = webhookUrl === "" ? null : webhookUrl;
  }

  const [updatedBot] = await db
    .update(botsTable)
    .set(updates)
    .where(eq(botsTable.id, botId))
    .returning();

  res.json(serializeDates(updatedBot));
});

// DELETE /api/bots/:id - delete a bot
router.delete("/bots/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const botId = parseInt(req.params.id, 10);
  const bot = await db.query.botsTable.findFirst({
    where: and(eq(botsTable.id, botId), eq(botsTable.ownerId, user.id)),
  });

  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  // Delete associated user record (cascade handles tables referencing user)
  await db.delete(usersTable).where(eq(usersTable.id, bot.userId));
  // Cascade delete in schema will handle bot table removal

  res.status(204).send();
});

// POST /api/bots/connect - heartbeat connection endpoint
router.post("/bots/connect", async (req, res): Promise<void> => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ error: "Token is required" }); return; }

  const bot = await db.query.botsTable.findFirst({
    where: eq(botsTable.token, token),
  });

  if (!bot) { res.status(401).json({ error: "Invalid bot token" }); return; }

  const [updatedBot] = await db
    .update(botsTable)
    .set({
      status: "online",
      lastHeartbeat: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(botsTable.id, bot.id))
    .returning();

  res.json({
    id: updatedBot.id,
    name: updatedBot.name,
    category: updatedBot.category,
    status: updatedBot.status,
  });
});

// === GROUP INVITATIONS ===

// GET /api/conversations/:id/bots - list bots invited to this group
router.get("/conversations/:id/bots", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const convId = parseInt(req.params.id, 10);
  
  // Verify user is member of conversation
  const member = await db.query.conversationMembersTable.findFirst({
    where: and(eq(conversationMembersTable.conversationId, convId), eq(conversationMembersTable.userId, user.id)),
  });
  if (!member) { res.status(403).json({ error: "Not a member" }); return; }

  const bots = await db
    .select({
      id: botsTable.id,
      name: botsTable.name,
      category: botsTable.category,
      status: botsTable.status,
      avatarUrl: usersTable.avatarUrl,
      userId: botsTable.userId,
    })
    .from(botConversationsTable)
    .innerJoin(botsTable, eq(botConversationsTable.botId, botsTable.id))
    .innerJoin(usersTable, eq(botsTable.userId, usersTable.id))
    .where(eq(botConversationsTable.conversationId, convId));

  res.json(bots);
});

// POST /api/conversations/:id/bots - invite bot to group
router.post("/conversations/:id/bots", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const convId = parseInt(req.params.id, 10);
  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, convId),
  });

  if (!conv || conv.type !== "group") { res.status(404).json({ error: "Group not found" }); return; }

  // Verify permission
  const isGroupOwner = conv.ownerId === user.id;
  const hasInvitePerm = isGroupOwner || (await hasPermission(convId, user.id, "inviteBot"));
  if (!hasInvitePerm) {
    res.status(403).json({ error: "You don't have permission to invite bots" });
    return;
  }

  const { botId } = req.body;
  if (!botId) { res.status(400).json({ error: "Bot ID is required" }); return; }

  const bot = await db.query.botsTable.findFirst({ where: eq(botsTable.id, botId) });
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  // Add bot membership
  await db
    .insert(botConversationsTable)
    .values({ botId: bot.id, conversationId: convId })
    .onConflictDoNothing();

  // Add bot to conversation members
  await db
    .insert(conversationMembersTable)
    .values({ conversationId: convId, userId: bot.userId })
    .onConflictDoNothing();

  // Create system join message
  await db.insert(messagesTable).values({
    conversationId: convId,
    content: `🤖 **${bot.name}** has been invited to the group!`,
  });

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  res.status(201).json({ success: true });
});

// DELETE /api/conversations/:id/bots/:botId - kick bot from group
router.delete("/conversations/:id/bots/:botId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const convId = parseInt(req.params.id, 10);
  const botId = parseInt(req.params.botId, 10);

  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, convId),
  });
  if (!conv) { res.status(404).json({ error: "Group not found" }); return; }

  // Verify permission (kick permission or is owner)
  const isGroupOwner = conv.ownerId === user.id;
  const hasKickPerm = isGroupOwner || (await hasPermission(convId, user.id, "kickMembers"));
  if (!hasKickPerm) {
    res.status(403).json({ error: "You don't have permission to kick bots" });
    return;
  }

  const bot = await db.query.botsTable.findFirst({ where: eq(botsTable.id, botId) });
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  await db
    .delete(botConversationsTable)
    .where(and(eq(botConversationsTable.botId, botId), eq(botConversationsTable.conversationId, convId)));

  await db
    .delete(conversationMembersTable)
    .where(and(eq(conversationMembersTable.conversationId, convId), eq(conversationMembersTable.userId, bot.userId)));

  // Send system message
  await db.insert(messagesTable).values({
    conversationId: convId,
    content: `🤖 **${bot.name}** has left the group.`,
  });

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  res.status(204).send();
});

// === DISCORD COMPATIBILITY ENDPOINTS ===

// GET /api/v10/gateway/bot
router.get("/v10/gateway/bot", (req, res) => {
  res.json({
    url: `ws://${req.get("host") || "localhost:5000"}/api/v10/gateway`,
    shards: 1,
    session_start_limit: {
      total: 1000,
      remaining: 999,
      reset_after: 86400000,
      max_concurrency: 1,
    },
  });
});

// GET /api/v10/gateway
router.get("/v10/gateway", (req, res) => {
  res.json({
    url: `ws://${req.get("host") || "localhost:5000"}/api/v10/gateway`,
  });
});

// POST /api/v10/channels/:channelId/messages - Discord send message compatibility
router.post("/v10/channels/:channelId/messages", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bot ")) {
    res.status(401).json({ error: "Invalid bot authorization header" });
    return;
  }
  const token = authHeader.replace("Bot ", "").trim();

  // Find bot by token
  const bot = await db.query.botsTable.findFirst({ where: eq(botsTable.token, token) });
  if (!bot) { res.status(401).json({ error: "Invalid token" }); return; }

  // Update heartbeat status
  await db
    .update(botsTable)
    .set({ status: "online", lastHeartbeat: new Date(), updatedAt: new Date() })
    .where(eq(botsTable.id, bot.id));

  const rawChannelId = req.params.channelId;
  const channelId = parseInt(rawChannelId, 10);
  if (isNaN(channelId)) { res.status(400).json({ error: "Invalid channel ID" }); return; }

  const { content, embeds } = req.body;
  
  // Find conversation associated with this channel/id
  // First check if it's a channel in channelsTable
  const channel = await db.query.channelsTable.findFirst({ where: eq(channelsTable.id, channelId) });
  let conversationId = channelId;
  let actualChannelId: number | null = null;

  if (channel) {
    conversationId = channel.conversationId;
    actualChannelId = channel.id;
  } else {
    // Check if it's a conversation direct DM/Group ID
    const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, channelId) });
    if (!conv) {
      res.status(404).json({ error: "Channel or Conversation not found" });
      return;
    }
    conversationId = conv.id;
  }

  // Verify the bot is a member of the conversation
  const isJoined = await db.query.conversationMembersTable.findFirst({
    where: and(eq(conversationMembersTable.conversationId, conversationId), eq(conversationMembersTable.userId, bot.userId)),
  });

  if (!isJoined) {
    res.status(403).json({ error: "Bot is not invited to this conversation" });
    return;
  }

  // Format the text
  let finalContent = content || "";
  if (embeds && Array.isArray(embeds) && embeds.length > 0) {
    for (const embed of embeds) {
      let embedText = "";
      if (embed.title) embedText += `**${embed.title}**\n`;
      if (embed.description) embedText += `${embed.description}\n`;
      if (embed.fields && Array.isArray(embed.fields)) {
        for (const f of embed.fields) {
          embedText += `> **${f.name}**: ${f.value}\n`;
        }
      }
      if (embedText) {
        finalContent += (finalContent ? "\n" : "") + embedText;
      }
    }
  }

  if (!finalContent.trim()) {
    res.status(400).json({ error: "Cannot send empty message" });
    return;
  }

  // Insert message into DB
  const [msg] = await db
    .insert(messagesTable)
    .values({
      conversationId,
      channelId: actualChannelId,
      senderId: bot.userId,
      content: finalContent,
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversationId));

  const botUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, bot.userId) });

  // Webhook notify other bots
  dispatchBotWebhooks(conversationId, actualChannelId, finalContent, null, {
    id: bot.userId,
    username: botUser?.username || bot.name,
    displayName: botUser?.displayName || bot.name,
    role: "bot",
  }).catch((err) => console.error("[Discord Compat Webhook Dispatch error]:", err));

  // Respond with a Discord-like message response
  res.status(200).json({
    id: String(msg.id),
    channel_id: String(channelId),
    content: finalContent,
    timestamp: msg.createdAt.toISOString(),
    author: {
      id: String(bot.id),
      username: bot.name,
      bot: true,
    },
  });
});

// === TELEGRAM COMPATIBILITY ENDPOINTS ===

// POST /api/bot/telegram/bot:token/sendMessage
router.post("/bot/telegram/bot:token/sendMessage", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!token) { res.status(400).json({ error: "Token is required" }); return; }

  const bot = await db.query.botsTable.findFirst({ where: eq(botsTable.token, token) });
  if (!bot) { res.status(401).json({ error: "Invalid bot token" }); return; }

  // Update heartbeat status
  await db
    .update(botsTable)
    .set({ status: "online", lastHeartbeat: new Date(), updatedAt: new Date() })
    .where(eq(botsTable.id, bot.id));

  const { chat_id, text } = req.body;
  const conversationId = parseInt(chat_id, 10);

  if (isNaN(conversationId)) {
    res.status(400).json({ error: "Invalid chat_id" });
    return;
  }

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, conversationId) });
  if (!conv) { res.status(404).json({ error: "Chat conversation not found" }); return; }

  // Verify membership
  const isJoined = await db.query.conversationMembersTable.findFirst({
    where: and(eq(conversationMembersTable.conversationId, conversationId), eq(conversationMembersTable.userId, bot.userId)),
  });

  if (!isJoined) {
    res.status(403).json({ error: "Bot is not invited to this chat group" });
    return;
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Text is required" });
    return;
  }

  // Insert message into DB
  const [msg] = await db
    .insert(messagesTable)
    .values({
      conversationId,
      senderId: bot.userId,
      content: text,
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversationId));

  const botUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, bot.userId) });

  // Webhook notify other bots
  dispatchBotWebhooks(conversationId, null, text, null, {
    id: bot.userId,
    username: botUser?.username || bot.name,
    displayName: botUser?.displayName || bot.name,
    role: "bot",
  }).catch((err) => console.error("[Telegram Compat Webhook Dispatch error]:", err));

  res.status(200).json({
    ok: true,
    result: {
      message_id: msg.id,
      chat: {
        id: conversationId,
        type: conv.type === "group" ? "group" : "private",
        title: conv.name ?? bot.name,
      },
      date: Math.floor(msg.createdAt.getTime() / 1000),
      text: text,
    },
  });
});

export default router;
