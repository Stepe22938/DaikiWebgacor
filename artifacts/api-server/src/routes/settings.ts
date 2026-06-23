import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq } from "drizzle-orm";
import { db, usersTable, systemSettingsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const GalleryItemSchema = z.object({
  src: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
});

const HomepageSettingsSchema = z.object({
  realmName: z.string().min(1).optional(),
  realmLogoUrl: z.string().optional(),
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().min(1),
  serverIP: z.string().min(1),
  mcVersion: z.string().min(1),
  specsCpu: z.string().min(1),
  specsMemory: z.string().min(1),
  specsStorage: z.string().min(1),
  specsLocation: z.string().min(1),
  gallery: z.array(GalleryItemSchema).optional(),
  galleryTitle: z.string().min(1).optional(),
  gallerySubtitle: z.string().min(1).optional(),
  sayabayarApiKey: z.string().optional(),
  sayabayarWebhookSecret: z.string().optional(),
  premiumPrice: z.number().int().min(1000, "Harga minimal Rp 1.000").optional(),
  premiumPlusPrice: z.number().int().min(1000, "Harga minimal Rp 1.000").optional(),
  giftPremiumPrice: z.number().int().min(1000, "Harga minimal Rp 1.000").optional(),
  giftPremiumPlusPrice: z.number().int().min(1000, "Harga minimal Rp 1.000").optional(),
  diamondPackRupiah: z.number().int().min(1, "Minimal Rp 1").optional(),
  diamondPackDiamonds: z.number().int().min(1, "Minimal 1 diamond").optional(),
});

// Keys that must never be exposed through the public GET /settings endpoint.
const SENSITIVE_SETTING_KEYS = ["sayabayarApiKey", "sayabayarWebhookSecret"] as const;

const DEFAULT_SETTINGS = {
  realmName: "Arcadia Studio",
  realmLogoUrl: "",
  heroTitle: "Forge Your Legend in Arcadia",
  heroSubtitle: "Step into an immersive, highly customized Minecraft roleplay and RPG experience. Build nations, command economies, and fight dungeons alongside fellow adventurers.",
  serverIP: "play.arcadiamc.net",
  mcVersion: "1.20.x - 1.21.x",
  specsCpu: "Intel Xeon E-2388G",
  specsMemory: "32 GB DDR4 ECC",
  specsStorage: "NVMe PCIe Gen 4 SSD",
  specsLocation: "Debian VPS Port 5433",
  galleryTitle: "Explore the Realm of Arcadia",
  gallerySubtitle: "Take a visual tour through our hand-crafted server landscapes, customized cities, and deadly adventure zones.",
  sayabayarApiKey: "",
  sayabayarWebhookSecret: "",
  premiumPrice: 25000,
  premiumPlusPrice: 50000,
  giftPremiumPrice: 25000,
  giftPremiumPlusPrice: 50000,
  diamondPackRupiah: 17000,
  diamondPackDiamonds: 100,
  gallery: [
    {
      src: "/lobby.png",
      title: "The Arcadia Spawn",
      description: "A monumental medieval hub where all journeys begin, featuring majestic towers and direct portals."
    },
    {
      src: "/village.png",
      title: "Whispering Woods Town",
      description: "A cozy, player-built trading center where guilds gather, establish shops, and share active roleplay."
    },
    {
      src: "/dungeon.png",
      title: "Underworld Crypts",
      description: "A dangerous, high-reward dungeon loaded with custom boss mechanics, puzzles, and mythic tier loot."
    }
  ]
};

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

router.get("/settings", async (req, res): Promise<void> => {
  try {
    const row = await db.query.systemSettingsTable.findFirst({
      where: eq(systemSettingsTable.key, "homepage_settings"),
    });
    const full = { ...DEFAULT_SETTINGS, ...((row?.value as any) || {}) };
    // Never leak SayaBayar credentials through the public endpoint.
    for (const key of SENSITIVE_SETTING_KEYS) delete (full as any)[key];
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: "Failed to get settings" });
  }
});

// Admin-only: returns the full settings object including sensitive keys so the
// admin panel can read/edit the SayaBayar credentials.
router.get("/admin/settings", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || (user.role !== "admin" && user.role !== "dev_website")) { res.status(403).json({ error: "Forbidden" }); return; }

  try {
    const row = await db.query.systemSettingsTable.findFirst({
      where: eq(systemSettingsTable.key, "homepage_settings"),
    });
    res.json({ ...DEFAULT_SETTINGS, ...((row?.value as any) || {}) });
  } catch (err) {
    res.status(500).json({ error: "Failed to get settings" });
  }
});

router.post("/settings", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user || (user.role !== "admin" && user.role !== "dev_website")) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = HomepageSettingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    await db
      .insert(systemSettingsTable)
      .values({
        key: "homepage_settings",
        value: parsed.data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: {
          value: parsed.data,
          updatedAt: new Date(),
        },
      });
    res.json(parsed.data);
  } catch (err) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export default router;
