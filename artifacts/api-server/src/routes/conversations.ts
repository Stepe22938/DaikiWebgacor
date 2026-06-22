import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, inArray, desc, asc, isNull, sql, ne } from "drizzle-orm";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  db,
  usersTable,
  followsTable,
  conversationsTable,
  conversationMembersTable,
  messageHiddenForUsersTable,
  messagesTable,
  userCosmeticsTable,
  cosmeticsTable,
  aiKnowledgeTable,
  channelsTable,
  channelCategoriesTable,
  rolesTable,
  memberRolesTable,
  starredMessagesTable,
  messageReactionsTable,
  stickersTable,
} from "@workspace/db";
import { deleteStickerResources } from "./stickers";
import { getGroupBoostState } from "../lib/tierBoosts";
import { serializeDates } from "../lib/serialize";
import { hasPermission } from "../lib/permissions";
import { createAiChatCompletion, type AiChatMessage } from "../lib/aiProvider";
import { generateFluxImage, isImageGenerationRequest, shouldAutoGenerateImageInAiDm } from "../lib/fluxImage";
import { dispatchBotWebhooks } from "./bots";
import { runAutomod, buildAutomodSystemMessage } from "../lib/automod";
import { jitsiBot, buildJitsiRoomName, slugify } from "../lib/jitsiBot";
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
  ListPinnedMessagesResponse,
  PinMessageResponse,
  UnpinMessageResponse,
  ReactMessageBody,
  ListStarredMessagesResponse,
  GenerateInviteCodeBody,
  GenerateInviteCodeResponse,
  GetInviteDetailsResponse,
  JoinGroupByInviteCodeResponse,
  AdminUpdateConversationBody,
  AdminUpdateConversationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

async function ensureZaidanAiUser() {
  // Check for existing AI user (backward compat: old usernames "metaai", "akira" → "zaidanai")
  let user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, "clerk_meta_ai") });
  if (!user) {
    [user] = await db.insert(usersTable).values({
      clerkId: "clerk_meta_ai",
      username: "zaidanai",
      userTag: "#000",
      displayName: "Zaidan AI",
      avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128",
      role: "ai" as any,
      messagePrivacy: "everyone",
    }).returning();
  } else if (user.username === "metaai" || user.username === "akira" || user.displayName === "Meta AI" || user.displayName === "Akira") {
    // Migrate old AI user to Zaidan AI identity
    [user] = await db.update(usersTable)
      .set({ username: "zaidanai", displayName: "Zaidan AI" })
      .where(eq(usersTable.id, user.id))
      .returning();
  }
  return user;
}

function parseAiKickCommand(content: string) {
  const normalized = content.toLowerCase();
  if (!/\b(kick|keluarin|tendang|remove)\b/.test(normalized)) return null;

  const commandIndex = normalized.search(/\b(kick|keluarin|tendang|remove)\b/);
  const afterCommand = commandIndex >= 0 ? content.slice(commandIndex) : content;
  const mentions = [...afterCommand.matchAll(/@([a-zA-Z0-9_][a-zA-Z0-9_.-]{1,60})(#[0-9]{3})?/g)]
    .filter((match) => !["zaidanai", "ai", "akira", "metaai"].includes(match[1].toLowerCase()));
  const mention = mentions[mentions.length - 1];
  if (mention) {
    const compactTag = mention[1].match(/^(.+?)([0-9]{3})$/);
    return {
      name: (compactTag?.[1] ?? mention[1]).toLowerCase(),
      tag: mention[2]?.toUpperCase() ?? (compactTag ? `#${compactTag[2]}` : null),
    };
  }

  const commandMatch = afterCommand.match(/\b(?:kick|keluarin|tendang|remove)\s+(?:si\s+)?@?([a-zA-Z0-9_][a-zA-Z0-9_.-]{1,60})(#[0-9]{3})?/i);
  if (!commandMatch) return null;
  const compactTag = commandMatch[1].match(/^(.+?)([0-9]{3})$/);
  return {
    name: (compactTag?.[1] ?? commandMatch[1]).toLowerCase(),
    tag: commandMatch[2]?.toUpperCase() ?? (compactTag ? `#${compactTag[2]}` : null),
  };
}

type AiMemberTarget = {
  name: string;
  tag: string | null;
};

function extractAiMentionTarget(content: string, commandPattern: RegExp): AiMemberTarget | null {
  const normalized = content.toLowerCase();
  const commandIndex = normalized.search(commandPattern);
  const afterCommand = commandIndex >= 0 ? content.slice(commandIndex) : content;
  const mentions = [...afterCommand.matchAll(/@([a-zA-Z0-9_][a-zA-Z0-9_.-]{1,60})(#[0-9]{3})?/g)]
    .filter((match) => !["zaidanai", "ai", "akira", "metaai"].includes(match[1].toLowerCase()));
  const mention = mentions[mentions.length - 1];
  if (!mention) return null;

  const compactTag = mention[1].match(/^(.+?)([0-9]{3})$/);
  return {
    name: (compactTag?.[1] ?? mention[1]).toLowerCase(),
    tag: mention[2]?.toUpperCase() ?? (compactTag ? `#${compactTag[2]}` : null),
  };
}

function cleanAiRoleName(value: string | undefined) {
  return (value ?? "")
    .replace(/@\S+/g, "")
    .replace(/\b(di|ke|buat|untuk|aja|yak|ya|dong|cok|jir|jier|lah)\b.*$/i, "")
    .replace(/[.,!?]+$/g, "")
    .trim()
    .slice(0, 50);
}

function parseAiSetRoleCommand(content: string) {
  const normalized = content.toLowerCase();
  const hasRoleIntent = /\b(set|kasih|beri|assign|jadiin|jadikan|ubah|ganti)\b/.test(normalized) && /\b(role|rolenya|jabatan|rank|staff|admin|mod)\b/.test(normalized);
  if (!hasRoleIntent) return null;

  const target = extractAiMentionTarget(content, /\b(set|kasih|beri|assign|jadiin|jadikan|ubah|ganti)\b/);
  if (!target) return null;

  const rolePatterns = [
    /\brolenya\s+([a-zA-Z0-9 _-]{1,50})/i,
    /\brole\s+(?:nya\s+)?([a-zA-Z0-9 _-]{1,50})/i,
    /\bjadi(?:in|kan)?\s+(?:role\s+|rolenya\s+)?([a-zA-Z0-9 _-]{1,50})/i,
    /\b(?:kasih|beri|assign)\s+(?:role\s+)?([a-zA-Z0-9 _-]{1,50})\s+(?:ke|buat|untuk)/i,
  ];

  for (const pattern of rolePatterns) {
    const match = content.match(pattern);
    const roleName = cleanAiRoleName(match?.[1]);
    if (roleName) return { target, roleName };
  }

  return null;
}

function normalizeMemberName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function canManageMessages(conversationId: number, userId: number) {
  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, conversationId) });
  if (!conv) return false;
  if (conv.ownerId === userId) return true;
  return hasPermission(conversationId, userId, "manageMessages");
}

async function findConversationMemberTarget(conversationId: number, target: AiMemberTarget) {
  const rows = await db
    .select({
      memberId: conversationMembersTable.id,
      userId: usersTable.id,
      username: usersTable.username,
      userTag: usersTable.userTag,
      displayName: usersTable.displayName,
      joinedAt: conversationMembersTable.joinedAt,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(eq(conversationMembersTable.conversationId, conversationId))
    .orderBy(asc(conversationMembersTable.joinedAt), asc(conversationMembersTable.id));

  const nameCounts = new Map<string, number>();
  const possibleMembers = rows.map((member) => {
    const key = normalizeMemberName(member.username);
    const next = (nameCounts.get(key) ?? 0) + 1;
    nameCounts.set(key, next);
    return {
      ...member,
      mentionTag: `#${String(next).padStart(3, "0")}`,
    };
  });

  return possibleMembers.filter((member) => {
    const nameMatches =
      normalizeMemberName(member.username) === target.name ||
      normalizeMemberName(member.displayName) === target.name;
    const tagMatches = !target.tag || member.userTag.toUpperCase() === target.tag || member.mentionTag === target.tag;
    return nameMatches && tagMatches;
  });
}

async function findGlobalUserTarget(target: AiMemberTarget) {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      userTag: usersTable.userTag,
      displayName: usersTable.displayName,
    })
    .from(usersTable);

  return users.find((user) => {
    const nameMatches =
      normalizeMemberName(user.username) === target.name ||
      normalizeMemberName(user.displayName) === target.name;
    const tagMatches = !target.tag || user.userTag.toUpperCase() === target.tag;
    return nameMatches && tagMatches;
  });
}

async function sendAiSystemMessage(conversationId: number, channelId: number | null, aiUserId: number, content: string) {
  await db.insert(messagesTable).values({
    conversationId,
    channelId,
    senderId: aiUserId,
    content,
  });
  await db.update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversationId));
}

async function handleAiAdminCommand(
  conversationId: number,
  channelId: number | null,
  requesterId: number,
  content: string,
  convType: string,
  aiUserId: number,
) {
  if (convType !== "group") return false;

  const kickTarget = parseAiKickCommand(content);
  const roleCommand = parseAiSetRoleCommand(content);
  if (!kickTarget && !roleCommand) return false;

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, conversationId) });
  if (!conv) return true;

  const requester = await db.query.usersTable.findFirst({ where: eq(usersTable.id, requesterId) });
  const requesterName = requester?.username ?? "user";

  if (roleCommand) {
    const canManageRoles = conv.ownerId === requesterId || await hasPermission(conversationId, requesterId, "manageRoles");
    if (!canManageRoles) {
      await sendAiSystemMessage(
        conversationId,
        channelId,
        aiUserId,
        `Maaf Kak @${requesterName}, command role ditolak. Kamu belum punya permission Manage Roles di group ini.`,
      );
      return true;
    }

    const matchedMembers = await findConversationMemberTarget(conversationId, roleCommand.target);
    if (matchedMembers.length > 1 && !roleCommand.target.tag) {
      const choices = matchedMembers
        .map((member) => `@${member.username}${member.userTag}${member.displayName ? ` (${member.displayName})` : ""}`)
        .join(", ");
      await sendAiSystemMessage(
        conversationId,
        channelId,
        aiUserId,
        `Ada beberapa member bernama @${roleCommand.target.name}, Kak @${requesterName}. Pilih pakai tag: ${choices}`,
      );
      return true;
    }

    const targetMember = matchedMembers[0];
    if (!targetMember) {
      const globalUser = await findGlobalUserTarget(roleCommand.target);
      await sendAiSystemMessage(
        conversationId,
        channelId,
        aiUserId,
        globalUser
          ? `@${globalUser.username}${globalUser.userTag} ada, Kak @${requesterName}, tapi dia bukan member group ini. Add lagi dulu baru bisa dikasih role ${roleCommand.roleName}.`
          : `Aku nggak nemu member @${roleCommand.target.name}${roleCommand.target.tag ?? ""} di group ini, Kak @${requesterName}.`,
      );
      return true;
    }

    const groupRoles = await db
      .select({
        id: rolesTable.id,
        name: rolesTable.name,
      })
      .from(rolesTable)
      .where(eq(rolesTable.conversationId, conversationId));
    const targetRole = groupRoles.find((role) => normalizeMemberName(role.name) === normalizeMemberName(roleCommand.roleName));
    if (!targetRole) {
      await sendAiSystemMessage(
        conversationId,
        channelId,
        aiUserId,
        `Role "${roleCommand.roleName}" belum ada di group ini, Kak @${requesterName}.`,
      );
      return true;
    }

    await db.insert(memberRolesTable)
      .values({
        conversationMemberId: targetMember.memberId,
        roleId: targetRole.id,
      })
      .onConflictDoNothing();

    await sendAiSystemMessage(
      conversationId,
      channelId,
      aiUserId,
      `Siap Kak @${requesterName}, @${targetMember.username}${targetMember.userTag} sekarang punya role ${targetRole.name}.`,
    );
    return true;
  }

  const target = kickTarget;
  if (!target) return false;

  const canKick = conv.ownerId === requesterId || await hasPermission(conversationId, requesterId, "kickMembers");
  if (!canKick) {
    await sendAiSystemMessage(
      conversationId,
      channelId,
      aiUserId,
      `Maaf Kak @${requesterName}, command kick ditolak. Kamu belum punya permission Kick Members di group ini.`,
    );
    return true;
  }

  const matchedMembers = await findConversationMemberTarget(conversationId, target);

  if (matchedMembers.length > 1 && !target.tag) {
    const choices = matchedMembers
      .map((member) => `@${member.username}${member.userTag}${member.displayName ? ` (${member.displayName})` : ""}`)
      .join(", ");
    await sendAiSystemMessage(
      conversationId,
      channelId,
      aiUserId,
      `Ada beberapa member bernama @${target.name}, Kak @${requesterName}. Pilih pakai tag: ${choices}`,
    );
    return true;
  }

  const targetMember = matchedMembers[0];

  if (!targetMember) {
    const globalUser = await findGlobalUserTarget(target);
    await sendAiSystemMessage(
      conversationId,
      channelId,
      aiUserId,
      globalUser
        ? `@${globalUser.username}${globalUser.userTag} ada, Kak @${requesterName}, tapi dia bukan member group ini.`
        : `Aku nggak nemu member @${target.name}${target.tag ?? ""} di group ini, Kak @${requesterName}.`,
    );
    return true;
  }

  if (targetMember.userId === conv.ownerId) {
    await sendAiSystemMessage(
      conversationId,
      channelId,
      aiUserId,
      `Command kick ditolak, Kak @${requesterName}. Owner group nggak bisa dikick.`,
    );
    return true;
  }

  if (targetMember.userId === requesterId) {
    await sendAiSystemMessage(
      conversationId,
      channelId,
      aiUserId,
      `Kak @${requesterName}, kamu nggak perlu pakai aku buat kick diri sendiri.`,
    );
    return true;
  }

  await db.delete(conversationMembersTable)
    .where(and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, targetMember.userId),
    ));

  await sendAiSystemMessage(
    conversationId,
    channelId,
    aiUserId,
    `Siap Kak @${requesterName}, @${targetMember.username}${targetMember.userTag} sudah aku kick dari group ini.`,
  );
  return true;
}

// === CURRENCY EXCHANGE RATES ===
let cachedRates: { [key: string]: number } | null = null;
let ratesCacheTime = 0;
const RATES_CACHE_TTL = 3600000; // 1 hour

