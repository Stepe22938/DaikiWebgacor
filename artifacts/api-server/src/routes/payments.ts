import { Router, type IRouter } from "express";
import { aliasedTable, and, asc, desc, eq } from "drizzle-orm";
import {
  boostSlotsTable,
  conversationMembersTable,
  conversationsTable,
  db,
  ticketsTable,
  userTierSubscriptionsTable,
  usersTable,
} from "@workspace/db";
import { getAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";
import {
  applyBoostSlotToConversation,
  createBoostOrderWithSlots,
  ensureBoostPackageSeeds,
  getGroupBoostState,
} from "../lib/tierBoosts";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

async function requireAdmin(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req);
  if (!auth.userId) return null;
  const user = await getDbUser(auth.userId);
  return user?.role === "admin" || user?.role === "dev_website" ? user : null;
}

function getPaymentDescription(params: {
  tier?: string | null;
  packageSku?: string | null;
  conversationName?: string | null;
  note?: string | null;
}) {
  const parts = ["Permintaan pembayaran membership / boost."];
  if (params.tier) parts.push(`Tier: ${params.tier}.`);
  if (params.packageSku) parts.push(`Boost package: ${params.packageSku}.`);
  if (params.conversationName) parts.push(`Target group: ${params.conversationName}.`);
  if (params.note) parts.push(`Catatan user: ${params.note}`);
  return parts.join(" ");
}

router.get("/me/payment-requests", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const rows = await db
    .select()
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.creatorId, user.id),
      eq(ticketsTable.ticketType, "payment"),
    ))
    .orderBy(desc(ticketsTable.createdAt));

  res.json(rows.map((row) => serializeDates(row)));
});

router.post("/payment-requests", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const requestedTier = typeof req.body?.tier === "string" ? req.body.tier : null;
  const requestedPackageSku = typeof req.body?.packageSku === "string" ? req.body.packageSku : null;
  const requestedConversationId = typeof req.body?.conversationId === "number" ? req.body.conversationId : null;
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;

  if (!requestedTier && !requestedPackageSku) {
    res.status(400).json({ error: "Pilih tier atau package boost dulu." });
    return;
  }

  let conversationName: string | null = null;
  if (requestedConversationId) {
    const membership = await db.query.conversationMembersTable.findFirst({
      where: and(
        eq(conversationMembersTable.conversationId, requestedConversationId),
        eq(conversationMembersTable.userId, user.id),
      ),
    });
    if (!membership) {
      res.status(403).json({ error: "Kamu bukan member group target." });
      return;
    }
    const conversation = await db.query.conversationsTable.findFirst({
      where: eq(conversationsTable.id, requestedConversationId),
    });
    conversationName = conversation?.name ?? "Unnamed Group";
  }

  // Auto-grant the requested tier subscription
  if (requestedTier) {
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1);
    await db.insert(userTierSubscriptionsTable).values({
      userId: user.id,
      tier: requestedTier,
      status: "active",
      source: "payment_auto",
      startsAt: new Date(),
      endsAt,
      autoRenews: false,
      notes: "Auto-granted on payment request",
    });

    if (!["admin", "staff", "dev", "dev_website"].includes(user.role)) {
      await db.update(usersTable)
        .set({ role: requestedTier, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }
  }

  // Auto-grant requested boost packages
  let createdOrderPackageSku: string | null = null;
  let createdOrderBoostCount = 0;
  if (requestedPackageSku) {
    await ensureBoostPackageSeeds();
    const created = await createBoostOrderWithSlots({
      buyerUserId: user.id,
      packageSku: requestedPackageSku,
      notes: "Auto-granted on payment request",
    });
    createdOrderPackageSku = created.package.sku;
    createdOrderBoostCount = created.package.boostCount;
  }

  // Auto-apply boosts to the conversation if specified
  if (requestedConversationId && createdOrderBoostCount > 0) {
    const availableSlots = await db
      .select({ id: boostSlotsTable.id })
      .from(boostSlotsTable)
      .where(and(
        eq(boostSlotsTable.ownerUserId, user.id),
        eq(boostSlotsTable.status, "available"),
      ))
      .orderBy(asc(boostSlotsTable.id));

    const boostApplications = Math.min(availableSlots.length, createdOrderBoostCount);
    for (const slot of availableSlots.slice(0, boostApplications)) {
      await applyBoostSlotToConversation({
        slotId: slot.id,
        actorUserId: user.id,
        ownerOverrideUserId: user.id,
        conversationId: requestedConversationId,
      });
    }
  }

  const adminNotes = `Auto-granted tier=${requestedTier ?? "-"} boostPackage=${requestedPackageSku ?? "-"}`;

  const [ticket] = await db.insert(ticketsTable).values({
    creatorId: user.id,
    ticketType: "payment",
    reason: "Payment / Premium & Boost",
    description: getPaymentDescription({
      tier: requestedTier,
      packageSku: requestedPackageSku,
      conversationName,
      note,
    }),
    status: "resolved",
    paymentStatus: "paid",
    requestedTier,
    requestedPackageSku,
    requestedConversationId,
    grantedAt: new Date(),
    adminNotes,
  }).returning();

  res.status(201).json(serializeDates(ticket));
});

