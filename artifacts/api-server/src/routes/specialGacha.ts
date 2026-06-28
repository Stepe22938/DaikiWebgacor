import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, desc, sql, count, max } from "drizzle-orm";
import {
  db,
  usersTable,
  specialGachaEventsTable,
  biddingEntriesTable,
  titleNumbersTable,
  walletTransactionsTable,
  eventRewardsTable,
  userEventRewardProgressTable,
  eventSpinResultsTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

const DEV_WEBSITE_ROLE = "dev_website";

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

function isAdmin(user: { role?: string | null }) {
  return user.role === "admin" || user.role === "owner" || user.role === DEV_WEBSITE_ROLE;
}

// ─────────────────────────── ADMIN ROUTES ───────────────────────────

// GET /admin/special-gacha — list all events with prize counts and bid stats
router.get("/admin/special-gacha", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized - no auth userId" }); return; }
  const user = await getDbUser(auth.userId);
  console.log('[specialGacha] GET list - auth.userId:', auth.userId, 'user found:', !!user, 'user.role:', user?.role);
  if (!user) { res.status(403).json({ error: "Forbidden - user not found in database" }); return; }
  if (!isAdmin(user)) { res.status(403).json({ error: "Forbidden - needs admin/owner role, has: " + user.role }); return; }

  const events = await db.select().from(specialGachaEventsTable).orderBy(desc(specialGachaEventsTable.createdAt));

  const enriched = await Promise.all(events.map(async (ev) => {
    const rewards = ev.type === "token_royal" || ev.type === "rush_board"
      ? await db.select().from(eventRewardsTable).where(eq(eventRewardsTable.eventId, ev.id)).orderBy(eventRewardsTable.rewardTier)
      : [];

    const [bidStats] = ev.type === "bidding"
      ? await db.select({ total: count(), topBid: max(biddingEntriesTable.amount) })
          .from(biddingEntriesTable).where(eq(biddingEntriesTable.eventId, ev.id))
      : [{ total: 0, topBid: null }];

    const winner = ev.type === "bidding"
      ? await db.select({ titleNo: titleNumbersTable.titleNo, userId: titleNumbersTable.userId })
          .from(titleNumbersTable).where(eq(titleNumbersTable.eventId, ev.id)).limit(1)
      : [];

    return { ...serializeDates(ev), rewards, bidCount: bidStats?.total ?? 0, topBid: bidStats?.topBid ?? null, winner: winner[0] ?? null };
  }));

  res.json(enriched);
});

// POST /admin/special-gacha — create event
router.post("/admin/special-gacha", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized - no auth userId" }); return; }
  const user = await getDbUser(auth.userId);
  console.log('[specialGacha] POST create - auth.userId:', auth.userId, 'user found:', !!user, 'user.role:', user?.role);
  if (!user) { res.status(403).json({ error: "Forbidden - user not found in database. userId:" + auth.userId }); return; }
  if (!isAdmin(user)) { res.status(403).json({ error: "Forbidden - user role is " + user.role + ", needs admin or owner" }); return; }

  const { type, name, description, videoUrl, isActive, costPerToken, prizes, startingBid, minBidIncrement, endsAt } = req.body;

  if (!type || !["token_royal", "bidding", "rush_board"].includes(type)) {
    res.status(400).json({ error: "Invalid event type" }); return;
  }
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }

  if (type === "token_royal") {
    if (!costPerToken || costPerToken < 1) { res.status(400).json({ error: "costPerToken required" }); return; }
  }
  if (type === "bidding") {
    if (!startingBid || startingBid < 1) { res.status(400).json({ error: "startingBid required" }); return; }
    if (!endsAt) { res.status(400).json({ error: "endsAt required" }); return; }
  }

  const [event] = await db.insert(specialGachaEventsTable).values({
    type,
    name: name.trim(),
    description: description?.trim() || null,
    videoUrl: videoUrl?.trim() || null,
    isActive: isActive ?? false,
    spinCost: type === "token_royal" ? costPerToken : 50,
    startingBid: type === "bidding" ? startingBid : null,
    minBidIncrement: type === "bidding" ? (minBidIncrement ?? 1) : null,
    endsAt: type === "bidding" ? new Date(endsAt) : null,
  }).returning();

  // Token Royal slots are set separately via POST /admin/special-gacha/:id/token-royal/slots

  res.status(201).json(serializeDates(event));
});