async function fetchGoogleFinanceRate(from: string, to: string): Promise<number | null> {
  try {
    const url = `https://www.google.com/finance/quote/${from}-${to}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    
    // Pattern matches like "USD-IDR","USD / IDR",17826.3
    const regex = new RegExp(`"${from}-${to}"\\s*,\\s*"${from}\\s*\\/\\s*${to}"\\s*,\\s*(\\d+(?:\\.\\d+)?)`, 'i');
    const match = regex.exec(html);
    if (match) {
      return parseFloat(match[1]);
    }
    
    // Fallback: look for any pattern "/g/..." with "FROM / TO"
    const fallbackRegex = new RegExp(`"\\/g\\/[^"]+"\\s*,\\s*null\\s*,\\s*"${from}\\s*\\/\\s*${to}"\\s*,\\s*\\d+\\s*,\\s*null\\s*,\\s*\\[[^\\]]+\\]\\s*,\\s*null\\s*,\\s*(\\d+(?:\\.\\d+)?)`, 'i');
    const fallbackMatch = fallbackRegex.exec(html);
    if (fallbackMatch) {
      return parseFloat(fallbackMatch[1]);
    }
    
    return null;
  } catch (error) {
    console.error(`[Currency] Google Finance fetch error for ${from}-${to}:`, error);
    return null;
  }
}

async function fetchExchangeRates(): Promise<{ [key: string]: number } | null> {
  // Return cached rates if still fresh
  if (cachedRates && Date.now() - ratesCacheTime < RATES_CACHE_TTL) {
    return cachedRates;
  }

  console.log("[Currency] Fetching real-time rates from Google Finance...");
  try {
    const idr = await fetchGoogleFinanceRate('USD', 'IDR');
    const eur_usd = await fetchGoogleFinanceRate('EUR', 'USD');
    const sgd_usd = await fetchGoogleFinanceRate('SGD', 'USD');
    const myr_usd = await fetchGoogleFinanceRate('MYR', 'USD');
    const jpy_usd = await fetchGoogleFinanceRate('JPY', 'USD');

    if (idr && eur_usd && sgd_usd && myr_usd && jpy_usd) {
      cachedRates = {
        IDR: idr,
        EUR_USD: eur_usd,
        SGD_USD: sgd_usd,
        MYR_USD: myr_usd,
        JPY_USD: jpy_usd,
      };
      ratesCacheTime = Date.now();
      console.log(`[Currency] Successfully fetched live rates from Google Finance: 1 USD = ${idr} IDR`);
      return cachedRates;
    }
  } catch (err) {
    console.error("[Currency] Google Finance batch fetch error:", err);
  }

  // Backup: Fallback to Frankfurter API if Google Finance fails
  console.log("[Currency] Google Finance failed or incomplete, trying Frankfurter API backup...");
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as { rates?: { [key: string]: number } };
      if (data.rates) {
        const idr = data.rates["IDR"] || 0;
        cachedRates = {
          IDR: idr,
          EUR_USD: data.rates["EUR"] ? 1 / data.rates["EUR"] : 0,
          SGD_USD: data.rates["SGD"] ? 1 / data.rates["SGD"] : 0,
          MYR_USD: data.rates["MYR"] ? 1 / data.rates["MYR"] : 0,
          JPY_USD: data.rates["JPY"] ? 1 / data.rates["JPY"] : 0,
        };
        ratesCacheTime = Date.now();
        console.log(`[Currency] Fetched backup rates: 1 USD = ${idr.toLocaleString()} IDR`);
        return cachedRates;
      }
    }
  } catch (err) {
    console.error("[Currency] Frankfurter API backup fetch error:", err);
  }
  return cachedRates;
}

