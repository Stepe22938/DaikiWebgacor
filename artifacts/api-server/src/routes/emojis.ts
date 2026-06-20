import { Router, type IRouter } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  conversationMembersTable,
  conversationsTable,
  db,
  emojisTable,
  storageObjectsTable,
  storagePoolsTable,
  usersTable,
} from "@workspace/db";
import { getAuth } from "../lib/auth";
import { hasPermission } from "../lib/permissions";
import { getDriveDownloadResponse, uploadFileToDrive, deleteFileFromDrive } from "../lib/googleDrive";
import { getUserUploadPolicy, ensureDefaultSharedStoragePool } from "../lib/tierBoosts";

const router: IRouter = Router();
const tempUploadDir = path.resolve(import.meta.dirname, "../../tmp/emoji-uploads");
fs.mkdirSync(tempUploadDir, { recursive: true });

const upload = multer({
  dest: tempUploadDir,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max for emojis
});

const EMOJI_IMAGE_MIMES = new Set(["image/png", "image/webp", "image/jpeg", "image/gif"]);

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

async function assertConversationMember(conversationId: number, userId: number) {
  return db.query.conversationMembersTable.findFirst({
    where: and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, userId),
    ),
  });
}

async function assertConversationOwnerOrManageMessages(conversationId: number, userId: number) {
  const conv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, conversationId),
  });
  if (!conv) return false;
  if (conv.ownerId === userId) return true;
  return hasPermission(conversationId, userId, "manageMessages");
}

export async function deleteEmojiResources(driveFileId: string, sizeBytes: number) {
  try {
    await deleteFileFromDrive(driveFileId);
  } catch (err) {
    console.error(`[deleteEmojiResources] Failed to delete file ${driveFileId} from Google Drive:`, err);
  }

  try {
    await db.delete(storageObjectsTable).where(eq(storageObjectsTable.providerFileId, driveFileId));
  } catch (err) {
    console.error(`[deleteEmojiResources] Failed to delete storage object for ${driveFileId}:`, err);
  }

  try {
    const pool = await ensureDefaultSharedStoragePool();
    if (pool) {
      await db.update(storagePoolsTable)
        .set({
          usedBytes: sql`GREATEST(0, ${storagePoolsTable.usedBytes} - ${sizeBytes})`,
          updatedAt: new Date(),
        })
        .where(eq(storagePoolsTable.id, pool.id));
    }
  } catch (err) {
    console.error(`[deleteEmojiResources] Failed to update storage pool for ${driveFileId}:`, err);
  }
}

router.get("/emojis", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Get all conversation IDs the user is a member of
  const myMemberships = await db
    .select({ conversationId: conversationMembersTable.conversationId })
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, user.id));
  const myGroupIds = myMemberships.map((m) => m.conversationId).filter(Boolean) as number[];

  if (myGroupIds.length === 0) {
    res.json({ emojis: [] });
    return;
  }

  const emojis = await db
    .select({
      id: emojisTable.id,
      name: emojisTable.name,
      conversationId: emojisTable.conversationId,
      conversationName: conversationsTable.name,
      conversationIcon: conversationsTable.iconUrl,
      ownerUserId: emojisTable.ownerUserId,
      assetUrl: emojisTable.assetUrl,
      mimeType: emojisTable.mimeType,
      sizeBytes: emojisTable.sizeBytes,
      createdAt: emojisTable.createdAt,
    })
    .from(emojisTable)
    .leftJoin(conversationsTable, eq(emojisTable.conversationId, conversationsTable.id))
    .where(and(isNull(emojisTable.deletedAt), inArray(emojisTable.conversationId, myGroupIds)))
    .orderBy(desc(emojisTable.createdAt));

  res.json({ emojis });
});