// PATCH /admin/special-gacha/:id — update event (toggle active, rename, re-upload video, edit prizes)
router.patch("/admin/special-gacha/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !isAdmin(user)) { res.status(403).json({ error: "Forbidden" }); return; }

  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const existing = await db.query.specialGachaEventsTable.findFirst({ where: eq(specialGachaEventsTable.id, eventId) });
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }

  const { name, description, videoUrl, isActive, costPerToken, prizes, startingBid, minBidIncrement, endsAt } = req.body;

  await db.update(specialGachaEventsTable).set({
    ...(name !== undefined && { name: name.trim() }),
    ...(description !== undefined && { description: description?.trim() || null }),
    ...(videoUrl !== undefined && { videoUrl: videoUrl?.trim() || null }),
    ...(isActive !== undefined && { isActive }),
    ...(costPerToken !== undefined && { spinCost: costPerToken }),
    ...(startingBid !== undefined && { startingBid }),
    ...(minBidIncrement !== undefined && { minBidIncrement }),
    ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
    updatedAt: new Date(),
  }).where(eq(specialGachaEventsTable.id, eventId));

  // Token Royal slots are updated separately via POST /admin/special-gacha/:id/token-royal/slots

  const updated = await db.query.specialGachaEventsTable.findFirst({ where: eq(specialGachaEventsTable.id, eventId) });
  res.json(serializeDates(updated));
});

// DELETE /admin/special-gacha/:id
router.delete("/admin/special-gacha/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !isAdmin(user)) { res.status(403).json({ error: "Forbidden" }); return; }

  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.delete(specialGachaEventsTable).where(eq(specialGachaEventsTable.id, eventId));
  res.json({ success: true });
});

// POST /admin/special-gacha/:id/rewards — set custom rewards untuk event
router.post("/admin/special-gacha/:id/rewards", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !isAdmin(user)) { res.status(403).json({ error: "Forbidden" }); return; }

  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const event = await db.query.specialGachaEventsTable.findFirst({ where: eq(specialGachaEventsTable.id, eventId) });
  if (!event || (event.type !== "token_royal" && event.type !== "rush_board")) {
    res.status(400).json({ error: "Event type doesn't support custom rewards" }); return;
  }

  const { rewards } = req.body;
  if (!Array.isArray(rewards) || rewards.length === 0) {
    res.status(400).json({ error: "Must provide at least 1 reward" }); return;
  }

  // Delete old rewards
  await db.delete(eventRewardsTable).where(eq(eventRewardsTable.eventId, eventId));

  // Create new rewards
  await db.insert(eventRewardsTable).values(
    rewards.map((r: any, i: number) => ({
      eventId,
      rewardType: r.rewardType || `tier${i + 1}`,
      rewardTier: i + 1,
      rewardName: r.rewardName?.trim() || `Reward ${i + 1}`,
      rewardDescription: r.rewardDescription?.trim() || null,
      rewardImageUrl: r.rewardImageUrl?.trim() || null,
      rewardQuantity: r.rewardQuantity || 1,
      isGrandPrize: r.isGrandPrize || false,
    }))
  );

  const savedRewards = await db.select().from(eventRewardsTable).where(eq(eventRewardsTable.eventId, eventId)).orderBy(eventRewardsTable.rewardTier);
  res.json(savedRewards);
});

// GET /admin/special-gacha/:id/rewards
router.get("/admin/special-gacha/:id/rewards", async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const rewards = await db.select().from(eventRewardsTable).where(eq(eventRewardsTable.eventId, eventId)).orderBy(eventRewardsTable.rewardTier);
  res.json(rewards);
});

// POST /admin/special-gacha/:id/award-winner — close bidding, award title #, refund losers
router.post("/admin/special-gacha/:id/award-winner", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !isAdmin(user)) { res.status(403).json({ error: "Forbidden" }); return; }

  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const event = await db.query.specialGachaEventsTable.findFirst({ where: eq(specialGachaEventsTable.id, eventId) });
  if (!event || event.type !== "bidding") { res.status(400).json({ error: "Not a bidding event" }); return; }

  // Check not already awarded
  const alreadyAwarded = await db.query.titleNumbersTable.findFirst({ where: eq(titleNumbersTable.eventId, eventId) });
  if (alreadyAwarded) { res.status(400).json({ error: "Winner already awarded" }); return; }

  // Find highest bid
  const allBids = await db.select().from(biddingEntriesTable)
    .where(eq(biddingEntriesTable.eventId, eventId))
    .orderBy(desc(biddingEntriesTable.amount));

  if (allBids.length === 0) { res.status(400).json({ error: "No bids placed" }); return; }

  const topBid = allBids[0];

  // Generate next title number
  const [{ maxNo }] = await db.select({ maxNo: max(titleNumbersTable.titleNo) }).from(titleNumbersTable);
  const nextNum = maxNo ? String(parseInt(maxNo, 10) + 1).padStart(4, "0") : "0001";

  await db.insert(titleNumbersTable).values({
    userId: topBid.userId,
    eventId,
    titleNo: nextNum,
    awardedAt: new Date(),
  });

  // Refund all LOSERS their diamond bids
  const loserBids = allBids.filter((b) => b.userId !== topBid.userId);
  const refundMap: Record<number, number> = {};
  for (const bid of loserBids) {
    refundMap[bid.userId] = (refundMap[bid.userId] ?? 0) + bid.amount;
  }
  for (const [uid, refundAmt] of Object.entries(refundMap)) {
    const userId = parseInt(uid, 10);
    await db.update(usersTable).set({ diamonds: sql`diamonds + ${refundAmt}` }).where(eq(usersTable.id, userId));
    await db.insert(walletTransactionsTable).values({
      userId, amount: refundAmt, currency: "diamond",
      type: "bidding_refund", description: `Refund: lost bidding event "${event.name}"`,
    });
  }

  // Close the event
  await db.update(specialGachaEventsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(specialGachaEventsTable.id, eventId));

  const winner = await db.query.usersTable.findFirst({ where: eq(usersTable.id, topBid.userId) });
  res.json({ titleNo: nextNum, winner: { id: winner?.id, username: winner?.username, displayName: winner?.displayName }, winningBid: topBid.amount });
});