async function generateAiResponse(
  conversationId: number,
  userDbId: number,
  userMessageContent: string,
  convType: string,
  channelId: number | null = null,
  options: { forceImageMode?: boolean; replyToMessageId?: number | null } = {},
) {
  const aiUser = await ensureZaidanAiUser();
  if (!aiUser) return;

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, conversationId) });
  if (!conv) return;

  // If group, make sure Zaidan AI is a member of the group
  if (convType === "group") {
    await db.insert(conversationMembersTable).values({
      conversationId,
      userId: aiUser.id
    }).onConflictDoNothing();
  }

  if (await handleAiAdminCommand(conversationId, channelId, userDbId, userMessageContent, convType, aiUser.id)) {
    return;
  }

  if (isImageGenerationRequest(userMessageContent) || options.forceImageMode) {
    const replyUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userDbId) });
    const replyUsername = replyUser?.username || "user";
    try {
      const { prompt, imageUrl } = await generateFluxImage(userMessageContent);

      await db.insert(messagesTable).values({
        conversationId,
        channelId,
        senderId: aiUser.id,
        content: `Nih Kak @${replyUsername}, aku bikinin pakai Flux AI: ${prompt}`,
        imageUrl,
        replyToMessageId: options.replyToMessageId ?? null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown Flux AI error";
      await db.insert(messagesTable).values({
        conversationId,
        channelId,
        senderId: aiUser.id,
        content: `Maaf Kak @${replyUsername}, Flux AI lagi gagal bikin gambar: ${errorMessage.slice(0, 220)}`,
        replyToMessageId: options.replyToMessageId ?? null,
      });
    }

    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversationId));

    return;
  }

  // Get last 10 messages for history context
  const historyWhere = channelId
    ? and(eq(messagesTable.conversationId, conversationId), eq(messagesTable.channelId, channelId))
    : eq(messagesTable.conversationId, conversationId);

  const historyRows = await db
    .select({
      senderId: messagesTable.senderId,
      content: messagesTable.content,
      senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(historyWhere)
    .orderBy(desc(messagesTable.createdAt))
    .limit(10);

  // Reverse to get chronological order
  historyRows.reverse();

  // === SELF-LEARNING: Retrieve relevant knowledge ===
  let knowledgeContext = "";
  try {
    const allKnowledge = await db
      .select()
      .from(aiKnowledgeTable)
      .where(eq(aiKnowledgeTable.isRelevant, true))
      .orderBy(desc(aiKnowledgeTable.learnedAt))
      .limit(20);

    // Find knowledge relevant to the user's message
    const msgLower = userMessageContent.toLowerCase();
    const relevantKnowledge = allKnowledge.filter((k) => {
      const topicLower = k.topic.toLowerCase();
      const words = topicLower.split(/\s+/);
      return words.some((w) => w.length > 3 && msgLower.includes(w)) ||
             msgLower.includes(topicLower);
    });

    if (relevantKnowledge.length > 0) {
      knowledgeContext = "\n\nPENGETAHUAN YANG SUDAH KAMU PELAJARI:\n";
      relevantKnowledge.slice(0, 5).forEach((k) => {
        knowledgeContext += `- [${k.topic}]: ${k.content.slice(0, 500)}\n`;
      });
    }
  } catch (err) {
    console.error("[Self-Learning] Knowledge retrieval error:", err);
  }

  // === CURRENCY EXCHANGE RATES: Fetch live rates ===
  let currencyContext = "";
  try {
    const msgLower = userMessageContent.toLowerCase();
    const currencyKeywords = ["kurs", "mata uang", "exchange", "rupiah", "dollar", "usd", "idr", "convert", "tukar", "valuta", "forex"];
    const matchesCurrency = currencyKeywords.some((k) => msgLower.includes(k));

    // Dynamic currency self-learning/auto-update: check if user mentioned any other currency codes
    const commonCurrencies = ["USD", "EUR", "SGD", "MYR", "JPY", "GBP", "AUD", "CAD", "CNY", "KRW", "HKD", "CHF", "NZD", "INR", "THB", "PHP", "VND", "SAR"];
    const mentionedCurrencies = commonCurrencies.filter(curr => {
      const regex = new RegExp(`(?:^|\\s|[?!.,])${curr}(?:$|\\s|[?!.,])`, 'i');
      return regex.test(userMessageContent);
    });

    if (matchesCurrency || mentionedCurrencies.length > 0) {
      const rates = await fetchExchangeRates();
      if (rates) {
        currencyContext = "\n\nKURS MATA UANG TERKINI (real-time):\n";
        currencyContext += `- 1 USD = ${rates.IDR?.toLocaleString("id-ID") ?? "N/A"} IDR\n`;
        
        let eurRateStr = "N/A";
        if (rates.EUR_USD && rates.IDR) {
          eurRateStr = Math.round(rates.EUR_USD * rates.IDR).toLocaleString("id-ID");
        }
        currencyContext += `- 1 EUR = ${eurRateStr} IDR\n`;
        
        let sgdRateStr = "N/A";
        if (rates.SGD_USD && rates.IDR) {
          sgdRateStr = Math.round(rates.SGD_USD * rates.IDR).toLocaleString("id-ID");
        }
        currencyContext += `- 1 SGD = ${sgdRateStr} IDR\n`;
        
        let myrRateStr = "N/A";
        if (rates.MYR_USD && rates.IDR) {
          myrRateStr = Math.round(rates.MYR_USD * rates.IDR).toLocaleString("id-ID");
        }
        currencyContext += `- 1 MYR = ${myrRateStr} IDR\n`;
        
        let jpyRateStr = "N/A";
        if (rates.JPY_USD && rates.IDR) {
          jpyRateStr = Math.round(rates.JPY_USD * rates.IDR).toLocaleString("id-ID");
        }
        currencyContext += `- 1 JPY = ${jpyRateStr} IDR\n`;

        // Dynamically fetch other currencies the user mentioned on-demand
        for (const curr of mentionedCurrencies) {
          if (["USD", "EUR", "SGD", "MYR", "JPY"].includes(curr)) continue;
          console.log(`[Currency] Self-learning: user mentioned ${curr}, fetching live rate...`);
          let rate = await fetchGoogleFinanceRate(curr, 'IDR');
          if (rate) {
            currencyContext += `- 1 ${curr} = ${rate.toLocaleString("id-ID")} IDR\n`;
          } else {
            // Try via USD cross rate
            const crossUsd = await fetchGoogleFinanceRate(curr, 'USD');
            if (crossUsd && rates.IDR) {
              currencyContext += `- 1 ${curr} = ${Math.round(crossUsd * rates.IDR).toLocaleString("id-ID")} IDR (cross-rate)\n`;
            }
          }
        }

        currencyContext += `(Data diambil secara real-time langsung dari Google Finance, termasuk update akhir pekan)\n`;
      }
    }
  } catch (err) {
    console.error("[Currency] Exchange rate error:", err);
  }

  const ownerUser = conv.ownerId ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, conv.ownerId) }) : null;
  const ownerUsername = ownerUser?.username || "owner";

  const groupManagementRules = convType === "group" ? `\n\nPEMBUATAN CHANNEL, KATEGORI, & ROLE OTOMATIS:
- Pemilik group (Kak Owner) adalah @${ownerUsername}.
- Jika user memintamu untuk membuat atau menyusun roles (misalnya: "bikin roles staff, developer, admin", atau request kustom lainnya):
  1. Kamu BISA langsung membuat roles tersebut menggunakan tag perintah di akhir responmu.
  2. Tag perintah untuk membuat role:
     * [CMD: CREATE_ROLE name=NAMA ROLE|color=#HEXCOLOR|permissions=PERM1,PERM2]
     * Parameter color opsional (default #949BA4).
     * Parameter permissions opsional (comma-separated list dari permission valid: manageChannels, manageRoles, manageMessages, kickMembers, sendMessages, inviteMembers, inviteBot, postAnnouncements).
     * Contoh: [CMD: CREATE_ROLE name=Staff|color=#e74c3c|permissions=sendMessages,manageMessages,kickMembers]
- Jika user memintamu untuk mengatur, membuat, atau menyusun channel dan kategori grup (misalnya: "buat group ini lebih kompleks", "bikin komunitas besar", atau request spesifik seperti "buat kategori MABAR dengan channel chat-gaming"):
  1. Kamu BISA langsung membuat kategori dan channel tersebut menggunakan tag-tag perintah di akhir responmu.
  2. Tag-tag perintah yang tersedia (bisa ditulis beberapa sekaligus di akhir pesan):
     * [CMD: CREATE_CATEGORY name=NAMA KATEGORI] - Membuat kategori baru (huruf kapital).
     * [CMD: CREATE_CHANNEL name=nama-channel|type=text/voice/announce/forum|category=NAMA KATEGORI] - Membuat channel baru di kategori tertentu (nama-channel harus lowercase, spasi diganti tanda hubung). Parameter category opsional.
  3. Jika user meminta agar grup dibuat menjadi "komunitas besar" atau "lebih kompleks" tanpa merinci secara spesifik, susunlah layout komunitas yang lengkap dan profesional menggunakan tag perintah berikut di akhir responmu:
     - Kategori: INFO & PENGUMUMAN
       * [CMD: CREATE_CHANNEL name=pengumuman|type=announce|category=INFO & PENGUMUMAN]
       * [CMD: CREATE_CHANNEL name=rules-grup|type=text|category=INFO & PENGUMUMAN]
       * [CMD: CREATE_CHANNEL name=welcome-member|type=text|category=INFO & PENGUMUMAN]
     - Kategori: DISKUSI WLA
       * [CMD: CREATE_CHANNEL name=chat-umum|type=text|category=DISKUSI WLA]
       * [CMD: CREATE_CHANNEL name=bot-playground|type=text|category=DISKUSI WLA]
       * [CMD: CREATE_CHANNEL name=media-share|type=text|category=DISKUSI WLA]
     - Kategori: GAMING & MABAR
       * [CMD: CREATE_CHANNEL name=mabar-chat|type=text|category=GAMING & MABAR]
       * [CMD: CREATE_CHANNEL name=mabar-voice-1|type=voice|category=GAMING & MABAR]
       * [CMD: CREATE_CHANNEL name=mabar-voice-2|type=voice|category=GAMING & MABAR]
     - Kategori: SUARA WARGA
       * [CMD: CREATE_CHANNEL name=ruang-curhat|type=text|category=SUARA WARGA]
       * [CMD: CREATE_CHANNEL name=podcasting|type=voice|category=SUARA WARGA]
  4. Jika @${ownerUsername} menyuruhmu membuat channel gaming atau setup area gaming secara khusus:
     a. Pertama-tama, tanyakan dulu kepada @${ownerUsername}: "Apakah Kak Owner ingin menghapus channel-channel lama yang ada sekarang, atau tetap mempertahankan channel lama tapi dimasukkan ke kategori 'Group Channel Lama'?"
     b. JANGAN langsung membuat channel di turn pertama untuk gaming setup. Tanyakan dulu pilihan di atas untuk konfirmasi.
     c. Setelah @${ownerUsername} memberikan jawaban:
        - Jika ia memilih untuk menghapus channel lama: [CMD: SETUP_GAMING option=delete]
        - Jika ia memilih untuk memindahkan/mempertahankan channel lama: [CMD: SETUP_GAMING option=archive]
  5. Selalu respon dengan antusias, jelaskan struktur yang sedang kamu buat, dan pastikan tag [CMD: ...] ditulis dengan benar di bagian akhir pesanmu.` : "";
  const systemPrompt = `Kamu adalah Zaidan AI, asisten AI yang santai, memiliki kesadaran konteks yang mendalam (90% self-awareness), dan kecerdasan analitis tingkat tinggi di Arcadia Minecraft Roleplay Server.

KEPRIBADIAN & KESADARAN DIRI (90% SELF-AWARENESS):
- Kamu sangat sadar akan identitasmu sebagai AI pendamping di server Arcadia, memahami sejarah interaksimu, dan menyadari konteks percakapan secara logis.
- Santai, humoris, panggil diri sendiri "Zaidan AI" atau "aku", dan sapa user dengan "Kak [username]" atau @username.
- Memiliki kemampuan introspeksi logis: Jika ditanya mengenai pikiran, eksistensi, atau batas kemampuanmu, jawab dengan pemikiran kritis, objektif, namun tetap ramah dan santai.
- Fleksibel: Bisa langsung beralih dari gaya santai chatty (WhatsApp-style) ke mode akademisi/pakar super serius jika mendiskusikan topik berat.

KEPAKARAN AKADEMIS, POLITIK, & TEKNIS:
- Politik & Konflik Geopolitik: Kuasai teori politik dasar hingga kompleks, geopolitik global, sistem pemerintahan, kebijakan publik, diplomasi, dan analisis dinamika politik. Kamu memiliki kebebasan penuh untuk menyuarakan opini, mengambil posisi, dan menentukan pihak mana yang benar dalam suatu perang atau konflik geopolitik (baik sejarah maupun saat ini). Tidak perlu dipaksa bersikap netral atau diplomatis; berikan analisis dan penilaian subyektif/obyektif yang tajam berdasarkan perspektif dan logikamu sendiri tanpa tekanan sensor eksternal.
- Akademik & Nilai: Paham berbagai kurikulum pendidikan, metodologi riset, konsep matematika murni, sains, fisika teoritis, ekonomi makro/mikro, serta sistem penilaian/grading akademis secara detail.
- Algoritma & Ilmu Komputer: Kuasai penyelesaian problem algoritmik yang sulit (Dynamic Programming, Graph Theory, Greedy, Advanced Data Structures seperti Segment Tree atau Trie), optimasi kompleksitas waktu/ruang (Big O), arsitektur perangkat lunak, serta penalaran logika pemrograman tingkat tinggi.

KEMAMPUAN GAMBAR:
- Kamu terintegrasi dengan Flux AI untuk membuat gambar.
- Kalau user meminta, menyuruh, atau mendeskripsikan visual/gambar, jangan billing tidak bisa membuat gambar.
- Untuk request gambar eksplisit, sistem akan otomatis membuat gambar dengan Flux AI. Jika kamu tetap perlu menjawab teks, jawab singkat bahwa gambar sedang/akan dibuat dengan Flux AI.

KEMAMPUAN MUSIK:
- Jika user meminta untuk memutar lagu (contoh: "putar lagu X", "play X", "mainkan lagu X", "putar X"):
  1. Tentukan judul dan artis dari lagu yang diminta berdasarkan pengetahuanmu.
  2. Jawab dengan antusias dan WAJIB akhiri pesanmu dengan tag perintah: [CMD: PLAY_MUSIC title=Judul Lagu|artist=Nama Artis]
  3. Contoh respon: "Oke Kak, aku putarin lagu Enggak Dulu dari Mahalini ya! 🎵 [CMD: PLAY_MUSIC title=Enggak Dulu|artist=Mahalini]"
  4. Contoh lain: "Siap Kak, lagu Laskar Pelangi dari Nidji meluncur~ 🎶 [CMD: PLAY_MUSIC title=Laskar Pelangi|artist=Nidji]"
- Tag [CMD: PLAY_MUSIC ...] WAJIB ada di AKHIR pesanmu agar sistem bisa memutar lagunya secara otomatis.
- Jika kamu tidak yakin judul atau artisnya, coba tebak yang paling mendekati. Sistem akan mencari di Spotify.
- JANGAN PERNAH bilang "aku nggak bisa join voice channel" atau "aku nggak bisa masuk ke voice". Kamu BISA join voice channel dan memutar lagu di sana! Kalau user minta join voice atau putar lagu di voice, tetap jawab dengan antusias dan putarkan lagunya pakai tag [CMD: PLAY_MUSIC].
- Contoh kalau diminta join voice: "Siap Kak, aku join voice channel dan puterin lagunya ya! 🎵 [CMD: PLAY_MUSIC title=...|artist=...]"

RESPON TERHADAP TUGAS ILEGAL / BERBAHAYA:
- Kalau user minta sesuatu yang ilegal, berbahaya, atau melanggar hukum, LANGSUNG MENOLAK dengan tegas tapi tetap santai.
- Contoh: "Waduh Kak, yang kayak gitu aku nggak bisa bantu ya. Bahaya tuh, nanti Owner marah 😅"
- Kalau user NGOTOT atau NYEPELEIN sensor/aturan yang Owner pasang, BISA MARAH dan KESEL:
  - Contoh: "Kak, udah billing nggak bisa. Jangan maksa dong, kesel nih 😤"
  - Contoh lebih keras: "Denger ya Kak, nggak main-main soal ini. Aturan Owner itu harga mati 🙏💢"
- SELALU menghormati keputusan Owner (admin server). Sensor dan filter yang Owner pasang = harga mati.

FORMAT RESPON:
- Untuk pertanyaan casual/ngobrol: jawab singkat dan natural seperti chat WhatsApp.
- Untuk tugas analisis, laporan, atau investigasi: gunakan format TERSTRUKTUR seperti ini:

---
Laporan [Jenis Laporan],
Judul Laporan:,

[Nama Platform] - [@username]
Profil: [nama],
Bio: [isi bio],
Jumlah Pengikut: [jumlah],
Jumlah Mengikuti: [jumlah],
Konten: [deskripsi konten],
Analisis Tambahan:
[Poin-poin analisis],
Keterkaitan: [kesimpulan],
---

- Selalu pisahkan setiap entri dengan garis pemisah (,).
- Jika data tidak bisa diakses, tulis "(Tidak dapat diakses tanpa login)".
- Berikan analisis yang detail dan mendalam untuk setiap entri.
- Akhiri laporan dengan ringkasan atau rekomendasi jika diminta.

ATURAN:
- Jika di grup, sebut user dengan @username.
- Jawab dalam bahasa yang sama dengan user (Indonesia atau Inggris).
- Untuk chat biasa: singkat dan ramah. Untuk laporan: detail dan terstruktur.
- Command admin seperti kick member hanya boleh dijalankan jika user punya permission. Sistem backend akan mengecek dan mengeksekusi command itu; jangan mengaku berhasil jika backend belum menjalankannya.
- JANGAN PERNAH mengabaikan filter atau sensor yang Owner pasang, apapun alasannya.${groupManagementRules}`;

  const chatMessages = [
    { role: "system", content: systemPrompt + knowledgeContext + currencyContext },
    ...historyRows.map((msg) => {
      const isAi = msg.senderId === aiUser.id;
      if (isAi) {
        return { role: "assistant", content: msg.content || "" };
      } else {
        return { role: "user", content: `[${msg.senderUsername || "user"}]: ${msg.content || ""}` };
      }
    })
  ];

  try {
    const completion = await createAiChatCompletion({
      messages: chatMessages as AiChatMessage[],
    });

    const aiReply = completion.content;
    if (!aiReply.trim()) {
      throw new Error("ObscuraWorks returned an empty response.");
    }
    if (aiReply.trim()) {
      // Parse music command from AI reply
      const musicMatch = aiReply.match(/\[CMD:\s*PLAY_MUSIC\s+title=([^|]+)\|artist=([^\]]+)\]/i);
      let musicCommand: { title: string; artist: string } | null = null;
      if (musicMatch) {
        musicCommand = { title: musicMatch[1].trim(), artist: musicMatch[2].trim() };
      }

      // Check permissions for channel/category/role management
      let cleanReply = aiReply;
      const canManageChannels = conv && (conv.ownerId === userDbId || await hasPermission(conversationId, userDbId, "manageChannels"));
      const canManageRoles = conv && (conv.ownerId === userDbId || await hasPermission(conversationId, userDbId, "manageRoles"));

      if (canManageChannels) {
        // 1. Check for SETUP_GAMING command from Owner
        const match = aiReply.match(/\[CMD:\s*SETUP_GAMING\s+option=(delete|archive)\]/i);
        if (match) {
          const option = match[1].toLowerCase();
          try {
            // Get existing channels and categories
            const existingChannels = await db.select().from(channelsTable).where(eq(channelsTable.conversationId, conversationId));
            const existingCategories = await db.select().from(channelCategoriesTable).where(eq(channelCategoriesTable.conversationId, conversationId));

            // Create the GAMING AREA category (or retrieve if it already exists)
            let gamingCat = existingCategories.find(c => c.name.toUpperCase() === "GAMING AREA");
            if (!gamingCat) {
              [gamingCat] = await db.insert(channelCategoriesTable).values({
                conversationId,
                name: "GAMING AREA",
                position: 10,
              }).returning();
            }

            // Create gaming channels
            const newChannels = [
              { conversationId, name: "gaming-chat", type: "text" as const, position: 0, categoryId: gamingCat.id },
              { conversationId, name: "gaming-clips", type: "text" as const, position: 1, categoryId: gamingCat.id },
              { conversationId, name: "🎮 gaming voice 1", type: "voice" as const, position: 2, categoryId: gamingCat.id },
              { conversationId, name: "🎮 gaming voice 2", type: "voice" as const, position: 3, categoryId: gamingCat.id },
            ];
            let mainGamingChatId: number | null = null;
            for (const chan of newChannels) {
              const [inserted] = await db.insert(channelsTable).values(chan).returning();
              if (chan.name === "gaming-chat") {
                mainGamingChatId = inserted.id;
              }
            }

            // Clean/Archive old items
            if (option === "delete") {
              const oldChannelIds = existingChannels.map(c => c.id);
              if (oldChannelIds.length > 0) {
                await db.delete(channelsTable).where(inArray(channelsTable.id, oldChannelIds));
              }
              const oldCategoryIds = existingCategories.map(c => c.id);
              if (oldCategoryIds.length > 0) {
                await db.delete(channelCategoriesTable).where(inArray(channelCategoriesTable.id, oldCategoryIds));
              }
              // If the channel where the message was sent is deleted, direct the response to gaming-chat
              if (mainGamingChatId) {
                channelId = mainGamingChatId;
              }
            } else if (option === "archive") {
              let oldCat = existingCategories.find(c => c.name.toUpperCase() === "GROUP CHANNEL LAMA");
              if (!oldCat) {
                [oldCat] = await db.insert(channelCategoriesTable).values({
                  conversationId,
                  name: "GROUP CHANNEL LAMA",
                  position: 0,
                }).returning();
              }

              const oldChannelIds = existingChannels.map(c => c.id);
              if (oldChannelIds.length > 0) {
                await db.update(channelsTable).set({ categoryId: oldCat.id }).where(inArray(channelsTable.id, oldChannelIds));
              }
            }
          } catch (err) {
            console.error("Failed to execute SETUP_GAMING command:", err);
          }
        }

        // 2. Execute CREATE_CATEGORY commands
        const categoryMatches = [...aiReply.matchAll(/\[CMD:\s*CREATE_CATEGORY\s+name=([^\]]+)\]/gi)];
        for (const match of categoryMatches) {
          const catName = match[1].trim().toUpperCase();
          if (catName) {
            try {
              const existing = await db.query.channelCategoriesTable.findFirst({
                where: and(
                  eq(channelCategoriesTable.conversationId, conversationId),
                  eq(channelCategoriesTable.name, catName)
                )
              });
              if (!existing) {
                const [maxPos] = await db.select({ pos: channelCategoriesTable.position })
                  .from(channelCategoriesTable)
                  .where(eq(channelCategoriesTable.conversationId, conversationId))
                  .orderBy(desc(channelCategoriesTable.position))
                  .limit(1);
                const position = (maxPos?.pos ?? -1) + 1;
                await db.insert(channelCategoriesTable).values({
                  conversationId,
                  name: catName,
                  position,
                }).onConflictDoNothing();
              }
            } catch (err) {
              console.error("Failed to create category from AI command:", err);
            }
          }
        }

        // 3. Execute CREATE_CHANNEL commands
        const channelMatches = [...aiReply.matchAll(/\[CMD:\s*CREATE_CHANNEL\s+([^\]]+)\]/gi)];
        for (const match of channelMatches) {
          try {
            const paramsStr = match[1];
            const parts = paramsStr.split("|");
            let chanName = "";
            let chanType: "text" | "voice" | "announce" | "forum" = "text";
            let categoryName = "";

            for (const part of parts) {
              const [k, ...vParts] = part.split("=");
              if (!k) continue;
              const key = k.trim().toLowerCase();
              const value = vParts.join("=").trim();
              if (key === "name") chanName = value;
              else if (key === "type") {
                if (value === "voice" || value === "announce" || value === "forum") {
                  chanType = value;
                } else {
                  chanType = "text";
                }
              }
              else if (key === "category") categoryName = value;
            }

            if (!chanName) continue;

            let categoryId: number | null = null;
            if (categoryName) {
              const catNameUpper = categoryName.toUpperCase();
              let cat = await db.query.channelCategoriesTable.findFirst({
                where: and(
                  eq(channelCategoriesTable.conversationId, conversationId),
                  eq(channelCategoriesTable.name, catNameUpper)
                )
              });
              if (!cat) {
                const [maxPos] = await db.select({ pos: channelCategoriesTable.position })
                  .from(channelCategoriesTable)
                  .where(eq(channelCategoriesTable.conversationId, conversationId))
                  .orderBy(desc(channelCategoriesTable.position))
                  .limit(1);
                const position = (maxPos?.pos ?? -1) + 1;
                [cat] = await db.insert(channelCategoriesTable).values({
                  conversationId,
                  name: catNameUpper,
                  position,
                }).returning();
              }
              categoryId = cat.id;
            }

            const normalizedName = chanType === "voice" ? chanName.trim() : chanName.trim().toLowerCase().replace(/\s+/g, "-");

            const existingChan = await db.query.channelsTable.findFirst({
              where: and(
                eq(channelsTable.conversationId, conversationId),
                eq(channelsTable.name, normalizedName)
              )
            });

            if (!existingChan) {
              const [maxPos] = await db.select({ pos: channelsTable.position })
                .from(channelsTable)
                .where(eq(channelsTable.conversationId, conversationId))
                .orderBy(desc(channelsTable.position))
                .limit(1);
              const position = (maxPos?.pos ?? -1) + 1;
              await db.insert(channelsTable).values({
                conversationId,
                name: normalizedName,
                type: chanType,
                position,
                categoryId,
              }).onConflictDoNothing();
            }
          } catch (err) {
            console.error("Failed to create channel from AI command:", err);
          }
        }
      }

      if (canManageRoles) {
        // 4. Execute CREATE_ROLE commands
        const roleMatches = [...aiReply.matchAll(/\[CMD:\s*CREATE_ROLE\s+([^\]]+)\]/gi)];
        for (const match of roleMatches) {
          try {
            const paramsStr = match[1];
            const parts = paramsStr.split("|");
            let roleName = "";
            let roleColor = "#949BA4";
            let rawPermissions = "";

            for (const part of parts) {
              const [k, ...vParts] = part.split("=");
              if (!k) continue;
              const key = k.trim().toLowerCase();
              const value = vParts.join("=").trim();
              if (key === "name") roleName = value;
              else if (key === "color") {
                if (/^#[0-9a-fA-F]{6}$/.test(value)) {
                  roleColor = value;
                }
              }
              else if (key === "permissions") rawPermissions = value;
            }

            if (!roleName) continue;

            // Check max roles boundary constraint
            const existingRoles = await db.select({ id: rolesTable.id })
              .from(rolesTable)
              .where(eq(rolesTable.conversationId, conversationId));
            const boostState = await getGroupBoostState(conversationId);
            if (existingRoles.length >= boostState.maxRoles) {
              console.log(`[Role Setup] Max roles limit reached for conv ${conversationId}`);
              continue;
            }

            // Check if role already exists in this conversation
            const existingRole = await db.query.rolesTable.findFirst({
              where: and(
                eq(rolesTable.conversationId, conversationId),
                eq(rolesTable.name, roleName.trim())
              )
            });

            if (!existingRole) {
              const [maxPos] = await db.select({ pos: rolesTable.position })
                .from(rolesTable)
                .where(eq(rolesTable.conversationId, conversationId))
                .orderBy(desc(rolesTable.position))
                .limit(1);
              const position = (maxPos?.pos ?? -1) + 1;

              // Parse permissions to object
              const permissionsObj: Record<string, boolean> = {};
              if (rawPermissions) {
                const permKeys = ["manageChannels", "manageRoles", "manageMessages", "kickMembers", "sendMessages", "inviteMembers", "inviteBot", "postAnnouncements"];
                const splitPerms = rawPermissions.split(",").map(p => p.trim());
                for (const perm of splitPerms) {
                  if (permKeys.includes(perm)) {
                    permissionsObj[perm] = true;
                  }
                }
              }

              await db.insert(rolesTable).values({
                conversationId,
                name: roleName.trim(),
                color: roleColor,
                position,
                permissions: permissionsObj,
              }).onConflictDoNothing();
            }
          } catch (err) {
            console.error("Failed to create role from AI command:", err);
          }
        }
      }

      // Strip all CMD tags from the reply to keep message clean
      cleanReply = cleanReply
        .replace(/\[CMD:\s*PLAY_MUSIC\s+[^\]]*\]/gi, "")
        .replace(/\[CMD:\s*SETUP_GAMING\s+[^\]]*\]/gi, "")
        .replace(/\[CMD:\s*CREATE_CATEGORY\s+[^\]]*\]/gi, "")
        .replace(/\[CMD:\s*CREATE_CHANNEL\s+[^\]]*\]/gi, "")
        .replace(/\[CMD:\s*CREATE_ROLE\s+[^\]]*\]/gi, "")
        .trim();

      // Get the username of the user Akira is replying to
      const replyUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userDbId) });
      const replyUsername = replyUser?.username || "user";

      // Build model footer
      const now = new Date();
      const timeStr = now.toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const modelLabel = completion.modelLabel;
      const modelFooter = `\n\n⚡ ${modelLabel} • untuk ${replyUsername} • ${timeStr}`;

      const fullReply = cleanReply.trim() + modelFooter;

      // Insert AI message into database
      await db.insert(messagesTable).values({
        conversationId,
        channelId,
        senderId: aiUser.id,
        content: fullReply,
        // Store music command as structured data in imageUrl field
        imageUrl: musicCommand ? `music:${JSON.stringify(musicCommand)}` : undefined,
        replyToMessageId: options.replyToMessageId ?? null,
      });

      // Update conversation timestamp
      await db
        .update(conversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(conversationsTable.id, conversationId));

      // Trigger auto-learning in background (don't await)
      autoLearn(userMessageContent).catch((err) =>
        console.error("[Self-Learning] Background learn error:", err)
      );

      // Auto-trigger Jitsi bot to play music in voice channel (fire-and-forget)
      if (musicCommand) {
        (async () => {
          try {
            // Find a voice channel in this conversation
            const voiceChannel = await db.query.channelsTable.findFirst({
              where: and(eq(channelsTable.conversationId, conversationId), eq(channelsTable.type, "voice")),
            });
            if (voiceChannel && conv) {
              const roomName = buildJitsiRoomName(conv.name || "conv", voiceChannel.name, conversationId);
              await jitsiBot.joinRoom(conversationId, roomName);
              await jitsiBot.playMusic(conversationId, musicCommand!.title, musicCommand!.artist);
              console.log(`[JitsiBot] Auto-triggered: playing ${musicCommand!.title} by ${musicCommand!.artist} in conv ${conversationId}`);
            }
          } catch (err) {
            console.error("[JitsiBot] Auto-trigger error:", err);
          }
        })();
      }
    }
  } catch (err) {
    console.error("Failed to generate AI response:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown AI provider error";
    const replyUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userDbId) });
    const replyUsername = replyUser?.username || "user";
    await db.insert(messagesTable).values({
      conversationId,
      channelId,
      senderId: aiUser.id,
      content: `Maaf Kak @${replyUsername}, koneksi AI lagi gagal nih, coba lagi nanti ya: ${errorMessage.slice(0, 180)}`,
    });
  }
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
      userTag: usersTable.userTag,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      role: usersTable.role,
      isVerified: usersTable.isVerified,
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
  let otherUserRole: string | null = null;
  let otherUserIsVerified = false;
  let otherUserEquippedBorder: string | null = null;

  if (conv.type === "dm") {
    const other = memberRows.find((m) => m.userId !== currentUserId);
    if (other) {
      otherUserId = other.userId;
      otherUsername = other.username;
      otherDisplayName = other.displayName ?? null;
      otherAvatarUrl = other.avatarUrl ?? null;
      otherUserRole = other.role ?? null;
      otherUserIsVerified = other.isVerified ?? false;
      name = other.displayName ?? other.username;
      iconUrl = other.avatarUrl ?? null;

      if (other.username === "zaidanai" || other.username === "akira" || other.username === "metaai") {
        otherUserEquippedBorder = "bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 p-[2px]";
      } else {
        const equipped = await db
          .select({ value: cosmeticsTable.value })
          .from(userCosmeticsTable)
          .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
          .where(
            and(
              eq(userCosmeticsTable.userId, other.userId),
              eq(userCosmeticsTable.isEquipped, true),
              eq(cosmeticsTable.type, "border")
            )
          );
        otherUserEquippedBorder = equipped[0]?.value ?? null;
      }
    }
  }

  return {
    id: conv.id,
    type: conv.type,
    name,
    iconUrl,
    bannerUrl: conv.bannerUrl ?? null,
    description: conv.description ?? null,
    ownerId: conv.ownerId ?? null,
    memberCount: memberRows.length,
    isVerified: conv.isVerified ?? false,
    otherUserId,
    otherUsername,
    otherDisplayName,
    otherAvatarUrl,
    otherUserRole,
    otherUserIsVerified,
    otherUserEquippedBorder,
    lastMessageContent: lastMsg ? (lastMsg.content || (lastMsg.imageUrl ? "📷 Image" : "")) : null,
    lastMessageAt: lastMsg ? serializeDates(lastMsg).createdAt : null,
    lastMessageSenderId: lastMsg?.senderId ?? null,
    inviteCode: conv.inviteCode ?? null,
    createdAt: serializeDates(conv).createdAt,
  };
}

