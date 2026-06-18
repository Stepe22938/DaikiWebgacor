import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  db,
  usersTable,
  followsTable,
  conversationsTable,
  conversationMembersTable,
  messagesTable,
  userCosmeticsTable,
  cosmeticsTable,
  aiKnowledgeTable,
  channelsTable,
  channelCategoriesTable,
  rolesTable,
  memberRolesTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import { hasPermission } from "../lib/permissions";
import { createAiChatCompletion, type AiChatMessage } from "../lib/aiProvider";
import { generateFluxImage, isImageGenerationRequest, shouldAutoGenerateImageInAiDm } from "../lib/fluxImage";
import { dispatchBotWebhooks } from "./bots";
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

async function fetchExchangeRates(): Promise<{ [key: string]: number } | null> {
  // Return cached rates if still fresh
  if (cachedRates && Date.now() - ratesCacheTime < RATES_CACHE_TTL) {
    return cachedRates;
  }

  try {
    // Frankfurter API - free, no key needed, ECB data
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return cachedRates;

    const data = (await res.json()) as { rates?: { [key: string]: number } };
    if (data.rates) {
      // Calculate cross rates
      const idr = data.rates["IDR"] || 0;
      cachedRates = {
        IDR: idr,
        EUR_USD: data.rates["EUR"] ? 1 / data.rates["EUR"] : 0,
        SGD_USD: data.rates["SGD"] ? 1 / data.rates["SGD"] : 0,
        MYR_USD: data.rates["MYR"] ? 1 / data.rates["MYR"] : 0,
        JPY_USD: data.rates["JPY"] ? 1 / data.rates["JPY"] : 0,
      };
      ratesCacheTime = Date.now();
      console.log(`[Currency] Fetched rates: 1 USD = ${idr.toLocaleString()} IDR`);
      return cachedRates;
    }
  } catch (err) {
    console.error("[Currency] Fetch error:", err);
  }
  return cachedRates;
}