// ─────────────────────────── USER ROUTES ───────────────────────────

// GET /special-gacha — active events for the current user
router.get("/special-gacha", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const events = await db.select().from(specialGachaEventsTable)
    .where(eq(specialGachaEventsTable.isActive, true))
    .orderBy(desc(specialGachaEventsTable.createdAt));

  const enriched = await Promise.all(events.map(async (ev) => {
    const slots: any[] = [];

    const progress = null;

    const myBid = ev.type === "bidding"
      ? await db.select({ amount: biddingEntriesTable.amount }).from(biddingEntriesTable)
          .where(and(eq(biddingEntriesTable.eventId, ev.id), eq(biddingEntriesTable.userId, user.id)))
          .orderBy(desc(biddingEntriesTable.amount)).limit(1)
      : [];

    const [topBidRow] = ev.type === "bidding"
      ? await db.select({ topBid: max(biddingEntriesTable.amount), total: count() })
          .from(biddingEntriesTable).where(eq(biddingEntriesTable.eventId, ev.id))
      : [{ topBid: null, total: 0 }];

    return {
      ...serializeDates(ev),
      slots,
      completedSlots: [],
      sharkDiscountCount: 0,
      isCompleted: false,
      myBid: myBid[0]?.amount ?? null,
      topBid: topBidRow?.topBid ?? null,
      bidCount: topBidRow?.total ?? 0,
    };
  }));

  res.json(enriched);
});

// POST /special-gacha/:id/spin — spin any special event (Token Royal, Rush Board, etc) dengan shark discount
router.post("/special-gacha/:id/spin", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const event = await db.query.specialGachaEventsTable.findFirst({ where: eq(specialGachaEventsTable.id, eventId) });
  if (!event || !event.isActive || (event.type !== "token_royal" && event.type !== "rush_board")) {
    res.status(400).json({ error: "Event not available" }); return;
  }

  // Get rewards for this event
  const rewards = await db.select().from(eventRewardsTable).where(eq(eventRewardsTable.eventId, eventId));
  if (rewards.length === 0) {
    res.status(400).json({ error: "Event has no rewards configured" }); return;
  }

  // Get or create progress
  let progress = await db.query.userEventRewardProgressTable.findFirst({
    where: and(eq(userEventRewardProgressTable.userId, user.id), eq(userEventRewardProgressTable.eventId, eventId))
  });

  if (progress?.isCompleted) {
    res.status(400).json({ error: "Event sudah selesai" }); return;
  }

  const spinCost = event.spinCost || 50;
  const sharkCount = progress?.sharkCount || 0;
  const sharkDiscount = sharkCount * 10; // 10% per shark
  const discountedCost = Math.floor(spinCost * (100 - sharkDiscount) / 100);

  if (user.diamonds < discountedCost) {
    res.status(400).json({ error: "Insufficient diamonds" }); return;
  }

  // Determine spin result
  const sharkRate = parseFloat(event.sharkRate?.toString() || "0.30");
  const isShark = Math.random() < sharkRate;
  let result: any = { isSharked: isShark, diamondsSpent: discountedCost, discountApplied: spinCost - discountedCost };

  if (isShark) {
    // Got shark - increment discount count
    const newSharkCount = sharkCount + 1;
    if (progress) {
      await db.update(userEventRewardProgressTable)
        .set({ sharkCount: newSharkCount, totalSpins: (progress.totalSpins || 0) + 1, updatedAt: new Date() })
        .where(and(eq(userEventRewardProgressTable.userId, user.id), eq(userEventRewardProgressTable.eventId, eventId)));
    } else {
      await db.insert(userEventRewardProgressTable).values({
        userId: user.id, eventId, sharkCount: 1, totalSpins: 1,
      });
    }
    result.type = "shark";
    result.nextDiscount = newSharkCount * 10;
  } else {
    // Got reward - random from available rewards
    const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
    const collectedIds = progress?.collectedRewardIds || [];
    const newCollectedIds = [...new Set([...collectedIds, randomReward.id])];
    const isEventComplete = randomReward.isGrandPrize;

    if (progress) {
      await db.update(userEventRewardProgressTable)
        .set({
          collectedRewardIds: newCollectedIds,
          totalSpins: (progress.totalSpins || 0) + 1,
          isCompleted: isEventComplete,
          completedAt: isEventComplete ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(userEventRewardProgressTable.userId, user.id), eq(userEventRewardProgressTable.eventId, eventId)));
    } else {
      await db.insert(userEventRewardProgressTable).values({
        userId: user.id, eventId, collectedRewardIds: [randomReward.id], totalSpins: 1,
        isCompleted: isEventComplete, completedAt: isEventComplete ? new Date() : null,
      });
    }

    result.type = "reward";
    result.reward = serializeDates(randomReward);
    result.collectedRewards = newCollectedIds.length;
    result.totalRewards = rewards.length;
    result.eventComplete = isEventComplete;
  }

  // Deduct diamonds
  await db.update(usersTable).set({ diamonds: user.diamonds - discountedCost }).where(eq(usersTable.id, user.id));
  await db.insert(walletTransactionsTable).values({
    userId: user.id, amount: -discountedCost, currency: "diamond",
    type: "special_gacha_spend", description: `${event.name} Spin: ${isShark ? "🦈 Shark!" : `${result.reward?.rewardName}`}`,
  });

  // Log spin result
  await db.insert(eventSpinResultsTable).values({
    userId: user.id, eventId, resultType: isShark ? "shark" : "reward",
    rewardId: isShark ? null : result.reward?.id,
    isShark,
    diamondsSpent: discountedCost,
    discountApplied: sharkDiscount > 0 ? spinCost - discountedCost : 0,
  });

  result.diamondsLeft = user.diamonds - discountedCost;
  res.json(result);
});

