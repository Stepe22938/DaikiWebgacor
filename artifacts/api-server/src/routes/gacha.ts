import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  cosmeticsTable,
  userCosmeticsTable,
  walletTransactionsTable,
  systemSettingsTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  AdminAdjustWalletBody,
  UpdateAdminGachaSettingsBody,
  AdminCreateCosmeticBody,
  AdminUpdateCosmeticBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

function canManageAdminTools(role: string | null | undefined) {
  return role === "admin" || role === "dev_website";
}

// --- DEFAULT CONFIGS ---
const DEFAULT_GACHA_SETTINGS = {
  spinCost1: 9,
  spinCost10: 79,
  spinCost25: 195,
  spinCost50: 390,
  duplicateRefund: 5,
  rateS: 1.5,
  rateA: 8.0,
  rateB: 25.0,
  rateC: 60.0,
};

async function getGachaSettings() {
  const row = await db.query.systemSettingsTable.findFirst({
    where: eq(systemSettingsTable.key, "gacha_settings"),
  });
  if (!row) return DEFAULT_GACHA_SETTINGS;
  return { ...DEFAULT_GACHA_SETTINGS, ...(row.value as any) };
}

// --- GET GACHA BOARD ---
router.get("/gacha/board", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const allCosmetics = await db.select().from(cosmeticsTable);
  const owned = await db
    .select()
    .from(userCosmeticsTable)
    .where(eq(userCosmeticsTable.userId, user.id));
  const ownedIds = owned.map(o => o.cosmeticId);

  res.json({
    diamonds: user.diamonds,
    cosmetics: allCosmetics,
    ownedCosmeticIds: ownedIds,
  });
});

// --- CLAIM FREE DIAMONDS ---
router.post("/gacha/claim-diamonds", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const updatedUser = await db
    .update(usersTable)
    .set({ diamonds: user.diamonds + 1000 })
    .where(eq(usersTable.id, user.id))
    .returning();

  await db.insert(walletTransactionsTable).values({
    userId: user.id,
    amount: 1000,
    type: "claim_free",
    description: "Claimed daily test diamonds",
  });

  res.json({ diamonds: updatedUser[0].diamonds });
});

// --- SPIN GACHA ---
router.post("/gacha/spin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const settings = await getGachaSettings();
  const count = Number(req.body.count || 1);
  let cost = settings.spinCost1;
  if (count === 10) cost = settings.spinCost10;
  else if (count === 25) cost = settings.spinCost25;
  else if (count === 50) cost = settings.spinCost50;

  if (user.diamonds < cost) {
    res.status(400).json({ error: "Insufficient diamonds" });
    return;
  }

  const allCosmetics = await db.select().from(cosmeticsTable);
  if (allCosmetics.length === 0) {
    res.status(400).json({ error: "No cosmetics available to spin. Contact admin." });
    return;
  }

  const byRarity = {
    S: allCosmetics.filter(c => c.rarity === "S"),
    A: allCosmetics.filter(c => c.rarity === "A"),
    B: allCosmetics.filter(c => c.rarity === "B"),
    C: allCosmetics.filter(c => c.rarity === "C"),
    D: allCosmetics.filter(c => c.rarity === "D"),
  };

  const owned = await db
    .select()
    .from(userCosmeticsTable)
    .where(eq(userCosmeticsTable.userId, user.id));
  const ownedIds = new Set(owned.map(o => o.cosmeticId));

  const results: any[] = [];
  let diamondsRefunded = 0;

  // Cap refund per duplicate so it can NEVER exceed the per-spin cost (prevents diamond farming)
  const maxRefundPerSpin = Math.floor(cost / count);
  const effectiveRefund = Math.min(settings.duplicateRefund, maxRefundPerSpin);

  for (let i = 0; i < count; i++) {
    const roll = Math.random() * 100;
    let selectedRarity = "D";
    if (roll < settings.rateS) selectedRarity = "S";
    else if (roll < settings.rateA) selectedRarity = "A";
    else if (roll < settings.rateB) selectedRarity = "B";
    else if (roll < settings.rateC) selectedRarity = "C";

    let pool = byRarity[selectedRarity as keyof typeof byRarity];
    if (!pool || pool.length === 0) pool = byRarity["D"]; // fallback to common
    if (!pool || pool.length === 0) pool = allCosmetics; // final fallback

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const isDuplicate = ownedIds.has(chosen.id);

    if (isDuplicate) {
      diamondsRefunded += effectiveRefund;
      results.push({
        cosmetic: chosen,
        isDuplicate: true,
        refundAmount: effectiveRefund,
      });
    } else {
      ownedIds.add(chosen.id);
      results.push({
        cosmetic: chosen,
        isDuplicate: false,
      });

      await db.insert(userCosmeticsTable).values({
        userId: user.id,
        cosmeticId: chosen.id,
        isEquipped: false,
      }).onConflictDoNothing();
    }
  }

  const finalDiamonds = user.diamonds - cost + diamondsRefunded;
  await db
    .update(usersTable)
    .set({ diamonds: finalDiamonds })
    .where(eq(usersTable.id, user.id));

  // Log transaction
  await db.insert(walletTransactionsTable).values({
    userId: user.id,
    amount: -cost,
    type: "spin_cost",
    description: `Spin ${count}x Gacha Royale`,
  });

  if (diamondsRefunded > 0) {
    await db.insert(walletTransactionsTable).values({
      userId: user.id,
      amount: diamondsRefunded,
      type: "duplicate_refund",
      description: `Refund for duplicate cosmetic rewards`,
    });
  }

  res.json({
    results,
    diamonds: finalDiamonds,
    cost,
    refunded: diamondsRefunded,
  });
});