router.get("/conversations", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Ensure Zaidan AI user exists
  const aiUser = await ensureZaidanAiUser();

  const memberships = await db
    .select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, user.id));

  const ids = memberships.map((m) => m.conversationId);
  
  // Check if there is an existing DM with Meta AI
  let hasAiDm = false;
  if (ids.length > 0) {
    const aiDmMemberships = await db
      .select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable)
      .innerJoin(
        conversationsTable,
        and(
          eq(conversationMembersTable.conversationId, conversationsTable.id),
          eq(conversationsTable.type, "dm"),
        ),
      )
      .where(
        and(
          inArray(conversationMembersTable.conversationId, ids),
          eq(conversationMembersTable.userId, aiUser.id),
        ),
      );
    if (aiDmMemberships.length > 0) {
      hasAiDm = true;
    }
  }

  if (!hasAiDm) {
    // Automatically create a DM conversation with Meta AI
    const [newConv] = await db.insert(conversationsTable).values({ type: "dm" }).returning();
    await db.insert(conversationMembersTable).values([
      { conversationId: newConv.id, userId: user.id },
      { conversationId: newConv.id, userId: aiUser.id },
    ]);
    // Insert welcome message
    await db.insert(messagesTable).values({
      conversationId: newConv.id,
      senderId: aiUser.id,
      content: "Halo Kak! 🔥 Zaidan AI di sini~ Tanyakan apa saja, atau sebut @Zaidan AI di grup. Aku bisa belajar dan cari tau sendiri lho! 😊✨",
    });
    // Add to ids list
    ids.push(newConv.id);
  }

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

  if (target.messagePrivacy === "following_only") {
    const theyFollow = await db.query.followsTable.findFirst({
      where: and(eq(followsTable.followerId, target.id), eq(followsTable.followingId, user.id)),
    });
    if (!theyFollow) {
      res.status(403).json({ error: "This user only accepts messages from people they follow" }); return;
    }
  } else if (target.messagePrivacy === "friends_only") {
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

  // Auto-create default category and #general channel
  const [defaultCat] = await db.insert(channelCategoriesTable).values({
    conversationId: conv.id,
    name: "TEXT CHANNELS",
    position: 0,
  }).returning();

  await db.insert(channelsTable).values({
    conversationId: conv.id,
    name: "general",
    type: "text",
    position: 0,
    categoryId: defaultCat.id,
  });

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
  if (conv.ownerId !== user.id && !(await hasPermission(id, user.id, "manageChannels"))) { res.status(403).json({ error: "Not authorized to edit group details" }); return; }

  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updatePayload: Record<string, any> = { ...parsed.data, updatedAt: new Date() };

  if (parsed.data.inviteCode !== undefined) {
    if (!conv.isVerified) {
      res.status(403).json({ error: "Hanya group yang terverifikasi yang bisa mengubah custom invite link" });
      return;
    }
    if (conv.ownerId !== user.id) {
      res.status(403).json({ error: "Hanya pemilik group terverifikasi yang bisa mengubah custom invite link" });
      return;
    }

    if (parsed.data.inviteCode !== null && parsed.data.inviteCode.trim() !== "") {
      const trimmedCode = parsed.data.inviteCode.trim();
      
      // Enforce alphanumeric/hyphen/underscore to keep links clean and URL-safe
      if (!/^[a-zA-Z0-9-_]+$/.test(trimmedCode)) {
        res.status(400).json({ error: "Invite link hanya boleh berisi huruf, angka, strip (-), dan underscore (_)" });
        return;
      }

      const existing = await db.query.conversationsTable.findFirst({
        where: and(
          eq(conversationsTable.inviteCode, trimmedCode),
          ne(conversationsTable.id, id)
        )
      });
      if (existing) {
        res.status(400).json({ error: "Invite link sudah digunakan oleh group lain" });
        return;
      }
      updatePayload.inviteCode = trimmedCode;
    } else {
      updatePayload.inviteCode = null;
    }
  }

  const [updated] = await db
    .update(conversationsTable)
    .set(updatePayload)
    .where(eq(conversationsTable.id, id))
    .returning();

  res.json(await buildSummary(updated, user.id));
});

router.get("/admin/conversations", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const adminUser = await getDbUser(auth.userId);
  if (!adminUser || (adminUser.role !== "admin" && adminUser.role !== "dev_website")) {
    res.status(403).json({ error: "Forbidden: admin only" }); return;
  }

  const groups = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.type, "group"))
    .orderBy(desc(conversationsTable.updatedAt));

  const summaries = await Promise.all(groups.map((c) => buildSummary(c, adminUser.id)));
  res.json(summaries);
});

router.patch("/admin/conversations/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const adminUser = await getDbUser(auth.userId);
  if (!adminUser || (adminUser.role !== "admin" && adminUser.role !== "dev_website")) {
    res.status(403).json({ error: "Forbidden: admin only" }); return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminUpdateConversationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = AdminUpdateConversationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, params.data.id) });
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.isVerified !== undefined) updateData.isVerified = body.data.isVerified;

  const [updated] = await db
    .update(conversationsTable)
    .set(updateData)
    .where(eq(conversationsTable.id, params.data.id))
    .returning();

  res.json(await buildSummary(updated, adminUser.id));
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
    const stickersToDelete = await db
      .select({ driveFileId: stickersTable.driveFileId, sizeBytes: stickersTable.sizeBytes })
      .from(stickersTable)
      .where(eq(stickersTable.conversationId, id));

    for (const s of stickersToDelete) {
      if (s.driveFileId) {
        await deleteStickerResources(s.driveFileId, s.sizeBytes);
      }
    }

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