// POST /special-gacha/:id/bid — place/raise a bid
router.post("/special-gacha/:id/bid", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const event = await db.query.specialGachaEventsTable.findFirst({ where: eq(specialGachaEventsTable.id, eventId) });
  if (!event || !event.isActive || event.type !== "bidding") {
    res.status(400).json({ error: "Bidding event not available" }); return;
  }
  if (event.endsAt && new Date() > event.endsAt) {
    res.status(400).json({ error: "Bidding has ended" }); return;
  }

  const { amount } = req.body;
  const bidAmount = parseInt(amount, 10);
  if (isNaN(bidAmount) || bidAmount < 1) { res.status(400).json({ error: "Invalid bid amount" }); return; }

  // Must beat current top bid + minIncrement
  const [{ topBid }] = await db.select({ topBid: max(biddingEntriesTable.amount) })
    .from(biddingEntriesTable).where(eq(biddingEntriesTable.eventId, eventId));

  const minRequired = Math.max(event.startingBid ?? 1, (topBid ?? 0) + (event.minBidIncrement ?? 1));
  if (bidAmount < minRequired) {
    res.status(400).json({ error: `Minimum bid is ${minRequired} diamonds` }); return;
  }

  // Refund previous bid from this user (if any)
  const [myPrevBid] = await db.select({ amount: biddingEntriesTable.amount }).from(biddingEntriesTable)
    .where(and(eq(biddingEntriesTable.eventId, eventId), eq(biddingEntriesTable.userId, user.id)))
    .orderBy(desc(biddingEntriesTable.amount)).limit(1);

  const prevBidAmount = myPrevBid?.amount ?? 0;
  const netCost = bidAmount - prevBidAmount;

  if (user.diamonds < netCost) {
    res.status(400).json({ error: "Insufficient diamonds" }); return;
  }

  // Refund previous bid diamonds back
  if (prevBidAmount > 0) {
    await db.update(usersTable).set({ diamonds: sql`diamonds + ${prevBidAmount}` }).where(eq(usersTable.id, user.id));
    await db.delete(biddingEntriesTable)
      .where(and(eq(biddingEntriesTable.eventId, eventId), eq(biddingEntriesTable.userId, user.id)));
  }

  // Deduct new bid amount
  await db.update(usersTable).set({ diamonds: sql`diamonds - ${bidAmount}` }).where(eq(usersTable.id, user.id));
  await db.insert(walletTransactionsTable).values({
    userId: user.id, amount: -netCost, currency: "diamond",
    type: "bidding_spend", description: `Bid ${bidAmount}💎 on "${event.name}"`,
  });

  await db.insert(biddingEntriesTable).values({ eventId, userId: user.id, amount: bidAmount });

  const updatedUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, user.id) });
  res.json({ success: true, bidAmount, diamondsLeft: updatedUser?.diamonds ?? 0 });
});

export default router;