router.post("/emojis/upload", upload.single("file"), async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const file = req.file;
  if (!file) { res.status(400).json({ error: "No emoji file uploaded" }); return; }

  try {
    const conversationId = req.body.conversationId ? Number(req.body.conversationId) : null;
    const requestedName = String(req.body.name || file.originalname || "emoji")
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "") // Emojis should have simple alphanumeric/underscore names
      .toLowerCase();
    const emojiName = requestedName.slice(0, 40);

    if (!emojiName) {
      res.status(400).json({ error: "Emoji name is required and must contain alphanumeric characters or underscores" });
      return;
    }

    if (!EMOJI_IMAGE_MIMES.has(file.mimetype || "")) {
      res.status(400).json({ error: "Emoji must be PNG, WEBP, JPG, or GIF" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      res.status(400).json({ error: "Emoji file size cannot exceed 2MB" });
      return;
    }

    if (!conversationId) {
      res.status(400).json({ error: "Group ID (conversationId) is required to upload emojis" });
      return;
    }

    const conv = await db.query.conversationsTable.findFirst({
      where: eq(conversationsTable.id, conversationId),
    });
    if (!conv) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    if (conv.ownerId !== user.id) {
      res.status(403).json({ error: "Only the group owner/creator can upload custom emojis." });
      return;
    }

    // Check count limits per group if needed (e.g. max 50 emojis per group)
    const currentCountRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(emojisTable)
      .where(and(eq(emojisTable.conversationId, conversationId), isNull(emojisTable.deletedAt)));
    const currentCount = Number(currentCountRow[0]?.count ?? 0);
    if (currentCount >= 50) {
      res.status(400).json({ error: "Slot emoji kustom penuh (maksimal 50 emoji per grup)" });
      return;
    }

    const driveFile = await uploadFileToDrive({
      filePath: file.path,
      fileName: `${Date.now()}-emoji-${file.originalname || "emoji"}`,
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size,
    });

    const pool = await ensureDefaultSharedStoragePool();
    if (!pool) throw new Error("Shared storage not found");

    await db.insert(storageObjectsTable).values({
      poolId: pool.id,
      ownerUserId: user.id,
      providerFileId: driveFile.id,
      objectKey: driveFile.id,
      originalName: emojiName,
      mimeType: driveFile.mimeType,
      sizeBytes: driveFile.size,
      validationStatus: "validated",
      visibilityScope: "private",
      uploadedVia: "proxy",
      validatedAt: new Date(),
    });

    await db.update(storagePoolsTable)
      .set({
        usedBytes: sql`${storagePoolsTable.usedBytes} + ${driveFile.size}`,
        updatedAt: new Date(),
      })
      .where(eq(storagePoolsTable.id, pool.id));

    const assetUrl = `/api/emojis/${driveFile.id}/asset`;

    const [emoji] = await db.insert(emojisTable).values({
      ownerUserId: user.id,
      conversationId: conversationId,
      name: emojiName,
      driveFileId: driveFile.id,
      assetUrl,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    }).returning();

    res.status(201).json({
      id: emoji.id,
      name: emoji.name,
      conversationId: emoji.conversationId,
      assetUrl: emoji.assetUrl,
      mimeType: emoji.mimeType,
      sizeBytes: emoji.sizeBytes,
      createdAt: emoji.createdAt,
    });
  } catch (err: any) {
    console.error("[emoji upload error]", err);
    res.status(500).json({ error: err.message || "Failed to upload emoji" });
  } finally {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch {}
  }
});

router.get("/emojis/:fileId/asset", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const fileId = req.params.fileId as string;
  const emoji = await db.query.emojisTable.findFirst({
    where: and(eq(emojisTable.driveFileId, fileId), isNull(emojisTable.deletedAt)),
  });

  if (!emoji) {
    res.status(404).json({ error: "Emoji not found" });
    return;
  }

  // Check if member of conversation
  if (emoji.conversationId) {
    const member = await assertConversationMember(emoji.conversationId, user.id);
    if (!member) {
      res.status(403).json({ error: "Emoji access denied" });
      return;
    }
  }

  const driveResponse = await getDriveDownloadResponse(fileId);
  if (!driveResponse.ok || !driveResponse.body) {
    res.status(driveResponse.status).json({ error: "Failed to stream emoji asset" });
    return;
  }

  res.setHeader("Content-Type", emoji.mimeType || driveResponse.headers.get("content-type") || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=3600");
  Readable.fromWeb(driveResponse.body as any).pipe(res);
});

router.delete("/emojis/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const emojiId = Number(req.params.id);
  if (!Number.isFinite(emojiId)) {
    res.status(400).json({ error: "Invalid emoji id" });
    return;
  }

  const emoji = await db.query.emojisTable.findFirst({
    where: and(eq(emojisTable.id, emojiId), isNull(emojisTable.deletedAt)),
  });
  if (!emoji) {
    res.status(404).json({ error: "Emoji not found" });
    return;
  }

  const canDeleteOwnEmoji = emoji.ownerUserId === user.id;
  const canDeleteGroupEmoji = !!emoji.conversationId && await assertConversationOwnerOrManageMessages(emoji.conversationId, user.id);
  if (!canDeleteOwnEmoji && !canDeleteGroupEmoji) {
    res.status(403).json({ error: "Kamu tidak punya izin untuk hapus emoji ini" });
    return;
  }

  await db.update(emojisTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(emojisTable.id, emojiId));

  // Perform async resource deletion
  void deleteEmojiResources(emoji.driveFileId, emoji.sizeBytes);

  res.json({ success: true });
});

router.patch("/emojis/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const emojiId = Number(req.params.id);
  if (!Number.isFinite(emojiId)) {
    res.status(400).json({ error: "Invalid emoji id" });
    return;
  }

  const emoji = await db.query.emojisTable.findFirst({
    where: and(eq(emojisTable.id, emojiId), isNull(emojisTable.deletedAt)),
  });
  if (!emoji) {
    res.status(404).json({ error: "Emoji not found" });
    return;
  }

  const canEditOwnEmoji = emoji.ownerUserId === user.id;
  const canEditGroupEmoji = !!emoji.conversationId && await assertConversationOwnerOrManageMessages(emoji.conversationId, user.id);
  if (!canEditOwnEmoji && !canEditGroupEmoji) {
    res.status(403).json({ error: "Kamu tidak punya izin untuk edit emoji ini" });
    return;
  }

  const nextName = typeof req.body?.name === "string"
    ? req.body.name.trim().replace(/[^a-zA-Z0-9_]/g, "").toLowerCase().slice(0, 40)
    : emoji.name;

  if (!nextName) {
    res.status(400).json({ error: "Emoji name must contain alphanumeric characters or underscores" });
    return;
  }

  const [updated] = await db.update(emojisTable)
    .set({
      name: nextName,
      updatedAt: new Date(),
    })
    .where(eq(emojisTable.id, emojiId))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    conversationId: updated.conversationId,
    assetUrl: updated.assetUrl,
    mimeType: updated.mimeType,
    sizeBytes: updated.sizeBytes,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

export default router;
