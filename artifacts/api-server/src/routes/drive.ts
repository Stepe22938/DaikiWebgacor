import { Router, type IRouter } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { getAuth } from "../lib/auth";
import { db, conversationMembersTable, messagesTable, usersTable } from "@workspace/db";
import { getDriveDownloadResponse, uploadFileToDrive } from "../lib/googleDrive";

const router: IRouter = Router();
const tempUploadDir = path.resolve(import.meta.dirname, "../../tmp/drive-uploads");
fs.mkdirSync(tempUploadDir, { recursive: true });

const maxFileSizeMb = Number(process.env["GOOGLE_DRIVE_UPLOAD_MAX_MB"] || "200");
const upload = multer({
  dest: tempUploadDir,
  limits: { fileSize: maxFileSizeMb * 1024 * 1024 },
});

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

async function userCanAccessDriveFile(fileId: string, userId: number) {
  const rows = await db
    .select({ conversationId: messagesTable.conversationId })
    .from(messagesTable)
    .innerJoin(
      conversationMembersTable,
      and(
        eq(conversationMembersTable.conversationId, messagesTable.conversationId),
        eq(conversationMembersTable.userId, userId),
      ),
    )
    .where(eq(messagesTable.attachmentDriveFileId, fileId))
    .limit(1);

  return rows.length > 0;
}

router.post("/drive/upload", upload.single("file"), async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(403).json({ error: "Forbidden" }); return; }

  const file = req.file;
  if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

  try {
    const driveFile = await uploadFileToDrive({
      filePath: file.path,
      fileName: file.originalname || file.filename,
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size,
    });
    const downloadUrl = `/api/drive/files/${encodeURIComponent(driveFile.id)}/download`;
    res.json({
      driveFileId: driveFile.id,
      url: downloadUrl,
      downloadUrl,
      name: driveFile.name,
      mimeType: driveFile.mimeType,
      size: driveFile.size,
      imageUrl: driveFile.mimeType.startsWith("image/") ? downloadUrl : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload to Google Drive";
    res.status(500).json({ error: message });
  } finally {
    fs.promises.unlink(file.path).catch(() => {});
  }
});

router.get("/drive/files/:fileId/download", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(403).json({ error: "Forbidden" }); return; }

  const fileId = req.params.fileId as string;
  if (!(await userCanAccessDriveFile(fileId, user.id))) {
    res.status(403).json({ error: "You do not have access to this file" });
    return;
  }

  const message = await db.query.messagesTable.findFirst({
    where: eq(messagesTable.attachmentDriveFileId, fileId),
  });
  const driveResponse = await getDriveDownloadResponse(fileId);
  if (!driveResponse.ok || !driveResponse.body) {
    res.status(driveResponse.status).json({ error: "Failed to download file from Google Drive" });
    return;
  }

  const fileName = (message?.attachmentName || "download").replace(/["\r\n]/g, "");
  res.setHeader("Content-Type", message?.attachmentMime || driveResponse.headers.get("content-type") || "application/octet-stream");
  if (message?.attachmentSize) res.setHeader("Content-Length", String(message.attachmentSize));
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  Readable.fromWeb(driveResponse.body as any).pipe(res);
});

export default router;
