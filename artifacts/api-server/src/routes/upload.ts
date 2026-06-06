import express, { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import fs from "node:fs";
import path from "node:path";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

router.post("/upload", express.raw({ type: "image/*", limit: "10mb" }), async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await getDbUser(auth.userId);
  if (!user) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!req.body || !(req.body instanceof Buffer)) {
    res.status(400).json({ error: "Invalid file body" });
    return;
  }

  try {
    const contentType = req.headers["content-type"] as string;
    const fileNameHeader = req.headers["x-file-name"] as string || "upload.png";
    const extension = fileNameHeader.split(".").pop() || "png";
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;

    // Target upload folder in public frontend directory (works in dev and production)
    const isBundled = import.meta.dirname.endsWith("dist");
    const relativePath = isBundled
      ? "../../mc-roleplay/public/uploads"
      : "../../../mc-roleplay/public/uploads";
    const uploadDir = path.resolve(import.meta.dirname, relativePath);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueFileName);
    await fs.promises.writeFile(filePath, req.body);

    res.json({ url: `/uploads/${uniqueFileName}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload file" });
  }
});

export default router;
