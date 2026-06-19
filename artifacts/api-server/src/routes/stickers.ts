import { Router, type IRouter } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  conversationMembersTable,
  conversationsTable,
  db,
  stickersTable,
  storageObjectsTable,
  storagePoolsTable,
  usersTable,
} from "@workspace/db";
import { getAuth } from "../lib/auth";
import { hasPermission } from "../lib/permissions";
import { getDriveDownloadResponse, uploadFileToDrive } from "../lib/googleDrive";
import { getUserUploadPolicy, ensureDefaultSharedStoragePool } from "../lib/tierBoosts";

const router: IRouter = Router();
const tempUploadDir = path.resolve(import.meta.dirname, "../../tmp/sticker-uploads");
fs.mkdirSync(tempUploadDir, { recursive: true });

const upload = multer({
  dest: tempUploadDir,
  limits: { fileSize: 4 * 1024 * 1024 },
});

const STICKER_IMAGE_MIMES = new Set(["image/png", "image/webp", "image/jpeg", "image/gif"]);

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

function parseEditorConfig(input: unknown) {
  if (typeof input === "string") {
    if (!input.trim()) return {};
    try {
      return JSON.parse(input);
    } catch {
      return {};
    }
  }
  if (input && typeof input === "object") return input;
  return {};
}

router.get("/stickers", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const mode = String(req.query.mode || "");
  const conversationId = req.query.conversationId ? Number(req.query.conversationId) : null;

  const policy = await getUserUploadPolicy(user.id);
  const entitlements = {
    tier: policy.tier,
    stickerSyncMode: policy.stickerSyncMode,
    maxStickerCount: policy.maxStickerCount,
    maxStickerFileBytes: policy.maxStickerFileBytes,
    canUseAnimatedStickers: policy.canUseAnimatedStickers,
  };

  if (mode === "owned") {
    const owned = await db
      .select({
        id: stickersTable.id,
        name: stickersTable.name,
        scope: stickersTable.scope,
        conversationId: stickersTable.conversationId,
        originStickerId: stickersTable.originStickerId,
        originConversationId: stickersTable.originConversationId,
        assetUrl: stickersTable.assetUrl,
        mimeType: stickersTable.mimeType,
        sizeBytes: stickersTable.sizeBytes,
        editorConfig: stickersTable.editorConfig,
        createdAt: stickersTable.createdAt,
        conversationName: conversationsTable.name,
      })
      .from(stickersTable)
      .leftJoin(conversationsTable, eq(stickersTable.conversationId, conversationsTable.id))
      .where(and(eq(stickersTable.ownerUserId, user.id), isNull(stickersTable.deletedAt)))
      .orderBy(desc(stickersTable.createdAt));

    res.json({ entitlements, stickers: owned });
    return;
  }

  if (conversationId) {
    const member = await assertConversationMember(conversationId, user.id);
    if (!member) {
      res.status(403).json({ error: "Not a member of this group" });
      return;
    }

    const stickers = await db
      .select({
        id: stickersTable.id,
        name: stickersTable.name,
        scope: stickersTable.scope,
        conversationId: stickersTable.conversationId,
        originStickerId: stickersTable.originStickerId,
        originConversationId: stickersTable.originConversationId,
        ownerUserId: stickersTable.ownerUserId,
        assetUrl: stickersTable.assetUrl,
        mimeType: stickersTable.mimeType,
        sizeBytes: stickersTable.sizeBytes,
        editorConfig: stickersTable.editorConfig,
        createdAt: stickersTable.createdAt,
      })
      .from(stickersTable)
      .where(and(
        isNull(stickersTable.deletedAt),
        or(
          and(eq(stickersTable.scope, "global_cross_server"), eq(stickersTable.ownerUserId, user.id)),
          and(eq(stickersTable.scope, "local_server"), eq(stickersTable.conversationId, conversationId)),
        ),
      ))
      .orderBy(desc(stickersTable.createdAt));

    res.json({ entitlements, stickers });
    return;
  }

  const stickers = await db
    .select({
      id: stickersTable.id,
      name: stickersTable.name,
      scope: stickersTable.scope,
      conversationId: stickersTable.conversationId,
      originStickerId: stickersTable.originStickerId,
      originConversationId: stickersTable.originConversationId,
      ownerUserId: stickersTable.ownerUserId,
      assetUrl: stickersTable.assetUrl,
      mimeType: stickersTable.mimeType,
      sizeBytes: stickersTable.sizeBytes,
      editorConfig: stickersTable.editorConfig,
      createdAt: stickersTable.createdAt,
    })
    .from(stickersTable)
    .where(and(
      isNull(stickersTable.deletedAt),
      eq(stickersTable.scope, "global_cross_server"),
      eq(stickersTable.ownerUserId, user.id),
    ))
    .orderBy(desc(stickersTable.createdAt));

  res.json({ entitlements, stickers });
});

