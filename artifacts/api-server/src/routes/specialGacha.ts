import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, desc, sql, count, max } from "drizzle-orm";
import {
  db,
  usersTable,
  specialGachaEventsTable,
  tokenRoyalPrizesTable,
  userTokenProgressTable,
  biddingEntriesTable,
  titleNumbersTable,
  walletTransactionsTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

function isAdmin(user: { role?: string | null }) {
  return user.role === "admin" || user.role === "owner";
}

// ─────────────────────────── ADMIN ROUTES ───────────────────────────

// GET /admin/special-gacha — list all events with prize counts and bid stats
router.get("/admin/special-gacha", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !isAdmin(user)) { res.status(403).json({ error: "Forbidden" }); return; }

  const events = await db.select().from(specialGachaEventsTable).orderBy(desc(specialGachaEventsTable.createdAt));

  const enriched = await Promise.all(events.map(async (ev) => {
    const prizes = ev.type === "token_royal"
      ? await db.select().from(tokenRoyalPrizesTable).where(eq(tokenRoyalPrizesTable.eventId, ev.id)).orderBy(tokenRoyalPrizesTable.tokenPosition)
      : [];

    const [bidStats] = ev.type === "bidding"
      ? await db.select({ total: count(), topBid: max(biddingEntriesTable.amount) })
          .from(biddingEntriesTable).where(eq(biddingEntriesTable.eventId, ev.id))
      : [{ total: 0, topBid: null }];

    const winner = ev.type === "bidding"
      ? await db.select({ titleNo: titleNumbersTable.titleNo, userId: titleNumbersTable.userId })
          .from(titleNumbersTable).where(eq(titleNumbersTable.eventId, ev.id)).limit(1)
      : [];

    return { ...serializeDates(ev), prizes, bidCount: bidStats?.total ?? 0, topBid: bidStats?.topBid ?? null, winner: winner[0] ?? null };
  }));

  res.json(enriched);
});

// POST /admin/special-gacha — create event
router.post("/admin/special-gacha", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !isAdmin(user)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { type, name, description, videoUrl, isActive, costPerToken, prizes, startingBid, minBidIncrement, endsAt } = req.body;

  if (!type || !["token_royal", "bidding", "rush_board"].includes(type)) {
    res.status(400).json({ error: "Invalid event type" }); return;
  }
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }

  if (type === "token_royal") {
    if (!costPerToken || costPerToken < 1) { res.status(400).json({ error: "costPerToken required" }); return; }
    if (!prizes || prizes.length !== 5) { res.status(400).json({ error: "Exactly 5 prizes required" }); return; }
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
    costPerToken: type === "token_royal" ? costPerToken : null,
    startingBid: type === "bidding" ? startingBid : null,
    minBidIncrement: type === "bidding" ? (minBidIncrement ?? 1) : null,
    endsAt: type === "bidding" ? new Date(endsAt) : null,
  }).returning();

  if (type === "token_royal" && prizes) {
    await db.insert(tokenRoyalPrizesTable).values(
      prizes.map((p: any, i: number) => ({
        eventId: event.id,
        tokenPosition: i + 1,
        name: p.name?.trim() || `Prize ${i + 1}`,
        description: p.description?.trim() || null,
        imageUrl: p.imageUrl?.trim() || null,
      }))
    );
  }

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
    ...(costPerToken !== undefined && { costPerToken }),
    ...(startingBid !== undefined && { startingBid }),
    ...(minBidIncrement !== undefined && { minBidIncrement }),
    ...(endsAt !== undefined && { endsAt: endsAt ? new Date(endsAt) : null }),
    updatedAt: new Date(),
  }).where(eq(specialGachaEventsTable.id, eventId));

  // Update prizes if provided for token_royal
  if (existing.type === "token_royal" && prizes && prizes.length === 5) {
    await db.delete(tokenRoyalPrizesTable).where(eq(tokenRoyalPrizesTable.eventId, eventId));
    await db.insert(tokenRoyalPrizesTable).values(
      prizes.map((p: any, i: number) => ({
        eventId,
        tokenPosition: i + 1,
        name: p.name?.trim() || `Prize ${i + 1}`,
        description: p.description?.trim() || null,
        imageUrl: p.imageUrl?.trim() || null,
      }))
    );
  }

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
    const prizes = ev.type === "token_royal"
      ? await db.select().from(tokenRoyalPrizesTable).where(eq(tokenRoyalPrizesTable.eventId, ev.id)).orderBy(tokenRoyalPrizesTable.tokenPosition)
      : [];

    const progress = ev.type === "token_royal"
      ? await db.query.userTokenProgressTable.findFirst({
          where: and(eq(userTokenProgressTable.userId, user.id), eq(userTokenProgressTable.eventId, ev.id))
        })
      : null;

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
      prizes,
      tokensCollected: progress?.tokensCollected ?? 0,
      completedAt: progress?.completedAt ? serializeDates(progress).completedAt : null,
      myBid: myBid[0]?.amount ?? null,
      topBid: topBidRow?.topBid ?? null,
      bidCount: topBidRow?.total ?? 0,
    };
  }));

  res.json(enriched);
});

// POST /special-gacha/:id/collect-token — spend diamonds, advance token progress
router.post("/special-gacha/:id/collect-token", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const eventId = parseInt(req.params.id, 10);
  if (isNaN(eventId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const event = await db.query.specialGachaEventsTable.findFirst({ where: eq(specialGachaEventsTable.id, eventId) });
  if (!event || !event.isActive || event.type !== "token_royal") {
    res.status(400).json({ error: "Event not available" }); return;
  }

  const cost = event.costPerToken!;
  if (user.diamonds < cost) {
    res.status(400).json({ error: "Insufficient diamonds" }); return;
  }

  // Get or create progress
  let progress = await db.query.userTokenProgressTable.findFirst({
    where: and(eq(userTokenProgressTable.userId, user.id), eq(userTokenProgressTable.eventId, eventId))
  });

  const currentTokens = progress?.tokensCollected ?? 0;
  if (currentTokens >= 5) {
    res.status(400).json({ error: "Semua token sudah dikumpulkan" }); return;
  }

  const nextToken = currentTokens + 1;
  const isGrandPrize = nextToken === 5;

  // Deduct diamonds
  await db.update(usersTable).set({ diamonds: user.diamonds - cost }).where(eq(usersTable.id, user.id));
  await db.insert(walletTransactionsTable).values({
    userId: user.id, amount: -cost, currency: "diamond",
    type: "token_royal_spend", description: `Token Royal: Token #${nextToken} — "${event.name}"`,
  });

  // Update progress
  if (progress) {
    await db.update(userTokenProgressTable)
      .set({ tokensCollected: nextToken, completedAt: isGrandPrize ? new Date() : null })
      .where(and(eq(userTokenProgressTable.userId, user.id), eq(userTokenProgressTable.eventId, eventId)));
  } else {
    await db.insert(userTokenProgressTable).values({
      userId: user.id, eventId, tokensCollected: nextToken,
      completedAt: isGrandPrize ? new Date() : null,
    });
  }

  // Fetch the prize for this token position
  const prize = await db.query.tokenRoyalPrizesTable.findFirst({
    where: and(eq(tokenRoyalPrizesTable.eventId, eventId), eq(tokenRoyalPrizesTable.tokenPosition, nextToken))
  });

  res.json({
    tokenNumber: nextToken,
    isGrandPrize,
    prize: prize ? serializeDates(prize) : null,
    diamondsLeft: user.diamonds - cost,
  });
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