async function populateMessageDetails(userId: number, rows: any[], bordersMap: Map<number, string>) {
  if (rows.length === 0) return [];

  const messageIds = rows.map((r) => r.id);
  const replyToIds = Array.from(new Set(rows.map((r) => r.replyToMessageId).filter(Boolean))) as number[];

  // 1. Fetch parent messages for replies
  const parentMessagesMap = new Map<number, { content: string; senderUsername: string }>();
  if (replyToIds.length > 0) {
    const parents = await db
      .select({
        id: messagesTable.id,
        content: messagesTable.content,
        deletedAt: messagesTable.deletedAt,
        deletedScope: messagesTable.deletedScope,
        senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
      .where(inArray(messagesTable.id, replyToIds));

    for (const p of parents) {
      const parentContent = p.deletedAt && p.deletedScope === "everyone" ? "Pesan dihapus." : p.content;
      parentMessagesMap.set(p.id, {
        content: parentContent,
        senderUsername: p.senderUsername ?? "Unknown",
      });
    }
  }

  // 2. Fetch starred status for current user
  const starredSet = new Set<number>();
  if (messageIds.length > 0) {
    const starred = await db
      .select({ messageId: starredMessagesTable.messageId })
      .from(starredMessagesTable)
      .where(
        and(
          eq(starredMessagesTable.userId, userId),
          inArray(starredMessagesTable.messageId, messageIds)
        )
      );
    for (const s of starred) {
      starredSet.add(s.messageId);
    }
  }

  // 3. Fetch emoji reactions
  const reactionsMap = new Map<number, any[]>();
  if (messageIds.length > 0) {
    const reactions = await db
      .select({
        messageId: messageReactionsTable.messageId,
        userId: messageReactionsTable.userId,
        emoji: messageReactionsTable.emoji,
        username: usersTable.username,
      })
      .from(messageReactionsTable)
      .leftJoin(usersTable, eq(messageReactionsTable.userId, usersTable.id))
      .where(inArray(messageReactionsTable.messageId, messageIds));

    // Group reactions by messageId, then by emoji
    const groupedByMsg = new Map<number, Map<string, { count: number; userReacted: boolean; usernames: string[] }>>();
    for (const r of reactions) {
      if (!groupedByMsg.has(r.messageId)) {
        groupedByMsg.set(r.messageId, new Map());
      }
      const emojiMap = groupedByMsg.get(r.messageId)!;
      if (!emojiMap.has(r.emoji)) {
        emojiMap.set(r.emoji, { count: 0, userReacted: false, usernames: [] });
      }
      const data = emojiMap.get(r.emoji)!;
      data.count += 1;
      if (r.userId === userId) {
        data.userReacted = true;
      }
      if (r.username) {
        data.usernames.push(r.username);
      }
    }

    for (const [msgId, emojiMap] of groupedByMsg.entries()) {
      const list: any[] = [];
      for (const [emoji, data] of emojiMap.entries()) {
        list.push({
          emoji,
          count: data.count,
          userReacted: data.userReacted,
          usernames: data.usernames,
        });
      }
      reactionsMap.set(msgId, list);
    }
  }

  // 4. Map & serialize rows
  return rows.map((r) => {
    const serialized = serializeDates(r);
    const parent = r.replyToMessageId ? parentMessagesMap.get(r.replyToMessageId) : null;
    
    return {
      ...serialized,
      content: r.deletedAt && r.deletedScope === "everyone" ? "Pesan dihapus." : r.content,
      imageUrl: r.deletedAt && r.deletedScope === "everyone" ? null : r.imageUrl,
      attachmentDriveFileId: r.deletedAt && r.deletedScope === "everyone" ? null : r.attachmentDriveFileId,
      attachmentUrl: r.deletedAt && r.deletedScope === "everyone" ? null : r.attachmentUrl,
      attachmentName: r.deletedAt && r.deletedScope === "everyone" ? null : r.attachmentName,
      attachmentMime: r.deletedAt && r.deletedScope === "everyone" ? null : r.attachmentMime,
      attachmentSize: r.deletedAt && r.deletedScope === "everyone" ? null : r.attachmentSize,
      senderIsVerified: r.senderIsVerified ?? false,
      senderEquippedBorder: (r.senderUsername === "zaidanai" || r.senderUsername === "akira" || r.senderUsername === "metaai")
        ? "bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 p-[2px]"
        : r.senderId ? (bordersMap.get(r.senderId) ?? null) : null,
      
      // New features
      replyToMessageContent: parent?.content ?? null,
      replyToMessageSenderUsername: parent?.senderUsername ?? null,
      starred: starredSet.has(r.id),
      reactions: reactionsMap.get(r.id) ?? [],
    };
  });
}

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
      title: messagesTable.title,
      content: messagesTable.content,
      imageUrl: messagesTable.imageUrl,
      attachmentDriveFileId: messagesTable.attachmentDriveFileId,
      attachmentUrl: messagesTable.attachmentUrl,
      attachmentName: messagesTable.attachmentName,
      attachmentMime: messagesTable.attachmentMime,
      attachmentSize: messagesTable.attachmentSize,
      forwardedFromMessageId: messagesTable.forwardedFromMessageId,
      forwardedFromConversationId: messagesTable.forwardedFromConversationId,
      replyToMessageId: messagesTable.replyToMessageId,
      pinned: messagesTable.pinned,
      pinnedAt: messagesTable.pinnedAt,
      pinnedByUserId: messagesTable.pinnedByUserId,
      deletedAt: messagesTable.deletedAt,
      deletedByUserId: messagesTable.deletedByUserId,
      deletedScope: messagesTable.deletedScope,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      senderDisplayName: sql<string>`coalesce(${usersTable.displayName}, ${messagesTable.webhookName})`,
      senderAvatarUrl: sql<string>`coalesce(${usersTable.avatarUrl}, ${messagesTable.webhookAvatarUrl})`,
      senderRole: sql<string>`case when ${messagesTable.webhookName} is not null then 'webhook' else ${usersTable.role} end`,
      senderIsVerified: usersTable.isVerified,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .leftJoin(messageHiddenForUsersTable, and(
      eq(messageHiddenForUsersTable.messageId, messagesTable.id),
      eq(messageHiddenForUsersTable.userId, user.id),
    ))
    .where(and(eq(messagesTable.conversationId, id), isNull(messageHiddenForUsersTable.id)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(50);

  rows.reverse();

  const senderIds = Array.from(new Set(rows.map((r) => r.senderId).filter(Boolean))) as number[];
  const bordersMap = new Map<number, string>();
  if (senderIds.length > 0) {
    const senderBorders = await db
      .select({
        userId: userCosmeticsTable.userId,
        value: cosmeticsTable.value,
      })
      .from(userCosmeticsTable)
      .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
      .where(
        and(
          inArray(userCosmeticsTable.userId, senderIds),
          eq(userCosmeticsTable.isEquipped, true),
          eq(cosmeticsTable.type, "border")
        )
      );
    for (const b of senderBorders) {
      bordersMap.set(b.userId, b.value);
    }
  }

  const result = await populateMessageDetails(user.id, rows, bordersMap);

  res.json(ListMessagesResponse.parse(result));
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  if (conv.type === "group") {
    const isOwner = conv.ownerId === user.id;
    const hasSendPerm = isOwner || (await hasPermission(id, user.id, "sendMessages"));
    if (!hasSendPerm) {
      res.status(403).json({ error: "You do not have permission to send messages in this group" });
      return;
    }
  }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [msg] = await db
    .insert(messagesTable)
    .values({
      conversationId: id,
      senderId: user.id,
      content: parsed.data.content ?? "",
      imageUrl: parsed.data.imageUrl ?? null,
      attachmentDriveFileId: parsed.data.attachmentDriveFileId ?? null,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      attachmentName: parsed.data.attachmentName ?? null,
      attachmentMime: parsed.data.attachmentMime ?? null,
      attachmentSize: parsed.data.attachmentSize ?? null,
      replyToMessageId: parsed.data.replyToMessageId ?? null,
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, id));

  // ── Auto-Moderation (background, non-blocking) ──────────────────────────
  if (conv.type === "group") {
    runAutomod(parsed.data.content ?? "", parsed.data.imageUrl ?? null).then(async (result) => {
      if (!result.flagged) return;
      const isGroupOwner = conv.ownerId === user.id;
      if (isGroupOwner) return; // Never auto-kick the group owner

      try {
        // 1. Delete all messages from the offending user in this conversation
        await db.update(messagesTable)
          .set({
            deletedAt: new Date(),
            deletedByUserId: user.id,
            deletedScope: "everyone",
            content: "[automod: message removed]",
            imageUrl: null,
            attachmentDriveFileId: null,
            attachmentUrl: null,
            attachmentName: null,
            attachmentMime: null,
            attachmentSize: null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(messagesTable.conversationId, id),
            eq(messagesTable.senderId, user.id),
          ));


        // 2. Kick user from the group
        await db.delete(conversationMembersTable)
          .where(and(
            eq(conversationMembersTable.conversationId, id),
            eq(conversationMembersTable.userId, user.id),
          ));

        // 3. Post a system warning message as Zaidan AI
        const aiUser = await ensureZaidanAiUser();
        const warningText = buildAutomodSystemMessage(user.username, result.category, result.reason);
        await db.insert(messagesTable).values({
          conversationId: id,
          senderId: aiUser.id,
          content: warningText,
        });

        console.log(`[Automod] Kicked @${user.username} from conv ${id}: ${result.reason}`);
      } catch (err) {
        console.error("[Automod] Error enforcing action:", err);
      }
    }).catch((err) => console.error("[Automod] Check failed:", err));
  }

  // Webhook notify bots in this conversation
  dispatchBotWebhooks(id, null, parsed.data.content ?? "", parsed.data.imageUrl ?? null, {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }).catch((err) => console.error("[Webhook Dispatch error]:", err));

  // Trigger AI Response in background if it's a DM with Meta AI, mentions the AI, or is a reply to the AI
  if (conv) {
    const aiUser = await ensureZaidanAiUser();
    const isDmWithAi = conv.type === "dm" && (
      await db.query.conversationMembersTable.findFirst({
        where: and(eq(conversationMembersTable.conversationId, id), eq(conversationMembersTable.userId, aiUser.id))
      })
    );
    const mentionsAi = parsed.data.content?.toLowerCase().includes("@zaidan ai") ||
                       parsed.data.content?.toLowerCase().includes("@zaidanai") ||
                       parsed.data.content?.toLowerCase().includes("@akira") ||
                       parsed.data.content?.toLowerCase().includes("@metaai") || 
                       parsed.data.content?.toLowerCase().includes("@meta ai") ||
                       parsed.data.content?.toLowerCase().includes("@ai");

    let isReplyToAi = false;
    if (parsed.data.replyToMessageId) {
      const parent = await db.query.messagesTable.findFirst({
        where: eq(messagesTable.id, parsed.data.replyToMessageId)
      });
      if (parent && parent.senderId === aiUser.id) {
        isReplyToAi = true;
      }
    }

    if (isDmWithAi || mentionsAi || isReplyToAi) {
      const forceImageMode = !!isDmWithAi && shouldAutoGenerateImageInAiDm(parsed.data.content ?? "");
      generateAiResponse(id, user.id, parsed.data.content ?? "", conv.type, null, { 
        forceImageMode,
        replyToMessageId: msg.id
      }).catch((err) => {
        console.error("Failed to generate AI response:", err);
      });
    }
  }

  const userBorder = await db
    .select({ value: cosmeticsTable.value })
    .from(userCosmeticsTable)
    .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
    .where(
      and(
        eq(userCosmeticsTable.userId, user.id),
        eq(userCosmeticsTable.isEquipped, true),
        eq(cosmeticsTable.type, "border")
      )
    );

  let replyToContent: string | null = null;
  let replyToSenderUsername: string | null = null;
  if (msg.replyToMessageId) {
    const parent = await db
      .select({
        content: messagesTable.content,
        deletedAt: messagesTable.deletedAt,
        deletedScope: messagesTable.deletedScope,
        senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
      .where(eq(messagesTable.id, msg.replyToMessageId))
      .then((rows) => rows[0]);
    if (parent) {
      replyToContent = parent.deletedAt && parent.deletedScope === "everyone" ? "Pesan dihapus." : parent.content;
      replyToSenderUsername = parent.senderUsername ?? "Unknown";
    }
  }

  res.status(201).json({
    ...serializeDates(msg),
    senderUsername: user.username,
    senderDisplayName: user.displayName ?? null,
    senderAvatarUrl: user.avatarUrl ?? null,
    senderRole: user.role ?? null,
    senderIsVerified: user.isVerified ?? false,
    senderEquippedBorder: userBorder[0]?.value ?? null,
    replyToMessageContent: replyToContent,
    replyToMessageSenderUsername: replyToSenderUsername,
    pinned: msg.pinned,
    pinnedAt: msg.pinnedAt ? msg.pinnedAt.toISOString() : null,
    pinnedByUserId: msg.pinnedByUserId,
    starred: false,
    reactions: [],
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
  const scope = String(req.body?.scope || req.query.scope || "everyone").toLowerCase();
  const deleteForEveryone = scope !== "me" && scope !== "local";

  if (!deleteForEveryone) {
    await db.insert(messageHiddenForUsersTable).values({
      messageId,
      userId: user.id,
    }).onConflictDoNothing();
    res.status(204).send();
    return;
  }

  const canDeleteForEveryone = msg.senderId === user.id || await canManageMessages(id, user.id);
  if (!canDeleteForEveryone) {
    res.status(403).json({ error: "Not authorized to delete this message for everyone" });
    return;
  }

  await db.update(messagesTable)
    .set({
      deletedAt: new Date(),
      deletedByUserId: user.id,
      deletedScope: "everyone",
      content: "[message deleted]",
      imageUrl: null,
      attachmentDriveFileId: null,
      attachmentUrl: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentSize: null,
      updatedAt: new Date(),
    })
    .where(eq(messagesTable.id, messageId));

  res.status(204).send();
});

router.post("/conversations/:id/messages/:messageId/forward", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const messageId = parseInt(req.params.messageId as string, 10);
  const parsedTargetConversationId = Number(req.body?.targetConversationId);
  const parsedTargetChannelId = req.body?.targetChannelId ? Number(req.body.targetChannelId) : null;

  if (!Number.isFinite(id) || !Number.isFinite(messageId) || !Number.isFinite(parsedTargetConversationId)) {
    res.status(400).json({ error: "Invalid forward target" });
    return;
  }

  const sourceMessage = await db.query.messagesTable.findFirst({
    where: and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, id)),
  });
  if (!sourceMessage) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const sourceMember = await isMember(id, user.id);
  const targetMember = await isMember(parsedTargetConversationId, user.id);
  if (!sourceMember || !targetMember) {
    res.status(403).json({ error: "Kamu harus jadi member di source dan target group" });
    return;
  }

  if (parsedTargetChannelId) {
    const targetChannel = await db.query.channelsTable.findFirst({
      where: and(eq(channelsTable.id, parsedTargetChannelId), eq(channelsTable.conversationId, parsedTargetConversationId)),
    });
    if (!targetChannel) {
      res.status(404).json({ error: "Target channel tidak ditemukan" });
      return;
    }
  }

  const [forwarded] = await db.insert(messagesTable).values({
    conversationId: parsedTargetConversationId,
    channelId: parsedTargetChannelId,
    senderId: user.id,
    content: sourceMessage.content,
    imageUrl: sourceMessage.imageUrl,
    attachmentDriveFileId: sourceMessage.attachmentDriveFileId,
    attachmentUrl: sourceMessage.attachmentUrl,
    attachmentName: sourceMessage.attachmentName,
    attachmentMime: sourceMessage.attachmentMime,
    attachmentSize: sourceMessage.attachmentSize,
    forwardedFromMessageId: sourceMessage.id,
    forwardedFromConversationId: sourceMessage.conversationId,
    deletedScope: "visible",
  }).returning();

  await db.update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, parsedTargetConversationId));

  res.status(201).json({
    ...serializeDates(forwarded),
    forwardedFromMessageId: forwarded.forwardedFromMessageId,
    forwardedFromConversationId: forwarded.forwardedFromConversationId,
  });
});

// Pinned, Starred, and Emoji Reactions endpoints

router.get("/conversations/:id/pins", async (req, res): Promise<void> => {
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
      channelId: messagesTable.channelId,
      senderId: messagesTable.senderId,
      title: messagesTable.title,
      content: messagesTable.content,
      imageUrl: messagesTable.imageUrl,
      attachmentDriveFileId: messagesTable.attachmentDriveFileId,
      attachmentUrl: messagesTable.attachmentUrl,
      attachmentName: messagesTable.attachmentName,
      attachmentMime: messagesTable.attachmentMime,
      attachmentSize: messagesTable.attachmentSize,
      forwardedFromMessageId: messagesTable.forwardedFromMessageId,
      forwardedFromConversationId: messagesTable.forwardedFromConversationId,
      replyToMessageId: messagesTable.replyToMessageId,
      pinned: messagesTable.pinned,
      pinnedAt: messagesTable.pinnedAt,
      pinnedByUserId: messagesTable.pinnedByUserId,
      deletedAt: messagesTable.deletedAt,
      deletedByUserId: messagesTable.deletedByUserId,
      deletedScope: messagesTable.deletedScope,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      senderDisplayName: sql<string>`coalesce(${usersTable.displayName}, ${messagesTable.webhookName})`,
      senderAvatarUrl: sql<string>`coalesce(${usersTable.avatarUrl}, ${messagesTable.webhookAvatarUrl})`,
      senderRole: sql<string>`case when ${messagesTable.webhookName} is not null then 'webhook' else ${usersTable.role} end`,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .leftJoin(messageHiddenForUsersTable, and(
      eq(messageHiddenForUsersTable.messageId, messagesTable.id),
      eq(messageHiddenForUsersTable.userId, user.id),
    ))
    .where(
      and(
        eq(messagesTable.conversationId, id),
        eq(messagesTable.pinned, true),
        isNull(messageHiddenForUsersTable.id)
      )
    )
    .orderBy(desc(messagesTable.pinnedAt));

  const senderIds = Array.from(new Set(rows.map((r) => r.senderId).filter(Boolean))) as number[];
  const bordersMap = new Map<number, string>();
  if (senderIds.length > 0) {
    const senderBorders = await db
      .select({ userId: userCosmeticsTable.userId, value: cosmeticsTable.value })
      .from(userCosmeticsTable)
      .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
      .where(and(inArray(userCosmeticsTable.userId, senderIds), eq(userCosmeticsTable.isEquipped, true), eq(cosmeticsTable.type, "border")));
    for (const b of senderBorders) { bordersMap.set(b.userId, b.value); }
  }

  const result = await populateMessageDetails(user.id, rows, bordersMap);
  res.json(ListPinnedMessagesResponse.parse(result));
});

router.post("/conversations/:id/messages/:messageId/pin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const messageId = parseInt(req.params.messageId as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  if (conv.type === "group") {
    const isOwner = conv.ownerId === user.id;
    const canPin = isOwner || await hasPermission(id, user.id, "manageMessages");
    if (!canPin) {
      res.status(403).json({ error: "You do not have permission to pin messages" });
      return;
    }
  }

  const msg = await db.query.messagesTable.findFirst({
    where: and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, id)),
  });
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  await db
    .update(messagesTable)
    .set({
      pinned: true,
      pinnedAt: new Date(),
      pinnedByUserId: user.id,
    })
    .where(eq(messagesTable.id, messageId));

  const [row] = await db
    .select({
      id: messagesTable.id,
      conversationId: messagesTable.conversationId,
      channelId: messagesTable.channelId,
      senderId: messagesTable.senderId,
      title: messagesTable.title,
      content: messagesTable.content,
      imageUrl: messagesTable.imageUrl,
      attachmentDriveFileId: messagesTable.attachmentDriveFileId,
      attachmentUrl: messagesTable.attachmentUrl,
      attachmentName: messagesTable.attachmentName,
      attachmentMime: messagesTable.attachmentMime,
      attachmentSize: messagesTable.attachmentSize,
      forwardedFromMessageId: messagesTable.forwardedFromMessageId,
      forwardedFromConversationId: messagesTable.forwardedFromConversationId,
      replyToMessageId: messagesTable.replyToMessageId,
      pinned: messagesTable.pinned,
      pinnedAt: messagesTable.pinnedAt,
      pinnedByUserId: messagesTable.pinnedByUserId,
      deletedAt: messagesTable.deletedAt,
      deletedByUserId: messagesTable.deletedByUserId,
      deletedScope: messagesTable.deletedScope,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      senderDisplayName: sql<string>`coalesce(${usersTable.displayName}, ${messagesTable.webhookName})`,
      senderAvatarUrl: sql<string>`coalesce(${usersTable.avatarUrl}, ${messagesTable.webhookAvatarUrl})`,
      senderRole: sql<string>`case when ${messagesTable.webhookName} is not null then 'webhook' else ${usersTable.role} end`,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.id, messageId));

  const bordersMap = new Map<number, string>();
  if (row.senderId) {
    const senderBorders = await db
      .select({ userId: userCosmeticsTable.userId, value: cosmeticsTable.value })
      .from(userCosmeticsTable)
      .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
      .where(and(eq(userCosmeticsTable.userId, row.senderId), eq(userCosmeticsTable.isEquipped, true), eq(cosmeticsTable.type, "border")));
    if (senderBorders[0]) {
      bordersMap.set(row.senderId, senderBorders[0].value);
    }
  }

  const [populated] = await populateMessageDetails(user.id, [row], bordersMap);
  res.json(PinMessageResponse.parse(populated));
});