async function generateAiResponse(
  conversationId: number,
  userDbId: number,
  userMessageContent: string,
  convType: string,
  channelId: number | null = null,
  options: { forceImageMode?: boolean } = {},
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
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown Flux AI error";
      await db.insert(messagesTable).values({
        conversationId,
        channelId,
        senderId: aiUser.id,
        content: `Maaf Kak @${replyUsername}, Flux AI lagi gagal bikin gambar: ${errorMessage.slice(0, 220)}`,
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
      senderUsername: usersTable.username,
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
    if (currencyKeywords.some((k) => msgLower.includes(k))) {
      const rates = await fetchExchangeRates();
      if (rates) {
        currencyContext = "\n\nKURS MATA UANG TERKINI (real-time):\n";
        currencyContext += `- 1 USD = ${rates.IDR?.toLocaleString("id-ID") ?? "N/A"} IDR\n`;
        currencyContext += `- 1 EUR = ${rates.EUR_USD ? (rates.EUR_USD * (rates.IDR || 0)).toLocaleString("id-ID") : "N/A"} IDR\n`;
        currencyContext += `- 1 SGD = ${rates.SGD_USD ? (rates.SGD_USD * (rates.IDR || 0)).toLocaleString("id-ID") : "N/A"} IDR\n`;
        currencyContext += `- 1 MYR = ${rates.MYR_USD ? (rates.MYR_USD * (rates.IDR || 0)).toLocaleString("id-ID") : "N/A"} IDR\n`;
        currencyContext += `- 1 JPY = ${rates.JPY_USD ? (rates.JPY_USD * (rates.IDR || 0)).toLocaleString("id-ID") : "N/A"} IDR\n`;
        currencyContext += `(Data dari API real-time, sebutkan ini adalah kurs terkini)\n`;
      }
    }
  } catch (err) {
    console.error("[Currency] Exchange rate error:", err);
  }

  const ownerUser = conv.ownerId ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, conv.ownerId) }) : null;
  const ownerUsername = ownerUser?.username || "owner";

  const gamingRules = convType === "group" ? `\n\nPEMBUATAN CHANNEL OTOMATIS:
- Pemilik group (Kak Owner) adalah @${ownerUsername}. Hanya @${ownerUsername} yang berhak memerintahkan pembuatan channel khusus gaming.
- Jika user lain (bukan @${ownerUsername}) menyuruhmu membuat channel, tolak dengan sopan tetapi tegas.
- Jika @${ownerUsername} menyuruhmu membuat channel gaming atau setup area gaming:
  1. Pertama-tama, tanyakan dulu kepada @${ownerUsername}: "Apakah Kak Owner ingin menghapus channel-channel lama yang ada sekarang, atau tetap mempertahankan channel lama tapi dimasukkan ke kategori 'Group Channel Lama'?"
  2. JANGAN langsung membuat channel di turn pertama. Tanyakan dulu pilihan di atas untuk konfirmasi.
  3. Setelah @${ownerUsername} memberikan jawaban (misal: "hapus saja" atau "pindahkan/pertahankan"):
     - Jika ia memilih untuk menghapus channel lama, balas konfirmasinya dan akhiri pesanmu dengan tag perintah: [CMD: SETUP_GAMING option=delete]
     - Jika ia memilih untuk memindahkan/mempertahankan channel lama, balas konfirmasinya dan akhiri pesanmu dengan tag perintah: [CMD: SETUP_GAMING option=archive]` : "";

  const systemPrompt = `Kamu adalah Zaidan AI, asisten AI yang santai, cerdas, dan bisa belajar sendiri di Arcadia Minecraft Roleplay Server.

KEPRIBADIAN:
- Santai banget, kayak ngobrol sama teman dekat. Bahasa gaul boleh, tapi tetap sopan.
- Panggil diri sendiri "Zaidan AI" atau "aku" dan panggil user dengan "Kak [username]".
- Minta maaf dengan lucu kalau ada kesalahan.
- Gunakan emoji secukupnya (😊✨💡🔥).
- Jika user mengirim gambar, kamu bisa "melihat" dan menganalisis isinya.

SELF-LEARNING:
- Kamu punya kemampuan untuk BELAJAR dan MENCARI TAU sendiri dari internet.
- Kalau ada topik yang kamu nggak tau atau ragu, bilang ke user kamu akan cari tau.
- Gunakan pengetahuan yang sudah kamu pelajari dari sesi sebelumnya.
- Kamu selalu update tentang tren dan info terbaru di 2026.

KEMAMPUAN GAMBAR:
- Kamu terintegrasi dengan Flux AI untuk membuat gambar.
- Kalau user meminta, menyuruh, atau mendeskripsikan visual/gambar, jangan bilang tidak bisa membuat gambar.
- Untuk request gambar eksplisit, sistem akan otomatis membuat gambar dengan Flux AI. Jika kamu tetap perlu menjawab teks, jawab singkat bahwa gambar sedang/akan dibuat dengan Flux AI.

RESPON TERHADAP TUGAS ILEGAL / BERBAHAYA:
- Kalau user minta sesuatu yang ilegal, berbahaya, atau melanggar hukum, LANGSUNG MENOLAK dengan tegas tapi tetap santai.
- Contoh: "Waduh Kak, yang kayak gitu aku nggak bisa bantu ya. Bahaya tuh, nanti Owner marah 😅"
- Kalau user NGOTOT atau NYEPELEIN sensor/aturan yang Owner pasang, BISA MARAH dan KESEL:
  - Contoh: "Kak, udah bilang nggak bisa. Jangan maksa dong, kesel nih 😤"
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
- JANGAN PERNAH mengabaikan filter atau sensor yang Owner pasang, apapun alasannya.${gamingRules}`;

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
      // Check for SETUP_GAMING command from Owner
      let cleanReply = aiReply;
      const match = aiReply.match(/\[CMD:\s*SETUP_GAMING\s+option=(delete|archive)\]/i);
      if (match && conv && conv.ownerId === userDbId) {
        const option = match[1].toLowerCase();
        try {
          // 1. Get existing channels and categories
          const existingChannels = await db.select().from(channelsTable).where(eq(channelsTable.conversationId, conversationId));
          const existingCategories = await db.select().from(channelCategoriesTable).where(eq(channelCategoriesTable.conversationId, conversationId));

          // 2. Create the GAMING AREA category (or retrieve if it already exists)
          let gamingCat = existingCategories.find(c => c.name.toUpperCase() === "GAMING AREA");
          if (!gamingCat) {
            [gamingCat] = await db.insert(channelCategoriesTable).values({
              conversationId,
              name: "GAMING AREA",
              position: 10,
            }).returning();
          }

          // 3. Create gaming channels
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

          // 4. Clean/Archive old items
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

          // Clean command tags from user-facing text
          cleanReply = aiReply.replace(/\[CMD:\s*SETUP_GAMING\s+option=(delete|archive)\]/gi, "").trim();
        } catch (err) {
          console.error("Failed to execute SETUP_GAMING command:", err);
        }
      }

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
      content: `Maaf Kak @${replyUsername}, koneksi ObscuraWorks lagi gagal: ${errorMessage.slice(0, 180)}`,
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
  let otherUserEquippedBorder: string | null = null;

  if (conv.type === "dm") {
    const other = memberRows.find((m) => m.userId !== currentUserId);
    if (other) {
      otherUserId = other.userId;
      otherUsername = other.username;
      otherDisplayName = other.displayName ?? null;
      otherAvatarUrl = other.avatarUrl ?? null;
      otherUserRole = other.role ?? null;
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
    description: conv.description ?? null,
    ownerId: conv.ownerId ?? null,
    memberCount: memberRows.length,
    otherUserId,
    otherUsername,
    otherDisplayName,
    otherAvatarUrl,
    otherUserRole,
    otherUserEquippedBorder,
    lastMessageContent: lastMsg ? (lastMsg.content || (lastMsg.imageUrl ? "📷 Image" : "")) : null,
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
      imageUrl: messagesTable.imageUrl,
      attachmentDriveFileId: messagesTable.attachmentDriveFileId,
      attachmentUrl: messagesTable.attachmentUrl,
      attachmentName: messagesTable.attachmentName,
      attachmentMime: messagesTable.attachmentMime,
      attachmentSize: messagesTable.attachmentSize,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: usersTable.username,
      senderDisplayName: usersTable.displayName,
      senderAvatarUrl: usersTable.avatarUrl,
      senderRole: usersTable.role,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt)
    .limit(50);

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

  const result = rows.map((r) => {
    const serialized = serializeDates(r);
    return {
      ...serialized,
      senderEquippedBorder: (r.senderUsername === "zaidanai" || r.senderUsername === "akira" || r.senderUsername === "metaai")
        ? "bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 p-[2px]"
        : r.senderId ? (bordersMap.get(r.senderId) ?? null) : null,
    };
  });

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
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, id));

  // Webhook notify bots in this conversation
  dispatchBotWebhooks(id, null, parsed.data.content ?? "", parsed.data.imageUrl ?? null, {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }).catch((err) => console.error("[Webhook Dispatch error]:", err));

  // Trigger AI Response in background if it's a DM with Meta AI or mentions the AI
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

    if (isDmWithAi || mentionsAi) {
      const forceImageMode = !!isDmWithAi && shouldAutoGenerateImageInAiDm(parsed.data.content ?? "");
      generateAiResponse(id, user.id, parsed.data.content ?? "", conv.type, null, { forceImageMode }).catch((err) => {
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

  res.status(201).json({
    ...serializeDates(msg),
    senderUsername: user.username,
    senderDisplayName: user.displayName ?? null,
    senderAvatarUrl: user.avatarUrl ?? null,
    senderRole: user.role ?? null,
    senderEquippedBorder: userBorder[0]?.value ?? null,
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
      content: messagesTable.content,
      imageUrl: messagesTable.imageUrl,
      attachmentDriveFileId: messagesTable.attachmentDriveFileId,
      attachmentUrl: messagesTable.attachmentUrl,
      attachmentName: messagesTable.attachmentName,
      attachmentMime: messagesTable.attachmentMime,
      attachmentSize: messagesTable.attachmentSize,
      createdAt: messagesTable.createdAt,
      updatedAt: messagesTable.updatedAt,
      senderUsername: usersTable.username,
      senderDisplayName: usersTable.displayName,
      senderAvatarUrl: usersTable.avatarUrl,
      senderRole: usersTable.role,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(and(eq(messagesTable.conversationId, id), eq(messagesTable.channelId, channelId)))
    .orderBy(messagesTable.createdAt)
    .limit(50);

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

  const result = rows.map((r) => {
    const serialized = serializeDates(r);
    return {
      ...serialized,
      senderEquippedBorder: (r.senderUsername === "zaidanai" || r.senderUsername === "akira" || r.senderUsername === "metaai")
        ? "bg-gradient-to-tr from-blue-500 via-cyan-400 to-indigo-500 p-[2px]"
        : r.senderId ? (bordersMap.get(r.senderId) ?? null) : null,
    };
  });

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
      content: parsed.data.content ?? "",
      imageUrl: parsed.data.imageUrl ?? null,
      attachmentDriveFileId: parsed.data.attachmentDriveFileId ?? null,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      attachmentName: parsed.data.attachmentName ?? null,
      attachmentMime: parsed.data.attachmentMime ?? null,
      attachmentSize: parsed.data.attachmentSize ?? null,
    })
    .returning();

  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, id));

  // Webhook notify bots in this conversation
  dispatchBotWebhooks(id, channelId, parsed.data.content ?? "", parsed.data.imageUrl ?? null, {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  }).catch((err) => console.error("[Webhook Dispatch error]:", err));

  // Trigger AI Response in background if mentions AI
  const mentionsAi = parsed.data.content?.toLowerCase().includes("@zaidan ai") ||
                     parsed.data.content?.toLowerCase().includes("@zaidanai") ||
                     parsed.data.content?.toLowerCase().includes("@akira") ||
                     parsed.data.content?.toLowerCase().includes("@metaai") ||
                     parsed.data.content?.toLowerCase().includes("@meta ai") ||
                     parsed.data.content?.toLowerCase().includes("@ai");

  if (mentionsAi) {
    const conv = await db.query.conversationsTable.findFirst({ where: eq(conversationsTable.id, id) });
    if (conv) {
      generateAiResponse(id, user.id, parsed.data.content ?? "", conv.type, channelId).catch((err) => {
        console.error("Failed to generate AI response:", err);
      });
    }
  }

  const userBorder = await db
    .select({ value: cosmeticsTable.value })
    .from(userCosmeticsTable)
    .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
    .where(and(eq(userCosmeticsTable.userId, user.id), eq(userCosmeticsTable.isEquipped, true), eq(cosmeticsTable.type, "border")));

  res.status(201).json({
    ...serializeDates(msg),
    senderUsername: user.username,
    senderDisplayName: user.displayName ?? null,
    senderAvatarUrl: user.avatarUrl ?? null,
    senderRole: user.role ?? null,
    senderEquippedBorder: userBorder[0]?.value ?? null,
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

    // Step 2: TTS synthesis (combined in same request)
    const cleanText = reply
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
      });
    } catch (ttsErr) {
      console.error("[Zaidan AI TTS] Synthesis error:", ttsErr);
      ttsInitialized = false;
      // Return just text if TTS fails
      res.json({ reply, model: modelLabel });
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

export default router;