router.get("/admin/payments", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const admin = await requireAdmin(req);
  if (!admin) { res.status(auth.userId ? 403 : 401).json({ error: auth.userId ? "Forbidden" : "Unauthorized" }); return; }

  const creators = aliasedTable(usersTable, "creators");
  const admins = aliasedTable(usersTable, "admins");
  const groups = aliasedTable(conversationsTable, "groups");

  const rows = await db
    .select({
      id: ticketsTable.id,
      creatorId: ticketsTable.creatorId,
      ticketType: ticketsTable.ticketType,
      reason: ticketsTable.reason,
      description: ticketsTable.description,
      status: ticketsTable.status,
      paymentStatus: ticketsTable.paymentStatus,
      requestedTier: ticketsTable.requestedTier,
      requestedPackageSku: ticketsTable.requestedPackageSku,
      requestedConversationId: ticketsTable.requestedConversationId,
      adminNotes: ticketsTable.adminNotes,
      grantedAt: ticketsTable.grantedAt,
      adminId: ticketsTable.adminId,
      createdAt: ticketsTable.createdAt,
      updatedAt: ticketsTable.updatedAt,
      creatorUsername: creators.username,
      creatorDisplayName: creators.displayName,
      adminUsername: admins.username,
      adminDisplayName: admins.displayName,
      requestedConversationName: groups.name,
    })
    .from(ticketsTable)
    .innerJoin(creators, eq(ticketsTable.creatorId, creators.id))
    .leftJoin(admins, eq(ticketsTable.adminId, admins.id))
    .leftJoin(groups, eq(ticketsTable.requestedConversationId, groups.id))
    .where(eq(ticketsTable.ticketType, "payment"))
    .orderBy(desc(ticketsTable.createdAt));

  res.json(rows.map((row) => serializeDates(row)));
});

router.patch("/admin/payments/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const admin = await requireAdmin(req);
  if (!admin) { res.status(auth.userId ? 403 : 401).json({ error: auth.userId ? "Forbidden" : "Unauthorized" }); return; }

  const ticketId = parseInt(req.params.id, 10);
  const ticket = await db.query.ticketsTable.findFirst({ where: eq(ticketsTable.id, ticketId) });
  if (!ticket || ticket.ticketType !== "payment") { res.status(404).json({ error: "Payment ticket not found" }); return; }

  const paymentStatus = typeof req.body?.paymentStatus === "string" ? req.body.paymentStatus : ticket.paymentStatus;
  const adminNotes = typeof req.body?.adminNotes === "string" ? req.body.adminNotes.trim() : ticket.adminNotes;
  const grantTier = typeof req.body?.grantTier === "string" ? req.body.grantTier : ticket.requestedTier;
  const grantPackageSku = typeof req.body?.grantPackageSku === "string" ? req.body.grantPackageSku : ticket.requestedPackageSku;
  const targetConversationId = typeof req.body?.targetConversationId === "number" ? req.body.targetConversationId : ticket.requestedConversationId;
  const applyBoostCount = typeof req.body?.applyBoostCount === "number" ? req.body.applyBoostCount : 0;

  const updates: Record<string, unknown> = {
    adminId: admin.id,
    adminNotes,
    paymentStatus,
    updatedAt: new Date(),
  };

  if (paymentStatus === "paid") {
    if (ticket.grantedAt) {
      res.status(400).json({ error: "Payment ini sudah pernah digrant." });
      return;
    }

    if (grantTier) {
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
        notes: `Granted from payment ticket #${ticket.id}`,
      });

      const targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, ticket.creatorId) });
      if (targetUser && !["admin", "staff", "dev", "dev_website"].includes(targetUser.role)) {
        await db.update(usersTable)
          .set({ role: grantTier, updatedAt: new Date() })
          .where(eq(usersTable.id, ticket.creatorId));
      }
    }

    let createdOrderPackageSku: string | null = null;
    let createdOrderBoostCount = 0;
    if (grantPackageSku) {
      await ensureBoostPackageSeeds();
      const created = await createBoostOrderWithSlots({
        buyerUserId: ticket.creatorId,
        packageSku: grantPackageSku,
        notes: `Granted from payment ticket #${ticket.id}`,
      });
      createdOrderPackageSku = created.package.sku;
      createdOrderBoostCount = created.package.boostCount;
    }

    const boostApplications = applyBoostCount > 0 ? applyBoostCount : (targetConversationId && createdOrderBoostCount > 0 ? createdOrderBoostCount : 0);
    if (targetConversationId && boostApplications > 0) {
      const availableSlots = await db
        .select({ id: boostSlotsTable.id })
        .from(boostSlotsTable)
        .where(and(
          eq(boostSlotsTable.ownerUserId, ticket.creatorId),
          eq(boostSlotsTable.status, "available"),
        ))
        .orderBy(asc(boostSlotsTable.id));

      if (availableSlots.length < boostApplications) {
        res.status(400).json({ error: "Boost slot available tidak cukup untuk ditempel ke group." });
        return;
      }

      for (const slot of availableSlots.slice(0, boostApplications)) {
        await applyBoostSlotToConversation({
          slotId: slot.id,
          actorUserId: admin.id,
          ownerOverrideUserId: ticket.creatorId,
          conversationId: targetConversationId,
        });
      }
    }

    updates.status = "resolved";
    updates.grantedAt = new Date();
    if (!updates.adminNotes && (grantTier || createdOrderPackageSku)) {
      updates.adminNotes = `Granted tier=${grantTier ?? "-"} boostPackage=${createdOrderPackageSku ?? "-"}`;
    }
  } else if (paymentStatus === "rejected") {
    updates.status = "closed";
  }

  const [updated] = await db
    .update(ticketsTable)
    .set(updates)
    .where(eq(ticketsTable.id, ticketId))
    .returning();

  res.json(serializeDates(updated));
});