// --- LIST OWNED COSMETICS ---
router.get("/cosmetics", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const owned = await db
    .select({
      id: cosmeticsTable.id,
      name: cosmeticsTable.name,
      type: cosmeticsTable.type,
      rarity: cosmeticsTable.rarity,
      value: cosmeticsTable.value,
      description: cosmeticsTable.description,
      isEquipped: userCosmeticsTable.isEquipped,
    })
    .from(userCosmeticsTable)
    .innerJoin(cosmeticsTable, eq(userCosmeticsTable.cosmeticId, cosmeticsTable.id))
    .where(eq(userCosmeticsTable.userId, user.id));

  res.json(owned);
});

// --- EQUIP/UNEQUIP COSMETIC ---
router.post("/cosmetics/:id/equip", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const cosmeticId = parseInt(req.params.id, 10);
  const record = await db.query.userCosmeticsTable.findFirst({
    where: and(eq(userCosmeticsTable.userId, user.id), eq(userCosmeticsTable.cosmeticId, cosmeticId)),
  });

  if (!record) {
    res.status(454).json({ error: "Cosmetic not owned" });
    return;
  }

  const detail = await db.query.cosmeticsTable.findFirst({
    where: eq(cosmeticsTable.id, cosmeticId),
  });

  if (!detail) {
    res.status(404).json({ error: "Cosmetic not found" });
    return;
  }

  const equip = req.body.equip !== false;

  if (equip) {
    // Unequip same type items first
    const sameTypeCosmetics = await db
      .select({ id: cosmeticsTable.id })
      .from(cosmeticsTable)
      .where(eq(cosmeticsTable.type, detail.type));

    const sameTypeIds = sameTypeCosmetics.map(c => c.id);
    if (sameTypeIds.length > 0) {
      await db
        .update(userCosmeticsTable)
        .set({ isEquipped: false })
        .where(
          and(
            eq(userCosmeticsTable.userId, user.id),
            inArray(userCosmeticsTable.cosmeticId, sameTypeIds)
          )
        );
    }

    // Equip this item
    await db
      .update(userCosmeticsTable)
      .set({ isEquipped: true })
      .where(
        and(
          eq(userCosmeticsTable.userId, user.id),
          eq(userCosmeticsTable.cosmeticId, cosmeticId)
        )
      );
  } else {
    // Unequip
    await db
      .update(userCosmeticsTable)
      .set({ isEquipped: false })
      .where(
        and(
          eq(userCosmeticsTable.userId, user.id),
          eq(userCosmeticsTable.cosmeticId, cosmeticId)
        )
      );
  }

  res.json({ success: true, cosmeticId, isEquipped: equip });
});