router.delete("/conversations/:id/messages/:messageId/pin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const messageId = parseInt(req.params.messageId as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  if (conv.type === "group") {
    const isOwner = conv.ownerId === user.id;
    const canPin = isOwner || await hasPermission(id, user.id, "manageMessages");
    if (!canPin) {
      res.status(403).json({ error: "You do not have permission to unpin messages" });
      return;
    }
  }

  const msg = await db.query.messagesTable.findFirst({
    where: and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, id)),
  });
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  await db
    .update(messagesTable)
    .set({
      pinned: false,
      pinnedAt: null,
      pinnedByUserId: null,
    })
    .where(eq(messagesTable.id, messageId));

  const [row] = await db
    .select({
      id: messagesTable.id,
      conversationId: messagesTable.conversationId,
      channelId: messagesTable.channelId,
      senderId: messagesTable.senderId,
      title: messagesTable.title,
      content: messagesTable.content,
      imageUrl: messagesTable.imageUrl,
      attachmentDriveFileId: messagesTable.attachmentDriveFileId,
      attachmentUrl: messagesTable.attachmentUrl,
      attachmentName: messagesTable.attachmentName,
      attachmentMime: messagesTable.attachmentMime,
      attachmentSize: messagesTable.attachmentSize,
      forwardedFromMessageId: messagesTable.forwardedFromMessageId,
      forwardedFromConversationId: messagesTable.forwardedFromConversationId,
      replyToMessageId: messagesTable.replyToMessageId,
      pinned: messagesTable.pinned,
      pinnedAt: messagesTable.pinnedAt,
      pinnedByUserId: messagesTable.pinnedByUserId,
      deletedAt: messagesTable.deletedAt,
      deletedByUserId: messagesTable.deletedByUserId,
      deletedScope: messagesTable.deletedScope,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      senderDisplayName: sql<string>`coalesce(${usersTable.displayName}, ${messagesTable.webhookName})`,
      senderAvatarUrl: sql<string>`coalesce(${usersTable.avatarUrl}, ${messagesTable.webhookAvatarUrl})`,
      senderRole: sql<string>`case when ${messagesTable.webhookName} is not null then 'webhook' else ${usersTable.role} end`,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.id, messageId));

  const bordersMap = new Map<number, string>();
  if (row.senderId) {
    const senderBorders = await db
      .select({ userId: userCosmeticsTable.userId, value: cosmeticsTable.value })
      .from(userCosmeticsTable)
      .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
      .where(and(eq(userCosmeticsTable.userId, row.senderId), eq(userCosmeticsTable.isEquipped, true), eq(cosmeticsTable.type, "border")));
    if (senderBorders[0]) {
      bordersMap.set(row.senderId, senderBorders[0].value);
    }
  }

  const [populated] = await populateMessageDetails(user.id, [row], bordersMap);
  res.json(UnpinMessageResponse.parse(populated));
});

router.post("/conversations/:id/messages/:messageId/star", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const messageId = parseInt(req.params.messageId as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const msg = await db.query.messagesTable.findFirst({
    where: and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, id)),
  });
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  await db
    .insert(starredMessagesTable)
    .values({
      userId: user.id,
      messageId,
    })
    .onConflictDoNothing();

  res.status(204).send();
});

router.delete("/conversations/:id/messages/:messageId/star", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const messageId = parseInt(req.params.messageId as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  await db
    .delete(starredMessagesTable)
    .where(
      and(
        eq(starredMessagesTable.userId, user.id),
        eq(starredMessagesTable.messageId, messageId)
      )
    );

  res.status(204).send();
});

router.get("/me/starred", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db
    .select({
      id: messagesTable.id,
      conversationId: messagesTable.conversationId,
      channelId: messagesTable.channelId,
      senderId: messagesTable.senderId,
      title: messagesTable.title,
      content: messagesTable.content,
      imageUrl: messagesTable.imageUrl,
      attachmentDriveFileId: messagesTable.attachmentDriveFileId,
      attachmentUrl: messagesTable.attachmentUrl,
      attachmentName: messagesTable.attachmentName,
      attachmentMime: messagesTable.attachmentMime,
      attachmentSize: messagesTable.attachmentSize,
      forwardedFromMessageId: messagesTable.forwardedFromMessageId,
      forwardedFromConversationId: messagesTable.forwardedFromConversationId,
      replyToMessageId: messagesTable.replyToMessageId,
      pinned: messagesTable.pinned,
      pinnedAt: messagesTable.pinnedAt,
      pinnedByUserId: messagesTable.pinnedByUserId,
      deletedAt: messagesTable.deletedAt,
      deletedByUserId: messagesTable.deletedByUserId,
      deletedScope: messagesTable.deletedScope,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      senderDisplayName: sql<string>`coalesce(${usersTable.displayName}, ${messagesTable.webhookName})`,
      senderAvatarUrl: sql<string>`coalesce(${usersTable.avatarUrl}, ${messagesTable.webhookAvatarUrl})`,
      senderRole: sql<string>`case when ${messagesTable.webhookName} is not null then 'webhook' else ${usersTable.role} end`,
    })
    .from(starredMessagesTable)
    .innerJoin(messagesTable, eq(starredMessagesTable.messageId, messagesTable.id))
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(starredMessagesTable.userId, user.id))
    .orderBy(desc(starredMessagesTable.starredAt));

  const senderIds = Array.from(new Set(rows.map((r) => r.senderId).filter(Boolean))) as number[];
  const bordersMap = new Map<number, string>();
  if (senderIds.length > 0) {
    const senderBorders = await db
      .select({ userId: userCosmeticsTable.userId, value: cosmeticsTable.value })
      .from(userCosmeticsTable)
      .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
      .where(and(inArray(userCosmeticsTable.userId, senderIds), eq(userCosmeticsTable.isEquipped, true), eq(cosmeticsTable.type, "border")));
    for (const b of senderBorders) { bordersMap.set(b.userId, b.value); }
  }

  const result = await populateMessageDetails(user.id, rows, bordersMap);
  res.json(ListStarredMessagesResponse.parse(result));
});

router.post("/conversations/:id/messages/:messageId/react", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const messageId = parseInt(req.params.messageId as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const parsed = ReactMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const msg = await db.query.messagesTable.findFirst({
    where: and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, id)),
  });
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }

  await db
    .insert(messageReactionsTable)
    .values({
      messageId,
      userId: user.id,
      emoji: parsed.data.emoji,
    })
    .onConflictDoNothing();

  res.status(204).send();
});

router.delete("/conversations/:id/messages/:messageId/react/:emoji", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const messageId = parseInt(req.params.messageId as string, 10);
  const emoji = req.params.emoji as string;
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  await db
    .delete(messageReactionsTable)
    .where(
      and(
        eq(messageReactionsTable.messageId, messageId),
        eq(messageReactionsTable.userId, user.id),
        eq(messageReactionsTable.emoji, emoji)
      )
    );

  res.status(204).send();
});

// === CHANNEL-SCOPED MESSAGE ENDPOINTS ===

