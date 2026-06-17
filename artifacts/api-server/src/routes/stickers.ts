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
        assetUrl: stickersTable.assetUrl,
        mimeType: stickersTable.mimeType,
        sizeBytes: stickersTable.sizeBytes,
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
        ownerUserId: stickersTable.ownerUserId,
        assetUrl: stickersTable.assetUrl,
        mimeType: stickersTable.mimeType,
        sizeBytes: stickersTable.sizeBytes,
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
      ownerUserId: stickersTable.ownerUserId,
      assetUrl: stickersTable.assetUrl,
      mimeType: stickersTable.mimeType,
      sizeBytes: stickersTable.sizeBytes,
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
    const requestedName = String(req.body.name || file.originalname || "sticker").trim();
    const stickerName = requestedName.slice(0, 40);

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

    let scope: "local_server" | "global_cross_server" = "local_server";
    let scopedConversationId: number | null = null;

    if (policy.stickerSyncMode === "global_cross_server") {
      scope = "global_cross_server";
    } else {
      if (!conversationId) {
        res.status(400).json({ error: "User biasa harus pilih group untuk sticker lokal." });
        return;
      }
      const member = await assertConversationMember(conversationId, user.id);
      if (!member) {
        res.status(403).json({ error: "Kamu bukan member group target." });
        return;
      }
      scopedConversationId = conversationId;
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
      scope,
      name: stickerName,
      driveFileId: driveFile.id,
      assetUrl: `/api/stickers/${driveFile.id}/asset`,
      mimeType: driveFile.mimeType,
      sizeBytes: driveFile.size,
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
  if (!sticker || sticker.ownerUserId !== user.id) {
    res.status(404).json({ error: "Sticker not found" });
    return;
  }

  await db.update(stickersTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(stickersTable.id, stickerId));

  res.json({ success: true });
});

export default router;