router.post("/admin/membership-grants", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const admin = await requireAdmin(req);
  if (!admin) { res.status(auth.userId ? 403 : 401).json({ error: auth.userId ? "Forbidden" : "Unauthorized" }); return; }

  const userId = typeof req.body?.userId === "number" ? req.body.userId : null;
  const grantTier = typeof req.body?.grantTier === "string" ? req.body.grantTier : null;
  const grantPackageSku = typeof req.body?.grantPackageSku === "string" ? req.body.grantPackageSku : null;
  const targetConversationId = typeof req.body?.targetConversationId === "number" ? req.body.targetConversationId : null;
  const applyBoostCount = typeof req.body?.applyBoostCount === "number" ? req.body.applyBoostCount : 0;

  if (!userId || (!grantTier && !grantPackageSku)) {
    res.status(400).json({ error: "userId dan grant diperlukan." });
    return;
  }

  if (grantTier) {
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1);
    await db.insert(userTierSubscriptionsTable).values({
      userId,
      tier: grantTier,
      status: "active",
      source: "admin_manual",
      startsAt: new Date(),
      endsAt,
      autoRenews: false,
      notes: `Manual grant by admin #${admin.id}`,
    });

    const targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (targetUser && !["admin", "staff", "dev", "dev_website"].includes(targetUser.role)) {
      await db.update(usersTable)
        .set({ role: grantTier, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
    }
  }

  if (grantPackageSku) {
    await ensureBoostPackageSeeds();
    await createBoostOrderWithSlots({
      buyerUserId: userId,
      packageSku: grantPackageSku,
      notes: `Manual admin grant by #${admin.id}`,
    });
  }

  if (targetConversationId && applyBoostCount > 0) {
    const availableSlots = await db
      .select({ id: boostSlotsTable.id })
      .from(boostSlotsTable)
      .where(and(
        eq(boostSlotsTable.ownerUserId, userId),
        eq(boostSlotsTable.status, "available"),
      ))
      .orderBy(asc(boostSlotsTable.id));

    for (const slot of availableSlots.slice(0, applyBoostCount)) {
      await applyBoostSlotToConversation({
        slotId: slot.id,
        actorUserId: admin.id,
        ownerOverrideUserId: userId,
        conversationId: targetConversationId,
      });
    }
  }

  res.status(201).json({ ok: true });
});

router.get("/conversations/:id/boosts", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const conversationId = parseInt(req.params.id, 10);
  const member = await db.query.conversationMembersTable.findFirst({
    where: and(
      eq(conversationMembersTable.conversationId, conversationId),
      eq(conversationMembersTable.userId, user.id),
    ),
  });
  if (!member) { res.status(403).json({ error: "Forbidden" }); return; }

  const conversation = await db.query.conversationsTable.findFirst({
    where: eq(conversationsTable.id, conversationId),
  });
  const state = await getGroupBoostState(conversationId);
  res.json(serializeDates({
    conversationId,
    conversationName: conversation?.name ?? "Unnamed Group",
    ...state,
  }));
});

export default router;