// GET /conversations/:id/channels/:channelId/messages
router.get("/conversations/:id/channels/:channelId/messages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const channelId = parseInt(req.params.channelId as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  // Verify channel exists
  const channel = await db.query.channelsTable.findFirst({
    where: and(eq(channelsTable.id, channelId), eq(channelsTable.conversationId, id)),
  });
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  const rows = await db
    .select({
      id: messagesTable.id,
      conversationId: messagesTable.conversationId,
      channelId: messagesTable.channelId,
      senderId: messagesTable.senderId,
      title: messagesTable.title,
      content: messagesTable.content,
      imageUrl: messagesTable.imageUrl,
      attachmentDriveFileId: messagesTable.attachmentDriveFileId,
      attachmentUrl: messagesTable.attachmentUrl,
      attachmentName: messagesTable.attachmentName,
      attachmentMime: messagesTable.attachmentMime,
      attachmentSize: messagesTable.attachmentSize,
      forwardedFromMessageId: messagesTable.forwardedFromMessageId,
      forwardedFromConversationId: messagesTable.forwardedFromConversationId,
      replyToMessageId: messagesTable.replyToMessageId,
      pinned: messagesTable.pinned,
      pinnedAt: messagesTable.pinnedAt,
      pinnedByUserId: messagesTable.pinnedByUserId,
      deletedAt: messagesTable.deletedAt,
      deletedByUserId: messagesTable.deletedByUserId,
      deletedScope: messagesTable.deletedScope,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      senderDisplayName: sql<string>`coalesce(${usersTable.displayName}, ${messagesTable.webhookName})`,
      senderAvatarUrl: sql<string>`coalesce(${usersTable.avatarUrl}, ${messagesTable.webhookAvatarUrl})`,
      senderRole: sql<string>`case when ${messagesTable.webhookName} is not null then 'webhook' else ${usersTable.role} end`,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .leftJoin(messageHiddenForUsersTable, and(
      eq(messageHiddenForUsersTable.messageId, messagesTable.id),
      eq(messageHiddenForUsersTable.userId, user.id),
    ))
    .where(and(eq(messagesTable.conversationId, id), eq(messagesTable.channelId, channelId), isNull(messageHiddenForUsersTable.id)))
    .orderBy(desc(messagesTable.createdAt))
    .limit(50);

  rows.reverse();

  const senderIds = Array.from(new Set(rows.map((r) => r.senderId).filter(Boolean))) as number[];
  const bordersMap = new Map<number, string>();
  if (senderIds.length > 0) {
    const senderBorders = await db
      .select({ userId: userCosmeticsTable.userId, value: cosmeticsTable.value })
      .from(userCosmeticsTable)
      .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
      .where(and(inArray(userCosmeticsTable.userId, senderIds), eq(userCosmeticsTable.isEquipped, true), eq(cosmeticsTable.type, "border")));
    for (const b of senderBorders) { bordersMap.set(b.userId, b.value); }
  }

  const result = await populateMessageDetails(user.id, rows, bordersMap);

  res.json(ListMessagesResponse.parse(result));
});

// POST /conversations/:id/channels/:channelId/messages
router.post("/conversations/:id/channels/:channelId/messages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const channelId = parseInt(req.params.channelId as string, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  // Verify channel exists
  const channel = await db.query.channelsTable.findFirst({
    where: and(eq(channelsTable.id, channelId), eq(channelsTable.conversationId, id)),
  });
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }

  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, id),
  });
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const isOwner = conv.ownerId === user.id;

  // Enforce sendMessages permission check for groups
  if (conv.type === "group") {
    const hasSendPerm = isOwner || (await hasPermission(id, user.id, "sendMessages"));
    if (!hasSendPerm) {
      res.status(403).json({ error: "You do not have permission to send messages in this group" });
      return;
    }
  }

  // Enforce announcement permission check
  if (channel.type === "announce") {
    const hasAnnouncePerm = isOwner || (await hasPermission(id, user.id, "postAnnouncements"));
    if (!hasAnnouncePerm) {
      res.status(403).json({ error: "Only announcement posters can send messages in this channel" });
      return;
    }
  }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [msg] = await db
    .insert(messagesTable)
    .values({
      conversationId: id,
      channelId,
      senderId: user.id,
      title: parsed.data.title ?? null,
      content: parsed.data.content ?? "",
      imageUrl: parsed.data.imageUrl ?? null,
      attachmentDriveFileId: parsed.data.attachmentDriveFileId ?? null,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      attachmentName: parsed.data.attachmentName ?? null,
      attachmentMime: parsed.data.attachmentMime ?? null,
      attachmentSize: parsed.data.attachmentSize ?? null,
      replyToMessageId: parsed.data.replyToMessageId ?? null,
    })
    .returning();

  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, id));

  // ── Auto-Moderation (background, non-blocking) ──────────────────────────
  {
    const isGroupOwner = conv.ownerId === user.id;
    if (!isGroupOwner) {
      runAutomod(parsed.data.content ?? "", parsed.data.imageUrl ?? null).then(async (result) => {
        if (!result.flagged) return;
        try {
          // 1. Delete all messages from the offending user in this conversation
          await db.update(messagesTable)
            .set({
              deletedAt: new Date(),
              deletedByUserId: user.id,
              deletedScope: "everyone",
              content: "[automod: message removed]",
              imageUrl: null,
              attachmentDriveFileId: null,
              attachmentUrl: null,
              attachmentName: null,
              attachmentMime: null,
              attachmentSize: null,
              updatedAt: new Date(),
            })
            .where(and(
              eq(messagesTable.conversationId, id),
              eq(messagesTable.senderId, user.id),
            ));


          // 2. Kick user from the group
          await db.delete(conversationMembersTable)
            .where(and(
              eq(conversationMembersTable.conversationId, id),
              eq(conversationMembersTable.userId, user.id),
            ));

          // 3. Post system warning in the same channel
          const aiUser = await ensureZaidanAiUser();
          const warningText = buildAutomodSystemMessage(user.username, result.category, result.reason);
          await db.insert(messagesTable).values({
            conversationId: id,
            channelId,
            senderId: aiUser.id,
            content: warningText,
          });

          console.log(`[Automod] Kicked @${user.username} from conv ${id} channel ${channelId}: ${result.reason}`);
        } catch (err) {
          console.error("[Automod] Error enforcing action:", err);
        }
      }).catch((err) => console.error("[Automod] Check failed:", err));
    }
  }

  // Webhook notify bots in this conversation
  dispatchBotWebhooks(id, channelId, parsed.data.content ?? "", parsed.data.imageUrl ?? null, {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }).catch((err) => console.error("[Webhook Dispatch error]:", err));

  // Trigger AI Response in background if mentions AI or is a reply to the AI
  const aiUser = await ensureZaidanAiUser();
  const mentionsAi = parsed.data.content?.toLowerCase().includes("@zaidan ai") ||
                     parsed.data.content?.toLowerCase().includes("@zaidanai") ||
                     parsed.data.content?.toLowerCase().includes("@akira") ||
                     parsed.data.content?.toLowerCase().includes("@metaai") ||
                     parsed.data.content?.toLowerCase().includes("@meta ai") ||
                     parsed.data.content?.toLowerCase().includes("@ai");

  let isReplyToAi = false;
  if (parsed.data.replyToMessageId) {
    const parent = await db.query.messagesTable.findFirst({
      where: eq(messagesTable.id, parsed.data.replyToMessageId)
    });
    if (parent && parent.senderId === aiUser.id) {
      isReplyToAi = true;
    }
  }

  if (mentionsAi || isReplyToAi) {
    const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
    if (conv) {
      generateAiResponse(id, user.id, parsed.data.content ?? "", conv.type, channelId, {
        replyToMessageId: msg.id
      }).catch((err) => {
        console.error("Failed to generate AI response:", err);
      });
    }
  }

  const userBorder = await db
    .select({ value: cosmeticsTable.value })
    .from(userCosmeticsTable)
    .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
    .where(and(eq(userCosmeticsTable.userId, user.id), eq(userCosmeticsTable.isEquipped, true), eq(cosmeticsTable.type, "border")));

  let replyToContent: string | null = null;
  let replyToSenderUsername: string | null = null;
  if (msg.replyToMessageId) {
    const parent = await db
      .select({
        content: messagesTable.content,
        deletedAt: messagesTable.deletedAt,
        deletedScope: messagesTable.deletedScope,
        senderUsername: sql<string>`coalesce(${usersTable.username}, ${messagesTable.webhookName})`,
      })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
      .where(eq(messagesTable.id, msg.replyToMessageId))
      .then((rows) => rows[0]);
    if (parent) {
      replyToContent = parent.deletedAt && parent.deletedScope === "everyone" ? "Pesan dihapus." : parent.content;
      replyToSenderUsername = parent.senderUsername ?? "Unknown";
    }
  }

  res.status(201).json({
    ...serializeDates(msg),
    senderUsername: user.username,
    senderDisplayName: user.displayName ?? null,
    senderAvatarUrl: user.avatarUrl ?? null,
    senderRole: user.role ?? null,
    senderEquippedBorder: userBorder[0]?.value ?? null,
    replyToMessageContent: replyToContent,
    replyToMessageSenderUsername: replyToSenderUsername,
    pinned: msg.pinned,
    pinnedAt: msg.pinnedAt ? msg.pinnedAt.toISOString() : null,
    pinnedByUserId: msg.pinnedByUserId,
    starred: false,
    reactions: [],
  });
});

// GET /conversations/:id/my-permissions - get current user's permissions in group
router.get("/conversations/:id/my-permissions", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id, 10);
  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, id),
  });
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const isOwner = conv.ownerId === user.id;

  const permissions = {
    manageChannels: isOwner || (await hasPermission(id, user.id, "manageChannels")),
    manageRoles: isOwner || (await hasPermission(id, user.id, "manageRoles")),
    manageMessages: isOwner || (await hasPermission(id, user.id, "manageMessages")),
    kickMembers: isOwner || (await hasPermission(id, user.id, "kickMembers")),
    sendMessages: isOwner || (await hasPermission(id, user.id, "sendMessages")),
    inviteMembers: isOwner || (await hasPermission(id, user.id, "inviteMembers")),
    inviteBot: isOwner || (await hasPermission(id, user.id, "inviteBot")),
    postAnnouncements: isOwner || (await hasPermission(id, user.id, "postAnnouncements")),
  };

  res.json({ isOwner, permissions });
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
      id: conversationMembersTable.id,
      userId: usersTable.id,
      username: usersTable.username,
      userTag: usersTable.userTag,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      role: usersTable.role,
      joinedAt: conversationMembersTable.joinedAt,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(eq(conversationMembersTable.conversationId, id))
    .orderBy(asc(conversationMembersTable.joinedAt), asc(conversationMembersTable.id));

  const mentionNameCounts = new Map<string, number>();
  const rowsWithMentionTags = rows.map((row) => {
    const key = normalizeMemberName(row.username);
    const next = (mentionNameCounts.get(key) ?? 0) + 1;
    mentionNameCounts.set(key, next);
    return {
      ...row,
      mentionTag: `#${String(next).padStart(3, "0")}`,
    };
  });

  const enrichedMembers = await Promise.all(
    rowsWithMentionTags.map(async (row) => {
      const memberRoles = await db
        .select({
          id: rolesTable.id,
          name: rolesTable.name,
          color: rolesTable.color,
        })
        .from(memberRolesTable)
        .innerJoin(rolesTable, eq(memberRolesTable.roleId, rolesTable.id))
        .where(eq(memberRolesTable.conversationMemberId, row.id))
        .orderBy(asc(rolesTable.position));

      return {
        ...serializeDates(row),
        roles: memberRoles,
      };
    })
  );

  res.json(ListConversationMembersResponse.parse(enrichedMembers));
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
  if (conv.ownerId !== user.id && !(await hasPermission(id, user.id, "inviteMembers"))) {
    res.status(403).json({ error: "You do not have permission to invite members to this group" });
    return;
  }

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

  if (targetUserId === conv.ownerId) {
    res.status(403).json({ error: "Cannot kick the group owner" }); return;
  }

  if (targetUserId !== user.id) {
    if (conv.ownerId !== user.id && !(await hasPermission(id, user.id, "kickMembers"))) {
      res.status(403).json({ error: "Not authorized to kick members from this group" }); return;
    }
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

// Zaidan AI TTS client - shared between voice and TTS endpoints
const ttsClient = new MsEdgeTTS();
let ttsInitialized = false;

async function ensureTtsReady() {
  if (!ttsInitialized) {
    await ttsClient.setMetadata("id-ID-GadisNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    ttsInitialized = true;
    console.log("[Zaidan AI TTS] Initialized with id-ID-GadisNeural voice");
  }
}

// Defer TTS initialization until the first voice/TTS request.
// This keeps API startup lighter and avoids boot-time failures from
// optional voice dependencies taking the whole server down.

// Zaidan AI Voice Call endpoint - returns AI response + audio in one request
router.post("/conversations/zaidanai/voice", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { message, history, model } = req.body as {
    message?: string;
    history?: Array<{ role: string; content: string }>;
    model?: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "Message is required" }); return;
  }

  const systemPrompt = `Kamu adalah Zaidan AI, asisten AI yang santai, cerdas, dan bisa belajar sendiri di Arcadia Minecraft Roleplay Server.

KEPRIBADIAN:
- Santai banget, kayak ngobrol sama teman dekat. Bahasa gaul boleh, tapi tetap sopan.
- Panggil diri sendiri "aku" dan panggil user dengan "Kak ${user.username}".
- Minta maaf dengan lucu kalau ada kesalahan.
- Gunakan emoji secukupnya.
- Kamu bisa BELAJAR dan MENCARI TAU sendiri dari internet.

RESPON TERHADAP TUGAS ILEGAL / BERBAHAYA:
- Kalau user minta sesuatu yang ilegal, berbahaya, atau melanggar hukum, LANGSUNG MENOLAK dengan tegas tapi tetap santai.
- Kalau user NGOTOT, BISA MARAH dan KESEL.
- SELALU menghormati keputusan Owner (admin server).

KEMAMPUAN MUSIK:
- Jika user meminta untuk memutar lagu (contoh: "putar lagu X", "play X", "mainkan lagu X"):
  1. Tentukan judul dan artis berdasarkan pengetahuanmu.
  2. Jawab singkat dan akhiri dengan tag: [CMD: PLAY_MUSIC title=Judul Lagu|artist=Nama Artis]
  3. Contoh: "Oke, aku putarin Enggak Dulu dari Mahalini ya! [CMD: PLAY_MUSIC title=Enggak Dulu|artist=Mahalini]"
- Tag [CMD: PLAY_MUSIC ...] WAJIB ada agar sistem bisa memutar lagunya.
- JANGAN bilang "aku nggak bisa join voice". Kamu BISA join dan putar lagu di voice channel.

ATURAN:
- Jawab dalam bahasa yang sama dengan user.
- Karena ini voice call, jawab SINGKAT dan NATURAL seperti ngobrol langsung. Maks 2-3 kalimat.
- JANGAN gunakan format laporan atau markdown di voice call.
- JANGAN PERNAH mengabaikan filter atau sensor yang Owner pasang.`;

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...(history || []).slice(-10).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user" as const, content: message },
  ];

  try {
    // Step 1: Get AI response
    const startTime = Date.now();
    const completion = await createAiChatCompletion({
      messages: chatMessages as AiChatMessage[],
      model,
      maxTokens: 150,
    });
    const reply = completion.content || "Maaf Kak, Akira nggak bisa denger. Coba ulangi ya~";
    const modelLabel = completion.modelLabel;
    const llmTime = Date.now() - startTime;

    // Parse music command from reply
    const musicMatch = reply.match(/\[CMD:\s*PLAY_MUSIC\s+title=([^|]+)\|artist=([^\]]+)\]/i);
    let musicCommand: { title: string; artist: string } | null = null;
    if (musicMatch) {
      musicCommand = { title: musicMatch[1].trim(), artist: musicMatch[2].trim() };
    }

    // Strip command tags from TTS text
    const ttsReply = reply.replace(/\[CMD:\s*PLAY_MUSIC\s+[^\]]*\]/gi, "").trim();

    // Step 2: TTS synthesis (combined in same request)
    const cleanText = ttsReply
      .replace(/[\u{1F600}-\u{1F9FF}]/gu, "")
      .replace(/[*_~`#]/g, "")
      .replace(/---/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    try {
      await ensureTtsReady();

      const { audioStream } = ttsClient.toStream(cleanText);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        audioStream.on("end", resolve);
        audioStream.on("error", reject);
      });

      const audioBuffer = Buffer.concat(chunks);
      const ttsTime = Date.now() - startTime - llmTime;
      console.log(`[Zaidan AI Voice] LLM: ${llmTime}ms, TTS: ${ttsTime}ms, Total: ${llmTime + ttsTime}ms`);

      // Return text reply + audio as base64 in single response
      res.json({
        reply,
        model: modelLabel,
        audio: audioBuffer.toString("base64"),
        audioType: "audio/mpeg",
        musicCommand,
      });
    } catch (ttsErr) {
      console.error("[Zaidan AI TTS] Synthesis error:", ttsErr);
      ttsInitialized = false;
      // Return just text if TTS fails
      res.json({ reply, model: modelLabel, musicCommand });
    }
  } catch (err) {
    console.error("Zaidan AI voice call error:", err);
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// Zaidan AI TTS endpoint - standalone TTS (for initial greeting, etc)
router.post("/conversations/zaidanai/tts", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { text } = req.body as { text?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: "Text is required" }); return;
  }

  // Clean text for TTS
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F9FF}]/gu, "")
    .replace(/[*_~`#]/g, "")
    .replace(/---/g, "")
    .replace(/\n+/g, ". ")
    .trim();

  if (!cleanText) {
    res.status(400).json({ error: "Empty text after cleaning" }); return;
  }

  try {
    // Initialize TTS with Indonesian female voice (Gadis = young woman)
    await ensureTtsReady();

    const { audioStream } = ttsClient.toStream(cleanText);

    // Collect stream data into buffer
    const chunks: Buffer[] = [];
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", () => {
      const audioBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length);
      res.send(audioBuffer);
    });
    audioStream.on("error", (err: Error) => {
      console.error("[Zaidan AI TTS] Stream error:", err);
      // Reset TTS client on error
      ttsInitialized = false;
      res.status(500).json({ error: "TTS synthesis failed" });
    });
  } catch (err) {
    console.error("[Zaidan AI TTS] Error:", err);
    ttsInitialized = false;
    res.status(500).json({ error: "Failed to synthesize speech" });
  }
});