router.post("/stickers/upload", upload.single("file"), async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const file = req.file;
  if (!file) { res.status(400).json({ error: "No sticker file uploaded" }); return; }

  try {
    const policy = await getUserUploadPolicy(user.id);
    const conversationId = req.body.conversationId ? Number(req.body.conversationId) : null;
    const requestedScope = String(req.body.scope || "").toLowerCase();
    const requestedName = String(req.body.name || file.originalname || "sticker").trim();
    const stickerName = requestedName.slice(0, 40);
    const editorConfig = parseEditorConfig(req.body.editorConfig);

    if (!stickerName) {
      res.status(400).json({ error: "Sticker name is required" });
      return;
    }

    if (!STICKER_IMAGE_MIMES.has(file.mimetype || "")) {
      res.status(400).json({ error: "Sticker must be PNG, WEBP, JPG, or GIF" });
      return;
    }

    if (file.size > policy.maxStickerFileBytes) {
      res.status(400).json({ error: `Sticker terlalu besar. Maks ${Math.round(policy.maxStickerFileBytes / 1024 / 1024 * 10) / 10}MB untuk tier ${policy.label}.` });
      return;
    }

    const isAnimated = file.mimetype === "image/gif";
    if (isAnimated && !policy.canUseAnimatedStickers) {
      res.status(400).json({ error: "Animated stickers khusus Premium+." });
      return;
    }

    if (policy.tier === "premium_plus") {
      res.status(403).json({
        error: "Premium+ tidak bisa upload sticker baru. Gunakan sticker yang sudah ada lalu share ke group lain.",
      });
      return;
    }

    let scope: "local_server" | "global_cross_server" = "local_server";
    let scopedConversationId: number | null = null;

    if (policy.tier === "premium") {
      scope = "global_cross_server";
    } else {
      if (!conversationId) {
        res.status(400).json({ error: "User biasa harus pilih group untuk sticker lokal." });
        return;
      }
      const canManage = await assertConversationOwnerOrManageMessages(conversationId, user.id);
      if (!canManage) {
        res.status(403).json({ error: "Hanya owner group atau member dengan Manage Messages yang bisa bikin sticker lokal." });
        return;
      }
      scopedConversationId = conversationId;
    }

    if (requestedScope === "local" || requestedScope === "local_server") {
      if (policy.tier === "premium") {
        res.status(400).json({ error: "Premium hanya bisa bikin sticker global lintas group." });
        return;
      }
      scope = "local_server";
    }

    if (requestedScope === "global" || requestedScope === "global_cross_server") {
      if (policy.tier !== "premium") {
        res.status(400).json({ error: "Sticker global hanya untuk Premium." });
        return;
      }
      scope = "global_cross_server";
      scopedConversationId = null;
    }

    const currentCountRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(stickersTable)
      .where(and(eq(stickersTable.ownerUserId, user.id), isNull(stickersTable.deletedAt)));
    const currentCount = Number(currentCountRow[0]?.count ?? 0);
    if (currentCount >= policy.maxStickerCount) {
      res.status(400).json({ error: `Slot sticker penuh. Maks ${policy.maxStickerCount} sticker untuk tier ${policy.label}.` });
      return;
    }

    const driveFile = await uploadFileToDrive({
      filePath: file.path,
      fileName: `${Date.now()}-${file.originalname || "sticker"}`,
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
      originalName: stickerName,
      mimeType: driveFile.mimeType,
      sizeBytes: driveFile.size,
      validationStatus: "validated",
      visibilityScope: scope === "global_cross_server" ? "public" : "private",
      uploadedVia: "proxy",
      validatedAt: new Date(),
    });

    await db.update(storagePoolsTable)
      .set({
        usedBytes: sql`${storagePoolsTable.usedBytes} + ${driveFile.size}`,
        updatedAt: new Date(),
      })
      .where(eq(storagePoolsTable.id, pool.id));

    const [sticker] = await db.insert(stickersTable).values({
      ownerUserId: user.id,
      conversationId: scopedConversationId,
      originConversationId: scopedConversationId,
      scope,
      name: stickerName,
      driveFileId: driveFile.id,
      assetUrl: `/api/stickers/${driveFile.id}/asset`,
      mimeType: driveFile.mimeType,
      sizeBytes: driveFile.size,
      editorConfig,
    }).returning();

    res.json({
      id: sticker.id,
      name: sticker.name,
      scope: sticker.scope,
      conversationId: sticker.conversationId,
      assetUrl: sticker.assetUrl,
      mimeType: sticker.mimeType,
      sizeBytes: sticker.sizeBytes,
      createdAt: sticker.createdAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload sticker";
    res.status(500).json({ error: message });
  } finally {
    fs.promises.unlink(file.path).catch(() => {});
  }
});

router.get("/stickers/:fileId/asset", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const fileId = req.params.fileId as string;
  const sticker = await db.query.stickersTable.findFirst({
    where: and(eq(stickersTable.driveFileId, fileId), isNull(stickersTable.deletedAt)),
  });

  if (!sticker) {
    res.status(404).json({ error: "Sticker not found" });
    return;
  }

  if (sticker.scope === "global_cross_server") {
    // Any logged-in user can render a global sticker that has been sent/shared.
  } else {
    if (!sticker.conversationId) {
      res.status(403).json({ error: "Sticker access denied" });
      return;
    }
    const member = await assertConversationMember(sticker.conversationId, user.id);
    if (!member) {
      res.status(403).json({ error: "Sticker access denied" });
      return;
    }
  }

  const driveResponse = await getDriveDownloadResponse(fileId);
  if (!driveResponse.ok || !driveResponse.body) {
    res.status(driveResponse.status).json({ error: "Failed to stream sticker asset" });
    return;
  }

  res.setHeader("Content-Type", sticker.mimeType || driveResponse.headers.get("content-type") || "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=3600");
  Readable.fromWeb(driveResponse.body as any).pipe(res);
});

