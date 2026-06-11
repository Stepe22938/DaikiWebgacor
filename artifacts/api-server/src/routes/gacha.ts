import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, inArray } from "drizzle-orm";
import { db, usersTable, cosmeticsTable, userCosmeticsTable } from "@workspace/db";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
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

  res.json({ diamonds: updatedUser[0].diamonds });
});

// --- SPIN GACHA ---
router.post("/gacha/spin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const count = Number(req.body.count || 1);
  let cost = 9;
  if (count === 5) cost = 39;
  else if (count === 25) cost = 195;
  else if (count === 50) cost = 390;

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

  for (let i = 0; i < count; i++) {
    const roll = Math.random() * 100;
    let selectedRarity = "D";
    if (roll < 1.5) selectedRarity = "S";
    else if (roll < 8.0) selectedRarity = "A";
    else if (roll < 25.0) selectedRarity = "B";
    else if (roll < 60.0) selectedRarity = "C";

    let pool = byRarity[selectedRarity as keyof typeof byRarity];
    if (!pool || pool.length === 0) pool = byRarity["D"]; // fallback to common
    if (!pool || pool.length === 0) pool = allCosmetics; // final fallback

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const isDuplicate = ownedIds.has(chosen.id);

    if (isDuplicate) {
      diamondsRefunded += 100;
      results.push({
        cosmetic: chosen,
        isDuplicate: true,
        refundAmount: 100,
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
    res.status(404).json({ error: "Cosmetic not owned" });
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

export default router;
