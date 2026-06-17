import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  boostPackagesTable,
  boostSlotsTable,
  conversationMembersTable,
  conversationsTable,
  db,
  ticketsTable,
  usersTable,
} from "@workspace/db";
import { getAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";
import {
  ensureBoostPackageSeeds,
  ensureDefaultSharedStoragePool,
  getActiveTierForUser,
  getEffectiveBoostState,
  getGroupBoostState,
  getNitroEntitlements,
  getTierPolicy,
} from "../lib/tierBoosts";

const router: IRouter = Router();

router.get("/me/membership", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, auth.userId),
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await ensureBoostPackageSeeds();
  const pool = await ensureDefaultSharedStoragePool();
  const subscription = await getActiveTierForUser(user.id);
  const boostState = await getEffectiveBoostState(user.id);

  const [packages, ownedSlots, assignedSlots, groups, paymentTickets] = await Promise.all([
    db.query.boostPackagesTable.findMany({
      where: eq(boostPackagesTable.active, true),
      orderBy: [asc(boostPackagesTable.boostCount)],
    }),
    db.query.boostSlotsTable.findMany({
      where: eq(boostSlotsTable.ownerUserId, user.id),
      orderBy: [desc(boostSlotsTable.createdAt)],
    }),
    db.query.boostSlotsTable.findMany({
      where: eq(boostSlotsTable.assignedUserId, user.id),
      orderBy: [desc(boostSlotsTable.createdAt)],
    }),
    db
      .select({
        id: conversationsTable.id,
        name: conversationsTable.name,
        type: conversationsTable.type,
        ownerId: conversationsTable.ownerId,
      })
      .from(conversationMembersTable)
      .innerJoin(conversationsTable, eq(conversationMembersTable.conversationId, conversationsTable.id))
      .where(and(
        eq(conversationMembersTable.userId, user.id),
        eq(conversationsTable.type, "group"),
      ))
      .orderBy(asc(conversationsTable.name)),
    db.query.ticketsTable.findMany({
      where: and(
        eq(ticketsTable.creatorId, user.id),
        eq(ticketsTable.ticketType, "payment"),
      ),
      orderBy: [desc(ticketsTable.createdAt)],
    }),
  ]);

  const groupsWithBoosts = await Promise.all(groups.map(async (group) => ({
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    ...(await getGroupBoostState(group.id)),
  })));

  const response = {
    tier: boostState.tierPolicy.tier,
    currentTier: boostState.tierPolicy.tier,
    tierLabel: boostState.tierPolicy.label,
    maxUploadBytes: boostState.tierPolicy.maxUploadBytes,
    baseBoostCount: boostState.tierPolicy.baseBoostCount,
    stickerSyncMode: boostState.tierPolicy.stickerSyncMode,
    nitro: getNitroEntitlements(boostState.tierPolicy.tier),
    purchasedBoostCount: boostState.purchasedBoostCount,
    totalBoostCount: boostState.totalBoostCount,
    activeSubscription: subscription
      ? {
          id: subscription.id,
          tier: subscription.tier,
          tierLabel: getTierPolicy(subscription.tier).label,
          status: subscription.status,
          source: subscription.source,
          startsAt: subscription.startsAt,
          endsAt: subscription.endsAt,
          autoRenews: subscription.autoRenews,
        }
      : null,
    sharedStorage: {
      key: pool?.key ?? "shared-5tb",
      name: pool?.name ?? "Shared Storage 5TB",
      capacityBytes: pool?.capacityBytes ?? 0,
      usedBytes: pool?.usedBytes ?? 0,
      remainingBytes: Math.max((pool?.capacityBytes ?? 0) - (pool?.usedBytes ?? 0), 0),
      validationMode: pool?.validationMode ?? "proxy",
      proxyUploadsEnabled: pool?.proxyUploadsEnabled ?? true,
    },
    packages: packages.map((pkg) => ({
      id: pkg.id,
      sku: pkg.sku,
      displayName: pkg.displayName,
      boostCount: pkg.boostCount,
      priceIdr: pkg.priceIdr,
      durationDays: pkg.durationDays,
    })),
    ownedBoostSlots: ownedSlots.map((slot) => ({
      id: slot.id,
      status: slot.status,
      assignedUserId: slot.assignedUserId,
      activatedAt: slot.activatedAt,
      expiresAt: slot.expiresAt,
      revokedAt: slot.revokedAt,
    })),
    assignedBoostSlots: assignedSlots.map((slot) => ({
      id: slot.id,
      ownerUserId: slot.ownerUserId,
      status: slot.status,
      activatedAt: slot.activatedAt,
      expiresAt: slot.expiresAt,
    })),
    groups: groupsWithBoosts,
    paymentTickets: paymentTickets.map((ticket) => ({
      id: ticket.id,
      reason: ticket.reason,
      status: ticket.status,
      paymentStatus: ticket.paymentStatus,
      requestedTier: ticket.requestedTier,
      requestedPackageSku: ticket.requestedPackageSku,
      requestedConversationId: ticket.requestedConversationId,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      grantedAt: ticket.grantedAt,
      adminNotes: ticket.adminNotes,
    })),
  };

  res.json(serializeDates(response));
});

export default router;