router.delete("/stickers/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const stickerId = Number(req.params.id);
  if (!Number.isFinite(stickerId)) {
    res.status(400).json({ error: "Invalid sticker id" });
    return;
  }

  const sticker = await db.query.stickersTable.findFirst({
    where: and(eq(stickersTable.id, stickerId), isNull(stickersTable.deletedAt)),
  });
  if (!sticker) {
    res.status(404).json({ error: "Sticker not found" });
    return;
  }

  const canDeleteOwnSticker = sticker.ownerUserId === user.id;
  const canDeleteGroupSticker = !!sticker.conversationId && await assertConversationOwnerOrManageMessages(sticker.conversationId, user.id);
  if (!canDeleteOwnSticker && !canDeleteGroupSticker) {
    res.status(403).json({ error: "Kamu tidak punya izin untuk hapus sticker ini" });
    return;
  }

  await db.update(stickersTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(stickersTable.id, stickerId));

  res.json({ success: true });
});

router.patch("/stickers/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const stickerId = Number(req.params.id);
  if (!Number.isFinite(stickerId)) {
    res.status(400).json({ error: "Invalid sticker id" });
    return;
  }

  const sticker = await db.query.stickersTable.findFirst({
    where: and(eq(stickersTable.id, stickerId), isNull(stickersTable.deletedAt)),
  });
  if (!sticker) {
    res.status(404).json({ error: "Sticker not found" });
    return;
  }

  const canEditOwnSticker = sticker.ownerUserId === user.id;
  const canEditGroupSticker = !!sticker.conversationId && await assertConversationOwnerOrManageMessages(sticker.conversationId, user.id);
  if (!canEditOwnSticker && !canEditGroupSticker) {
    res.status(403).json({ error: "Kamu tidak punya izin untuk edit sticker ini" });
    return;
  }

  const nextName = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 40) : sticker.name;
  const nextEditorConfig = req.body?.editorConfig !== undefined ? parseEditorConfig(req.body.editorConfig) : sticker.editorConfig;

  const [updated] = await db.update(stickersTable)
    .set({
      name: nextName || sticker.name,
      editorConfig: nextEditorConfig,
      updatedAt: new Date(),
    })
    .where(eq(stickersTable.id, stickerId))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    scope: updated.scope,
    conversationId: updated.conversationId,
    originStickerId: updated.originStickerId,
    originConversationId: updated.originConversationId,
    assetUrl: updated.assetUrl,
    mimeType: updated.mimeType,
    sizeBytes: updated.sizeBytes,
    editorConfig: updated.editorConfig,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

