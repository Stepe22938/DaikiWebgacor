import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  boostPackagesTable,
  boostSlotsTable,
  conversationMembersTable,
  conversationsTable,
  db,
  groupBoostAssignmentsTable,
  ticketsTable,
  usersTable,
  userTierSubscriptionsTable,
  systemSettingsTable,
  premiumGiftsTable,
  walletTransactionsTable,
} from "@workspace/db";
import { getAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";
import {
  applyBoostSlotToConversation,
  ensureBoostPackageSeeds,
  ensureDefaultSharedStoragePool,
  getActiveTierForUser,
  getEffectiveBoostState,
  getGroupBoostState,
  getNitroEntitlements,
  getTierPolicy,
  revokeGroupBoostAssignment,
  syncTierIncludedBoostSlotsForUser,
  createBoostOrderWithSlots,
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

  // Auto-sync status of any pending SayaBayar transactions
  const settingsRow = await db.query.systemSettingsTable.findFirst({
    where: eq(systemSettingsTable.key, "homepage_settings"),
  });
  const settings = {
    sayabayarApiKey: "",
    sayabayarWebhookSecret: "",
    premiumPrice: 25000,
    premiumPlusPrice: 50000,
    ...(settingsRow?.value || {} as any),
  };
  const apiKey = settings.sayabayarApiKey;

  if (apiKey) {
    const pendingTickets = await db.query.ticketsTable.findMany({
      where: and(
        eq(ticketsTable.creatorId, user.id),
        eq(ticketsTable.ticketType, "payment"),
        eq(ticketsTable.status, "open"),
        eq(ticketsTable.paymentStatus, "pending_review"),
      ),
    });

    for (const ticket of pendingTickets) {
      const match = ticket.adminNotes?.match(/\[SayaBayar ID:\s*([^\]\s]+)\]/);
      if (match && match[1]) {
        const invoiceId = match[1];
        try {
          const apiResponse = await fetch(`https://api.sayabayar.com/v1/invoices/${invoiceId}`, {
            method: "GET",
            headers: {
              "X-API-Key": apiKey,
            },
          });
          if (apiResponse.ok) {
            const resJson = await apiResponse.json() as any;
            const invoiceStatus = resJson?.data?.status;
            if (invoiceStatus === "paid" || invoiceStatus === "success") {
              const grantTier = ticket.requestedTier;
              const grantPackageSku = ticket.requestedPackageSku;
              const targetConversationId = ticket.requestedConversationId;

              const giftCodeMatch = ticket.adminNotes?.match(/\[Gift Code:\s*([^\]\s]+)\]/);
              const topupMatch = ticket.adminNotes?.match(/\[Wallet Topup:\s*(\d+)\]/);

              if (topupMatch && topupMatch[1]) {
                const amount = parseInt(topupMatch[1], 10);
                const targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, ticket.creatorId) });
                if (targetUser && amount > 0) {
                  await db.update(usersTable)
                    .set({ balanceRp: (targetUser.balanceRp ?? 0) + amount, updatedAt: new Date() })
                    .where(eq(usersTable.id, ticket.creatorId));
                  await db.insert(walletTransactionsTable).values({
                    userId: ticket.creatorId,
                    amount,
                    currency: "rp",
                    type: "topup",
                    description: `Top up saldo via SayaBayar Status Sync (ticket #${ticket.id})`,
                  });
                }
              } else if (giftCodeMatch && giftCodeMatch[1]) {
                const code = giftCodeMatch[1].trim();
                await db
                  .update(premiumGiftsTable)
                  .set({ status: "active", ticketId: ticket.id })
                  .where(eq(premiumGiftsTable.giftCode, code));
              } else if (grantTier) {
                const endsAt = new Date();
                endsAt.setMonth(endsAt.getMonth() + 1);
                await db.insert(userTierSubscriptionsTable).values({
                  userId: ticket.creatorId,
                  tier: grantTier,
                  status: "active",
                  source: "payment_ticket",
                  startsAt: new Date(),
                  endsAt,
                  autoRenews: false,
                  notes: `Granted automatically via SayaBayar Status Sync for ticket #${ticket.id}`,
                });

                const targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, ticket.creatorId) });
                if (targetUser && !["admin", "staff", "dev", "dev_website"].includes(targetUser.role)) {
                  await db.update(usersTable)
                    .set({ role: grantTier, updatedAt: new Date() })
                    .where(eq(usersTable.id, ticket.creatorId));
                }
              }

              let createdOrderBoostCount = 0;
              if (grantPackageSku) {
                await ensureBoostPackageSeeds();
                const created = await createBoostOrderWithSlots({
                  buyerUserId: ticket.creatorId,
                  packageSku: grantPackageSku,
                  notes: `Granted automatically via SayaBayar Status Sync for ticket #${ticket.id}`,
                });
                createdOrderBoostCount = created.package.boostCount;
              }

              const boostApplications = targetConversationId && createdOrderBoostCount > 0 ? createdOrderBoostCount : 0;
              if (targetConversationId && boostApplications > 0) {
                const availableSlots = await db
                  .select({ id: boostSlotsTable.id })
                  .from(boostSlotsTable)
                  .where(and(
                    eq(boostSlotsTable.ownerUserId, ticket.creatorId),
                    eq(boostSlotsTable.status, "available"),
                  ))
                  .orderBy(asc(boostSlotsTable.id));

                if (availableSlots.length >= boostApplications) {
                  for (const slot of availableSlots.slice(0, boostApplications)) {
                    await applyBoostSlotToConversation({
                      slotId: slot.id,
                      actorUserId: ticket.creatorId,
                      ownerOverrideUserId: ticket.creatorId,
                      conversationId: targetConversationId,
                    });
                  }
                }
              }

              const currentNotes = ticket.adminNotes || "";
              await db.update(ticketsTable)
                .set({
                  paymentStatus: "paid",
                  status: "resolved",
                  grantedAt: new Date(),
                  updatedAt: new Date(),
                  adminNotes: currentNotes ? `${currentNotes} | Auto-Approved via SayaBayar Status Sync` : "Auto-Approved via SayaBayar Status Sync",
                })
                .where(eq(ticketsTable.id, ticket.id));
            }
          }
        } catch (err) {
          console.error(`Error checking SayaBayar invoice ${invoiceId} status:`, err);
        }
      }
    }
  }

  await ensureBoostPackageSeeds();
  await syncTierIncludedBoostSlotsForUser(user.id);
  const pool = await ensureDefaultSharedStoragePool();
  const subscription = await getActiveTierForUser(user.id);
  const boostState = await getEffectiveBoostState(user.id);

  const [packages, ownedSlotsWithAssignments, assignedSlots, groups, paymentTickets] = await Promise.all([
    db.query.boostPackagesTable.findMany({
      where: eq(boostPackagesTable.active, true),
      orderBy: [asc(boostPackagesTable.boostCount)],
    }),
    db
      .select({
        id: boostSlotsTable.id,
        status: boostSlotsTable.status,
        assignedUserId: boostSlotsTable.assignedUserId,
        activatedAt: boostSlotsTable.activatedAt,
        expiresAt: boostSlotsTable.expiresAt,
        revokedAt: boostSlotsTable.revokedAt,
        createdAt: boostSlotsTable.createdAt,
        assignmentId: groupBoostAssignmentsTable.id,
        assignmentStatus: groupBoostAssignmentsTable.status,
        conversationId: groupBoostAssignmentsTable.conversationId,
        conversationName: conversationsTable.name,
      })
      .from(boostSlotsTable)
      .leftJoin(groupBoostAssignmentsTable, and(
        eq(boostSlotsTable.id, groupBoostAssignmentsTable.slotId),
        eq(groupBoostAssignmentsTable.status, "active"),
      ))
      .leftJoin(conversationsTable, eq(groupBoostAssignmentsTable.conversationId, conversationsTable.id))
      .where(eq(boostSlotsTable.ownerUserId, user.id))
      .orderBy(desc(boostSlotsTable.createdAt)),
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

  const groupsWithBoosts = await Promise.all(groups.map(async (group) => {
    const state = await getGroupBoostState(group.id);
    return {
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      myManualBoostCount: Array.isArray(state.assignments)
        ? state.assignments.filter((assignment) => assignment.appliedByUserId === user.id).length
        : 0,
      ...state,
    };
  }));

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
      description: pkg.description,
      boostCount: pkg.boostCount,
      priceIdr: pkg.priceIdr,
      discountPriceIdr: pkg.discountPriceIdr,
      durationDays: pkg.durationDays,
    })),
    ownedBoostSlots: ownedSlotsWithAssignments.map((slot) => ({
      id: slot.id,
      status: slot.status,
      assignedUserId: slot.assignedUserId,
      activatedAt: slot.activatedAt,
      expiresAt: slot.expiresAt,
      revokedAt: slot.revokedAt,
      assignment: slot.assignmentId && slot.assignmentStatus === "active" ? {
        id: slot.assignmentId,
        conversationId: slot.conversationId,
        conversationName: slot.conversationName,
      } : null,
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

router.post("/me/membership/boosts/apply", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await syncTierIncludedBoostSlotsForUser(user.id);

  const slotId = typeof req.body.slotId === "number" ? req.body.slotId : null;
  const conversationId = typeof req.body.conversationId === "number" ? req.body.conversationId : null;

  if (!slotId || !conversationId) {
    res.status(400).json({ error: "slotId dan conversationId diperlukan." });
    return;
  }

  const slot = await db.query.boostSlotsTable.findFirst({ where: eq(boostSlotsTable.id, slotId) });
  if (!slot) {
    res.status(404).json({ error: "Boost slot tidak ditemukan." });
    return;
  }
  if (slot.ownerUserId !== user.id) {
    res.status(403).json({ error: "Kamu bukan pemilik boost slot ini." });
    return;
  }
  if (slot.status === "expired") {
    res.status(400).json({ error: "Boost slot ini sudah expired." });
    return;
  }

  const member = await db.query.conversationMembersTable.findFirst({
    where: and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, user.id),
    ),
  });
  if (!member) {
    res.status(403).json({ error: "Kamu bukan member group ini." });
    return;
  }

  try {
    await applyBoostSlotToConversation({
      slotId,
      actorUserId: user.id,
      conversationId,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Gagal menerapkan boost." });
  }
});

router.post("/me/membership/boosts/apply-bulk", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await syncTierIncludedBoostSlotsForUser(user.id);

  const conversationId = typeof req.body.conversationId === "number" ? req.body.conversationId : null;
  const boostCount = typeof req.body.boostCount === "number" ? req.body.boostCount : null;

  if (!conversationId || !boostCount || boostCount < 1) {
    res.status(400).json({ error: "conversationId dan boostCount diperlukan." });
    return;
  }

  const member = await db.query.conversationMembersTable.findFirst({
    where: and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, user.id),
    ),
  });
  if (!member) {
    res.status(403).json({ error: "Kamu bukan member group ini." });
    return;
  }

  const availableSlots = await db.query.boostSlotsTable.findMany({
    where: and(
      eq(boostSlotsTable.ownerUserId, user.id),
      eq(boostSlotsTable.status, "available"),
    ),
    orderBy: [asc(boostSlotsTable.id)],
  });

  if (availableSlots.length < boostCount) {
    res.status(400).json({ error: `Boost available kamu cuma ${availableSlots.length}.` });
    return;
  }

  try {
    for (const slot of availableSlots.slice(0, boostCount)) {
      await applyBoostSlotToConversation({
        slotId: slot.id,
        actorUserId: user.id,
        conversationId,
      });
    }
    res.json({ success: true, appliedCount: boostCount });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Gagal menerapkan boost." });
  }
});

router.post("/me/membership/boosts/revoke", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await syncTierIncludedBoostSlotsForUser(user.id);

  const slotId = typeof req.body.slotId === "number" ? req.body.slotId : null;
  if (!slotId) {
    res.status(400).json({ error: "slotId diperlukan." });
    return;
  }

  const slot = await db.query.boostSlotsTable.findFirst({ where: eq(boostSlotsTable.id, slotId) });
  if (!slot) {
    res.status(404).json({ error: "Boost slot tidak ditemukan." });
    return;
  }
  if (slot.ownerUserId !== user.id) {
    res.status(403).json({ error: "Kamu bukan pemilik boost slot ini." });
    return;
  }

  try {
    await revokeGroupBoostAssignment({
      slotId,
      actorUserId: user.id,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Gagal mencabut boost." });
  }
});

export default router;