// --- WALLET TRANSACTIONS LOG ---
router.get("/wallet/transactions", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const list = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, user.id))
    .orderBy(desc(walletTransactionsTable.createdAt));

  res.json(list.map(t => serializeDates(t)));
});

// --- ADMIN WALLET ADJUSTMENT ---
router.post("/admin/users/:id/wallet", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const me = await getDbUser(auth.userId);
  if (!me || !canManageAdminTools(me.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const targetUserId = parseInt(req.params.id, 10);
  const targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, targetUserId) });
  if (!targetUser) { res.status(404).json({ error: "Target user not found" }); return; }

  const parsed = AdminAdjustWalletBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const adjustment = parsed.data.amount;
  const reason = parsed.data.reason || "Admin adjustment";
  const newBalance = Math.max(0, targetUser.diamonds + adjustment);

  await db
    .update(usersTable)
    .set({ diamonds: newBalance })
    .where(eq(usersTable.id, targetUserId));

  await db.insert(walletTransactionsTable).values({
    userId: targetUserId,
    amount: adjustment,
    type: "admin_adjust",
    description: reason,
  });

  res.json({ diamonds: newBalance });
});

// --- GET ADMIN GACHA SETTINGS ---
router.get("/admin/gacha/settings", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const me = await getDbUser(auth.userId);
  if (!me || !canManageAdminTools(me.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const settings = await getGachaSettings();
  res.json(settings);
});

// --- POST ADMIN GACHA SETTINGS ---
router.post("/admin/gacha/settings", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const me = await getDbUser(auth.userId);
  if (!me || !canManageAdminTools(me.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = UpdateAdminGachaSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db
    .insert(systemSettingsTable)
    .values({
      key: "gacha_settings",
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
});

// --- ADMIN CREATE COSMETIC ---
router.post("/admin/cosmetics", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const me = await getDbUser(auth.userId);
  if (!me || !canManageAdminTools(me.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = AdminCreateCosmeticBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [inserted] = await db
    .insert(cosmeticsTable)
    .values({
      name: parsed.data.name,
      type: parsed.data.type,
      rarity: parsed.data.rarity,
      value: parsed.data.value,
      description: parsed.data.description || null,
    })
    .returning();

  res.status(201).json(serializeDates(inserted));
});

// --- ADMIN PATCH COSMETIC ---
router.patch("/admin/cosmetics/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const me = await getDbUser(auth.userId);
  if (!me || !canManageAdminTools(me.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id, 10);
  const cosmetic = await db.query.cosmeticsTable.findFirst({ where: eq(cosmeticsTable.id, id) });
  if (!cosmetic) { res.status(404).json({ error: "Cosmetic not found" }); return; }

  const parsed = AdminUpdateCosmeticBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, any> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.rarity !== undefined) updateData.rarity = parsed.data.rarity;
  if (parsed.data.value !== undefined) updateData.value = parsed.data.value;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;

  const [updated] = await db
    .update(cosmeticsTable)
    .set(updateData)
    .where(eq(cosmeticsTable.id, id))
    .returning();

  res.json(serializeDates(updated));
});

// --- ADMIN DELETE COSMETIC ---
router.delete("/admin/cosmetics/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const me = await getDbUser(auth.userId);
  if (!me || !canManageAdminTools(me.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = parseInt(req.params.id, 10);
  const cosmetic = await db.query.cosmeticsTable.findFirst({ where: eq(cosmeticsTable.id, id) });
  if (!cosmetic) { res.status(404).json({ error: "Cosmetic not found" }); return; }

  await db.delete(cosmeticsTable).where(eq(cosmeticsTable.id, id));
  res.status(204).send();
});

export default router;