router.post("/stickers/:id/share", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const policy = await getUserUploadPolicy(user.id);
  if (policy.tier !== "premium_plus") {
    res.status(403).json({ error: "Hanya Premium+ yang bisa share sticker antar group." });
    return;
  }

  const sourceStickerId = Number(req.params.id);
  const targetConversationId = Number(req.body?.conversationId);
  if (!Number.isFinite(sourceStickerId) || !Number.isFinite(targetConversationId)) {
    res.status(400).json({ error: "Sticker source dan target group wajib diisi" });
    return;
  }

  const sourceSticker = await db.query.stickersTable.findFirst({
    where: and(eq(stickersTable.id, sourceStickerId), isNull(stickersTable.deletedAt)),
  });
  if (!sourceSticker) {
    res.status(404).json({ error: "Sticker source tidak ditemukan" });
    return;
  }

  const canReadSource = sourceSticker.ownerUserId === user.id
    || (sourceSticker.conversationId ? !!(await assertConversationMember(sourceSticker.conversationId, user.id)) : false);
  if (!canReadSource) {
    res.status(403).json({ error: "Kamu belum punya akses ke sticker source ini" });
    return;
  }

  const targetMember = await assertConversationMember(targetConversationId, user.id);
  if (!targetMember) {
    res.status(403).json({ error: "Kamu harus jadi member target group dulu" });
    return;
  }

  const targetConv = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, targetConversationId),
  });
  if (!targetConv) {
    res.status(404).json({ error: "Target group tidak ditemukan" });
    return;
  }

  const [sharedSticker] = await db.insert(stickersTable).values({
    ownerUserId: user.id,
    conversationId: targetConversationId,
    originStickerId: sourceSticker.id,
    originConversationId: sourceSticker.conversationId ?? sourceSticker.originConversationId ?? null,
    scope: "local_server",
    name: String(req.body?.name || sourceSticker.name).trim().slice(0, 40) || sourceSticker.name,
    driveFileId: sourceSticker.driveFileId,
    assetUrl: sourceSticker.assetUrl,
    mimeType: sourceSticker.mimeType,
    sizeBytes: sourceSticker.sizeBytes,
    editorConfig: sourceSticker.editorConfig ?? {},
  }).returning();

  res.status(201).json({
    id: sharedSticker.id,
    name: sharedSticker.name,
    scope: sharedSticker.scope,
    conversationId: sharedSticker.conversationId,
    originStickerId: sharedSticker.originStickerId,
    originConversationId: sharedSticker.originConversationId,
    assetUrl: sharedSticker.assetUrl,
    mimeType: sharedSticker.mimeType,
    sizeBytes: sharedSticker.sizeBytes,
    editorConfig: sharedSticker.editorConfig,
    createdAt: sharedSticker.createdAt,
  });
});

export default router;