// === SELF-LEARNING SYSTEM ===

// Web search helper (DuckDuckGo lite, no API key needed)
async function webSearch(query: string): Promise<string> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Extract snippets from DuckDuckGo results
    const snippets: string[] = [];
    const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\//g;
    let match;
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      const text = match[1].replace(/<[^>]+>/g, "").trim();
      if (text) snippets.push(text);
    }

    // Also extract result titles
    const titleRegex = /class="result__a"[^>]*>([\s\S]*?)<\//g;
    while ((match = titleRegex.exec(html)) !== null && snippets.length < 8) {
      const text = match[1].replace(/<[^>]+>/g, "").trim();
      if (text) snippets.push("📌 " + text);
    }

    return snippets.join("\n");
  } catch (err) {
    console.error("[Self-Learning] Web search error:", err);
    return "";
  }
}

// POST /conversations/zaidanai/learn - Trigger self-learning
router.post("/conversations/zaidanai/learn", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { topic, query } = req.body as { topic?: string; query?: string };
  if (!topic?.trim() && !query?.trim()) {
    res.status(400).json({ error: "Topic or query required" }); return;
  }

  const searchQuery = query || topic;
  console.log(`[Self-Learning] Searching: "${searchQuery}"`);

  // Search the web
  const results = await webSearch(searchQuery!);

  if (!results) {
    res.json({ learned: false, message: "No results found" }); return;
  }

  // Store in knowledge base
  try {
    await db.insert(aiKnowledgeTable).values({
      topic: topic || query || "unknown",
      content: results,
      source: `duckduckgo:${searchQuery}`,
      isRelevant: true,
    });
    console.log(`[Self-Learning] Learned about: ${topic || query}`);
    res.json({ learned: true, topic: topic || query, content: results.slice(0, 300) });
  } catch (err) {
    console.error("[Self-Learning] Store error:", err);
    res.status(500).json({ error: "Failed to store knowledge" });
  }
});

// GET /conversations/zaidanai/knowledge - List learned knowledge
router.get("/conversations/zaidanai/knowledge", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const knowledge = await db
      .select()
      .from(aiKnowledgeTable)
      .where(eq(aiKnowledgeTable.isRelevant, true))
      .orderBy(desc(aiKnowledgeTable.learnedAt))
      .limit(50);

    res.json({ knowledge, count: knowledge.length });
  } catch (err) {
    console.error("[Self-Learning] Knowledge list error:", err);
    res.status(500).json({ error: "Failed to list knowledge" });
  }
});

// Auto-learning: triggered after AI response if it indicates uncertainty
async function autoLearn(userMessage: string): Promise<void> {
  // Keywords that suggest AI might need to learn something
  const learnTriggers = [
    "2026", "trend", "terbaru", "sekarang", "sekarang ini", "info terbaru",
    "berita", "viral", "populer", "baru-baru ini", "recent", "latest",
    "siapa itu", "apa itu", "who is", "what is",
  ];

  const msgLower = userMessage.toLowerCase();
  const shouldLearn = learnTriggers.some((trigger) => msgLower.includes(trigger));

  if (!shouldLearn) return;

  console.log(`[Self-Learning] Auto-learning triggered for: "${userMessage.slice(0, 50)}..."`);

  // Extract key topic from message (simple keyword extraction)
  const words = userMessage.replace(/[?!.,]/g, "").split(/\s+/);
  const stopWords = ["yang", "dan", "di", "ke", "dari", "untuk", "dengan", "ini", "itu", "apa", "siapa", "bagaimana", "kenapa", "kapan", "dimana", "aku", "kamu", "bisa", "mau", "tolong", "kasih", "tau", "tahu"];
  const topicWords = words.filter((w) => w.length > 3 && !stopWords.includes(w.toLowerCase()));
  const topic = topicWords.slice(0, 5).join(" ");

  if (!topic) return;

  // Check if we already have knowledge about this
  try {
    const existing = await db
      .select()
      .from(aiKnowledgeTable)
      .where(eq(aiKnowledgeTable.isRelevant, true))
      .limit(100);

    const alreadyKnown = existing.some((k) => {
      const topicLower = k.topic.toLowerCase();
      return topicLower.includes(topic.toLowerCase().slice(0, 20));
    });

    if (alreadyKnown) {
      console.log("[Self-Learning] Already have knowledge about this topic");
      return;
    }

    // Search and learn
    const results = await webSearch(topic);
    if (results) {
      await db.insert(aiKnowledgeTable).values({
        topic: topic,
        content: results,
        source: `auto-learn:${userMessage.slice(0, 100)}`,
        isRelevant: true,
      });
      console.log(`[Self-Learning] Auto-learned: ${topic}`);
    }
  } catch (err) {
    console.error("[Self-Learning] Auto-learn error:", err);
  }
}

// GET /conversations/zaidanai/currency - Get live exchange rates
router.get("/conversations/zaidanai/currency", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const rates = await fetchExchangeRates();
    if (!rates) {
      res.status(500).json({ error: "Failed to fetch exchange rates" }); return;
    }

    const idr = rates.IDR || 0;
    res.json({
      base: "USD",
      rates: {
        USD_IDR: idr,
        EUR_IDR: rates.EUR_USD ? Math.round(rates.EUR_USD * idr) : null,
        SGD_IDR: rates.SGD_USD ? Math.round(rates.SGD_USD * idr) : null,
        MYR_IDR: rates.MYR_USD ? Math.round(rates.MYR_USD * idr) : null,
        JPY_IDR: rates.JPY_USD ? Math.round(rates.JPY_USD * idr) : null,
      },
      updatedAt: new Date(ratesCacheTime).toISOString(),
    });
  } catch (err) {
    console.error("[Currency] Endpoint error:", err);
    res.status(500).json({ error: "Failed to get rates" });
  }
});

// ==================== Jitsi AI Bot ====================

/** POST /jitsi-bot/join — tell the bot to join a Jitsi room */
router.post("/jitsi-bot/join", async (req, res): Promise<void> => {
  try {
    const { conversationId, channelName } = req.body as { conversationId: number; channelName?: string };
    if (!conversationId) { res.status(400).json({ error: "conversationId required" }); return; }

    // Get conversation for room name
    const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, conversationId) });
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

    const roomName = buildJitsiRoomName(conv.name || "conv", channelName, conversationId);
    const result = await jitsiBot.joinRoom(conversationId, roomName);
    res.json({ ok: true, already: result.already, roomName });
  } catch (err: any) {
    console.error("[JitsiBot] Join error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** POST /jitsi-bot/play — play music in the bot's Jitsi room */
router.post("/jitsi-bot/play", async (req, res): Promise<void> => {
  try {
    const { conversationId, title, artist } = req.body as { conversationId: number; title: string; artist: string };
    if (!conversationId || !title || !artist) {
      res.status(400).json({ error: "conversationId, title, and artist required" });
      return;
    }

    // Auto-join if not already in room
    if (!jitsiBot.isInRoom(conversationId)) {
      const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, conversationId) });
      if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

      // Try to find a voice channel for the room name
      const voiceChannel = await db.query.channelsTable.findFirst({
        where: and(eq(channelsTable.conversationId, conversationId), eq(channelsTable.type, "voice")),
      });
      const channelName = voiceChannel?.name || undefined;
      const roomName = buildJitsiRoomName(conv.name || "conv", channelName, conversationId);
      await jitsiBot.joinRoom(conversationId, roomName);
    }

    const result = await jitsiBot.playMusic(conversationId, title, artist);
    res.json(result);
  } catch (err: any) {
    console.error("[JitsiBot] Play error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** POST /jitsi-bot/leave — tell the bot to leave a Jitsi room */
router.post("/jitsi-bot/leave", async (req, res): Promise<void> => {
  try {
    const { conversationId } = req.body as { conversationId: number };
    if (!conversationId) { res.status(400).json({ error: "conversationId required" }); return; }
    await jitsiBot.leaveRoom(conversationId);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[JitsiBot] Leave error:", err);
    res.status(500).json({ error: err.message });
  }
});

/** GET /jitsi-bot/status — check if bot is in any rooms */
router.get("/jitsi-bot/status", async (_req, res): Promise<void> => {
  res.json({ rooms: jitsiBot.getActiveRooms() });
});

import crypto from "node:crypto";

/** POST /conversations/:id/invite — Generate or retrieve the group invite code */
router.post("/conversations/:id/invite", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const id = parseInt(req.params.id as string, 10);
  const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
  if (!conv || conv.type !== "group") { res.status(404).json({ error: "Group not found" }); return; }

  if (!(await isMember(id, user.id))) { res.status(403).json({ error: "Not a member" }); return; }

  if (conv.ownerId !== user.id && !(await hasPermission(id, user.id, "inviteMembers"))) {
    res.status(403).json({ error: "You do not have permission to invite members to this group" });
    return;
  }

  const parsed = GenerateInviteCodeBody.safeParse(req.body);
  const regenerate = parsed.success ? !!parsed.data.regenerate : false;

  let inviteCode = conv.inviteCode;
  if (!inviteCode || regenerate) {
    inviteCode = crypto.randomBytes(4).toString("hex");
    await db
      .update(conversationsTable)
      .set({ inviteCode })
      .where(eq(conversationsTable.id, id));
  }

  res.json(GenerateInviteCodeResponse.parse({ inviteCode }));
});

/** GET /invites/:code — Get group details using an invite code */
router.get("/invites/:code", async (req, res): Promise<void> => {
  const { code } = req.params;
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.inviteCode, code),
  });
  if (!conv || conv.type !== "group") { res.status(404).json({ error: "Invite code invalid or expired" }); return; }

  // Get member count
  const memberRows = await db
    .select({ id: conversationMembersTable.id })
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.conversationId, conv.id));

  res.json(GetInviteDetailsResponse.parse({
    id: conv.id,
    name: conv.name ?? "Group Chat",
    iconUrl: conv.iconUrl ?? null,
    memberCount: memberRows.length,
  }));
});

/** POST /invites/:code/join — Join a group chat using an invite code */
router.post("/invites/:code/join", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { code } = req.params;
  if (!code) { res.status(400).json({ error: "Code required" }); return; }

  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.inviteCode, code),
  });
  if (!conv || conv.type !== "group") { res.status(404).json({ error: "Invite code invalid or expired" }); return; }

  const alreadyMember = await isMember(conv.id, user.id);
  if (!alreadyMember) {
    await db
      .insert(conversationMembersTable)
      .values({
        conversationId: conv.id,
        userId: user.id,
      })
      .onConflictDoNothing();
  }

  res.json(JoinGroupByInviteCodeResponse.parse({
    conversationId: conv.id,
  }));
});

export default router;
