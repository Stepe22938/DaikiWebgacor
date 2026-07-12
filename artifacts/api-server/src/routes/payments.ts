import { Router, type IRouter } from "express";
import { aliasedTable, and, asc, desc, eq, like, sql } from "drizzle-orm";
import {
  boostSlotsTable,
  conversationMembersTable,
  conversationsTable,
  db,
  ticketsTable,
  userTierSubscriptionsTable,
  usersTable,
  systemSettingsTable,
  boostPackagesTable,
  premiumGiftsTable,
  walletTransactionsTable,
  productOrdersTable,
} from "@workspace/db";
import { getAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";
import crypto from "crypto";
import {
  ensureBoostPackageSeeds,
  createBoostOrderWithSlots,
  applyBoostSlotToConversation,
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

  // 1. Get SayaBayar configurations
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

  if (!apiKey) {
    res.status(400).json({ error: "SayaBayar API Key belum dikonfigurasi di pengaturan admin." });
    return;
  }

  // 2. Compute exact price
  let priceIdr = 0;
  if (requestedTier) {
    if (requestedTier === "premium") {
      priceIdr = settings.premiumPrice ?? 25000;
    } else if (requestedTier === "premium_plus") {
      priceIdr = settings.premiumPlusPrice ?? 50000;
    } else {
      res.status(400).json({ error: "Membership tier tidak valid." });
      return;
    }
  } else if (requestedPackageSku) {
    const pkg = await db.query.boostPackagesTable.findFirst({
      where: eq(boostPackagesTable.sku, requestedPackageSku),
    });
    if (!pkg) {
      res.status(404).json({ error: "Package boost tidak ditemukan." });
      return;
    }
    // Use discount price if one is set, otherwise use regular price
    priceIdr = pkg.discountPriceIdr ?? pkg.priceIdr;
  }

  if (priceIdr <= 0) {
    res.status(400).json({ error: "Harga tidak valid." });
    return;
  }

  // 3. Create SayaBayar invoice
  let invoiceData: any;
  try {
    const description = getPaymentDescription({
      tier: requestedTier,
      packageSku: requestedPackageSku,
      conversationName,
      note,
    });

    const email = `${user.username || "user"}_${user.id}@arcadiamc.net`;
    const customerName = user.displayName || user.username || `Player #${user.id}`;
    const origin = req.headers.origin || "http://localhost:5173";
    const redirectUrl = `${origin}/premium`;

    const apiResponse = await fetch("https://api.sayabayar.com/v1/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        customer_name: customerName,
        customer_email: email,
        amount: priceIdr,
        description: description,
        channel_preference: "platform",
        redirect_url: redirectUrl,
      }),
    });

    const resJson = await apiResponse.json() as any;

    if (!apiResponse.ok) {
      console.error("SayaBayar API Error response:", JSON.stringify(resJson, null, 2));
      res.status(apiResponse.status).json({
        error: resJson?.error?.message || resJson?.message || resJson?.error || "Gagal membuat invoice di SayaBayar.",
      });
      return;
    }

    invoiceData = resJson.data;
    if (!invoiceData || !invoiceData.payment_url) {
      throw new Error("Missing invoice data or payment_url from SayaBayar.");
    }
  } catch (error: any) {
    console.error("Error creating SayaBayar invoice:", error);
    res.status(500).json({ error: error.message || "Terjadi kesalahan koneksi saat membuat invoice." });
    return;
  }

  // 4. Create the payment ticket
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
    status: "open",
    paymentStatus: "pending_review",
    requestedTier,
    requestedPackageSku,
    requestedConversationId,
    grantedAt: null,
    adminNotes: `[SayaBayar ID: ${invoiceData.id}]${note ? ' | ' + note : ''}`,
  }).returning();

  res.status(201).json(serializeDates({
    ...ticket,
    checkoutUrl: invoiceData.payment_url,
  }));
});

router.post("/payments/sayabayar/webhook", async (req, res): Promise<void> => {
  try {
    const event = req.body?.event;
    const status = req.body?.data?.status;
    const invoiceId = req.body?.data?.invoice_id;

    if (event !== "invoice.paid" || status !== "paid" || !invoiceId) {
      res.json({ ok: true, message: "Ignoring non-paid event" });
      return;
    }

    const settingsRow = await db.query.systemSettingsTable.findFirst({
      where: eq(systemSettingsTable.key, "homepage_settings"),
    });
    const settings = (settingsRow?.value || {}) as any;
    const webhookSecret = settings.sayabayarWebhookSecret;

    if (webhookSecret) {
      const signature = req.headers["x-webhook-signature"];
      if (!signature || typeof signature !== "string") {
        res.status(400).json({ error: "Missing signature header" });
        return;
      }
      const rawBody = (req as any).rawBody ? (req as any).rawBody.toString("utf8") : "";
      const computedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");
      
      if (computedSignature !== signature) {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    // 1. Check if this is a product purchase order
    const [order] = await db
      .select()
      .from(productOrdersTable)
      .where(eq(productOrdersTable.invoiceId, invoiceId))
      .limit(1);

    if (order) {
      if (order.status === "pending") {
        await db
          .update(productOrdersTable)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(productOrdersTable.id, order.id));
      }
      res.json({ ok: true, message: "Product order marked as completed (paid)" });
      return;
    }

    const likePattern = `%[SayaBayar ID: ${invoiceId}]%`;
    const [ticket] = await db
      .select()
      .from(ticketsTable)
      .where(and(
        eq(ticketsTable.ticketType, "payment"),
        like(ticketsTable.adminNotes, likePattern)
      ))
      .limit(1);

    if (!ticket) {
      res.status(404).json({ error: "No matching payment ticket found" });
      return;
    }

    if (ticket.paymentStatus === "paid") {
      res.json({ ok: true, message: "Payment already processed" });
      return;
    }

    // Grant membership/boost logic
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
          description: `Top up saldo via SayaBayar (ticket #${ticket.id})`,
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
        notes: `Granted automatically via SayaBayar Webhook for ticket #${ticket.id}`,
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
        notes: `Granted automatically via SayaBayar Webhook for ticket #${ticket.id}`,
      });
      createdOrderPackageSku = created.package.sku;
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
        adminNotes: currentNotes ? `${currentNotes} | Auto-Approved via SayaBayar Webhook` : "Auto-Approved via SayaBayar Webhook",
      })
      .where(eq(ticketsTable.id, ticket.id));

    res.json({ ok: true, message: "Payment processed successfully and rewards granted" });
  } catch (err: any) {
    console.error("Error processing SayaBayar webhook:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
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

router.get("/admin/premium-stats", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const admin = await requireAdmin(req);
  if (!admin) { res.status(auth.userId ? 403 : 401).json({ error: auth.userId ? "Forbidden" : "Unauthorized" }); return; }

  const activeSubs = await db
    .select({
      id: userTierSubscriptionsTable.id,
      userId: userTierSubscriptionsTable.userId,
      tier: userTierSubscriptionsTable.tier,
      source: userTierSubscriptionsTable.source,
      startsAt: userTierSubscriptionsTable.startsAt,
      endsAt: userTierSubscriptionsTable.endsAt,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(userTierSubscriptionsTable)
    .innerJoin(usersTable, eq(userTierSubscriptionsTable.userId, usersTable.id))
    .where(eq(userTierSubscriptionsTable.status, "active"));

  const sourceCounts: Record<string, number> = {
    payment_ticket: 0,
    payment_auto: 0,
    gift_redeem: 0,
    token_shop: 0,
    admin_manual: 0,
    other: 0,
  };

  const tierCounts: Record<string, number> = {
    premium: 0,
    premium_plus: 0,
  };

  activeSubs.forEach((sub) => {
    const src = sub.source;
    if (src in sourceCounts) {
      sourceCounts[src]++;
    } else {
      sourceCounts.other++;
    }

    const tier = sub.tier;
    if (tier in tierCounts) {
      tierCounts[tier]++;
    }
  });

  const paymentsList = await db
    .select({
      id: ticketsTable.id,
      creatorUsername: usersTable.username,
      creatorDisplayName: usersTable.displayName,
      requestedTier: ticketsTable.requestedTier,
      createdAt: ticketsTable.createdAt,
      grantedAt: ticketsTable.grantedAt,
      paymentStatus: ticketsTable.paymentStatus,
    })
    .from(ticketsTable)
    .innerJoin(usersTable, eq(ticketsTable.creatorId, usersTable.id))
    .where(and(eq(ticketsTable.ticketType, "payment"), eq(ticketsTable.paymentStatus, "paid")))
    .orderBy(desc(ticketsTable.createdAt))
    .limit(20);

  const coinRedemptionsCount = await db
    .select({ count: sql`count(*)` })
    .from(userTierSubscriptionsTable)
    .where(eq(userTierSubscriptionsTable.source, "token_shop"));

  res.json({
    activeSubscriptions: activeSubs.map(serializeDates),
    summary: {
      totalActive: activeSubs.length,
      bySource: sourceCounts,
      byTier: tierCounts,
      totalCoinRedeemedCount: Number(coinRedemptionsCount[0]?.count ?? 0),
    },
    paymentsList: paymentsList.map(serializeDates),
  });
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
          description: `Top up saldo (disetujui admin, ticket #${ticket.id})`,
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

// POST /api/payments/gifts
router.post("/payments/gifts", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { tier } = req.body;
  if (tier !== "premium" && tier !== "premium_plus") {
    res.status(400).json({ error: "Membership tier tidak valid untuk gift." });
    return;
  }

  // 1. Get SayaBayar configurations
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

  if (!apiKey) {
    res.status(400).json({ error: "SayaBayar API Key belum dikonfigurasi di pengaturan admin." });
    return;
  }

  // 2. Compute exact price
  let priceIdr = tier === "premium" ? (settings.giftPremiumPrice ?? settings.premiumPrice) : (settings.giftPremiumPlusPrice ?? settings.premiumPlusPrice);
  if (!priceIdr || priceIdr <= 0) {
    priceIdr = tier === "premium" ? 25000 : 50000;
  }

  const giftCode = `gft_${crypto.randomBytes(16).toString("hex")}`;
  const description = `Gift ${tier === "premium_plus" ? "Premium+" : "Premium"} Membership`;

  // 3. Create SayaBayar invoice
  let invoiceData: any;
  try {
    const email = `${user.username || "user"}_${user.id}_gift@arcadiamc.net`;
    const customerName = user.displayName || user.username || `Player #${user.id}`;
    const origin = req.headers.origin || "http://localhost:5173";
    const redirectUrl = `${origin}/premium`;

    const apiResponse = await fetch("https://api.sayabayar.com/v1/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        customer_name: customerName,
        customer_email: email,
        amount: priceIdr,
        description: description,
        channel_preference: "platform",
        redirect_url: redirectUrl,
      }),
    });

    const resJson = await apiResponse.json() as any;

    if (!apiResponse.ok) {
      console.error("SayaBayar API Error response (Gift):", JSON.stringify(resJson, null, 2));
      res.status(apiResponse.status).json({
        error: resJson?.error?.message || resJson?.message || resJson?.error || "Gagal membuat invoice di SayaBayar.",
      });
      return;
    }

    invoiceData = resJson.data;
    if (!invoiceData || !invoiceData.payment_url) {
      throw new Error("Missing invoice data or payment_url from SayaBayar.");
    }
  } catch (error: any) {
    console.error("Error creating SayaBayar invoice for Gift:", error);
    res.status(500).json({ error: error.message || "Terjadi kesalahan koneksi saat membuat invoice." });
    return;
  }

  // 4. Create the payment ticket & premium gift entry
  const [ticket] = await db.insert(ticketsTable).values({
    creatorId: user.id,
    ticketType: "payment",
    reason: `Gift: ${tier}`,
    description: `Pembelian Gift ${tier === "premium_plus" ? "Premium+" : "Premium"} oleh @${user.username}`,
    status: "open",
    paymentStatus: "pending_review",
    requestedTier: tier,
    grantedAt: null,
    adminNotes: `[SayaBayar ID: ${invoiceData.id}] [Gift Code: ${giftCode}]`,
  }).returning();

  await db.insert(premiumGiftsTable).values({
    giftCode,
    buyerId: user.id,
    tier,
    status: "pending",
    ticketId: ticket.id,
  });

  res.status(201).json(serializeDates({
    checkoutUrl: invoiceData.payment_url,
    giftCode,
  }));
});

// GET /api/me/gifts
router.get("/me/gifts", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const gifts = await db
    .select({
      id: premiumGiftsTable.id,
      giftCode: premiumGiftsTable.giftCode,
      tier: premiumGiftsTable.tier,
      status: premiumGiftsTable.status,
      createdAt: premiumGiftsTable.createdAt,
      redeemedAt: premiumGiftsTable.redeemedAt,
      receiverUsername: usersTable.username,
      receiverDisplayName: usersTable.displayName,
    })
    .from(premiumGiftsTable)
    .leftJoin(usersTable, eq(premiumGiftsTable.receiverId, usersTable.id))
    .where(eq(premiumGiftsTable.buyerId, user.id))
    .orderBy(desc(premiumGiftsTable.createdAt));

  res.json(gifts.map(serializeDates));
});

// GET /api/payments/gifts/check/:code
router.get("/payments/gifts/check/:code", async (req, res): Promise<void> => {
  const { code } = req.params;
  if (!code) {
    res.status(400).json({ error: "Gift code is required." });
    return;
  }

  const buyers = aliasedTable(usersTable, "buyers");
  const receivers = aliasedTable(usersTable, "receivers");

  const [gift] = await db
    .select({
      id: premiumGiftsTable.id,
      giftCode: premiumGiftsTable.giftCode,
      tier: premiumGiftsTable.tier,
      status: premiumGiftsTable.status,
      createdAt: premiumGiftsTable.createdAt,
      redeemedAt: premiumGiftsTable.redeemedAt,
      buyerUsername: buyers.username,
      buyerDisplayName: buyers.displayName,
      receiverUsername: receivers.username,
      receiverDisplayName: receivers.displayName,
    })
    .from(premiumGiftsTable)
    .innerJoin(buyers, eq(premiumGiftsTable.buyerId, buyers.id))
    .leftJoin(receivers, eq(premiumGiftsTable.receiverId, receivers.id))
    .where(eq(premiumGiftsTable.giftCode, code.trim()))
    .limit(1);

  if (!gift) {
    res.status(404).json({ error: "Gift code tidak ditemukan." });
    return;
  }

  res.json(serializeDates(gift));
});

// POST /api/payments/gifts/redeem
router.post("/payments/gifts/redeem", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Gift code is required." });
    return;
  }

  const gift = await db.query.premiumGiftsTable.findFirst({
    where: eq(premiumGiftsTable.giftCode, code.trim()),
  });

  if (!gift) {
    res.status(404).json({ error: "Gift code tidak valid." });
    return;
  }

  if (gift.status === "pending") {
    res.status(400).json({ error: "Gift ini belum dibayar." });
    return;
  }

  if (gift.status === "redeemed") {
    res.status(400).json({ error: "Gift ini sudah diredeem oleh orang lain." });
    return;
  }

  if (gift.buyerId === user.id) {
    res.status(400).json({ error: "Kamu tidak bisa meredeem gift yang kamu beli sendiri." });
    return;
  }

  // Perform redemption transaction
  await db.transaction(async (tx) => {
    // 1. Mark gift as redeemed
    await tx
      .update(premiumGiftsTable)
      .set({
        status: "redeemed",
        receiverId: user.id,
        redeemedAt: new Date(),
      })
      .where(eq(premiumGiftsTable.id, gift.id));

    // 2. Grant subscription to user
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1);

    await tx.insert(userTierSubscriptionsTable).values({
      userId: user.id,
      tier: gift.tier,
      status: "active",
      source: "gift_redeem",
      startsAt: new Date(),
      endsAt,
      autoRenews: false,
      notes: `Redeemed gift code ${gift.giftCode} from buyer #${gift.buyerId}`,
    });

    // 3. Update user role if applicable
    if (!["admin", "staff", "dev", "dev_website"].includes(user.role)) {
      await tx.update(usersTable)
        .set({ role: gift.tier as any, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }
  });

  res.status(200).json({ success: true, tier: gift.tier });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rupiah Wallet (saldo) + Diamond conversion
// ─────────────────────────────────────────────────────────────────────────────

async function getWalletSettings() {
  const settingsRow = await db.query.systemSettingsTable.findFirst({
    where: eq(systemSettingsTable.key, "homepage_settings"),
  });
  const settings = {
    sayabayarApiKey: "",
    diamondPackRupiah: 17000,
    diamondPackDiamonds: 100,
    ...(settingsRow?.value || {} as any),
  };
  return settings;
}

// Pull-based fallback for top ups: if the SayaBayar webhook never reached us
// (e.g. local dev / webhook not configured), check pending top-up invoices
// directly and credit the balance when they are already paid.
async function syncPendingTopups(userId: number, apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  let creditedAny = false;
  const pending = await db
    .select()
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.creatorId, userId),
      eq(ticketsTable.ticketType, "payment"),
      eq(ticketsTable.paymentStatus, "pending_review"),
    ));

  for (const ticket of pending) {
    const topupMatch = ticket.adminNotes?.match(/\[Wallet Topup:\s*(\d+)\]/);
    const idMatch = ticket.adminNotes?.match(/\[SayaBayar ID:\s*([^\]\s]+)\]/);
    if (!topupMatch || !idMatch) continue;
    const invoiceId = idMatch[1];
    try {
      const apiResponse = await fetch(`https://api.sayabayar.com/v1/invoices/${invoiceId}`, {
        method: "GET",
        headers: { "X-API-Key": apiKey },
      });
      if (!apiResponse.ok) continue;
      const resJson = await apiResponse.json() as any;
      const status = resJson?.data?.status;
      if (status !== "paid" && status !== "success") continue;

      const amount = parseInt(topupMatch[1], 10);
      const targetUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
      if (targetUser && amount > 0) {
        await db.update(usersTable)
          .set({ balanceRp: (targetUser.balanceRp ?? 0) + amount, updatedAt: new Date() })
          .where(eq(usersTable.id, userId));
        await db.insert(walletTransactionsTable).values({
          userId,
          amount,
          currency: "rp",
          type: "topup",
          description: `Top up saldo via SayaBayar (sync, ticket #${ticket.id})`,
        });
        creditedAny = true;
      }

      const currentNotes = ticket.adminNotes || "";
      await db.update(ticketsTable)
        .set({
          paymentStatus: "paid",
          status: "resolved",
          grantedAt: new Date(),
          updatedAt: new Date(),
          adminNotes: currentNotes ? `${currentNotes} | Auto-Approved via Wallet Sync` : "Auto-Approved via Wallet Sync",
        })
        .where(eq(ticketsTable.id, ticket.id));
    } catch (err) {
      console.error(`Error syncing top-up invoice ${invoiceId}:`, err);
    }
  }
  return creditedAny;
}

// GET /api/me/wallet — current Rp balance, diamonds, and conversion rate.
router.get("/me/wallet", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  let user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const settings = await getWalletSettings();

  // Credit any top-ups that were already paid but not yet reflected (webhook fallback).
  const credited = await syncPendingTopups(user.id, settings.sayabayarApiKey);
  if (credited) {
    user = (await getDbUser(auth.userId)) ?? user;
  }

  res.json({
    balanceRp: user.balanceRp ?? 0,
    diamonds: user.diamonds ?? 0,
    diamondPackRupiah: settings.diamondPackRupiah ?? 17000,
    diamondPackDiamonds: settings.diamondPackDiamonds ?? 100,
  });
});

// POST /api/me/wallet/topup — start a SayaBayar payment to top up Rp balance.
router.post("/me/wallet/topup", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const amount = typeof req.body?.amount === "number" ? Math.floor(req.body.amount) : 0;
  if (!amount || amount < 1000) {
    res.status(400).json({ error: "Nominal top up minimal Rp 1.000." });
    return;
  }
  if (amount > 10000000) {
    res.status(400).json({ error: "Nominal top up maksimal Rp 10.000.000." });
    return;
  }

  const settings = await getWalletSettings();
  const apiKey = settings.sayabayarApiKey;
  if (!apiKey) {
    res.status(400).json({ error: "SayaBayar API Key belum dikonfigurasi di pengaturan admin." });
    return;
  }

  let invoiceData: any;
  try {
    const email = `${user.username || "user"}_${user.id}_topup@arcadiamc.net`;
    const customerName = user.displayName || user.username || `Player #${user.id}`;
    const origin = req.headers.origin || "http://localhost:5173";
    const redirectUrl = `${origin}/member?tab=wallet`;

    const apiResponse = await fetch("https://api.sayabayar.com/v1/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        customer_name: customerName,
        customer_email: email,
        amount: amount,
        description: `Top up saldo Rp ${amount.toLocaleString("id-ID")}`,
        channel_preference: "platform",
        redirect_url: redirectUrl,
      }),
    });

    const resJson = await apiResponse.json() as any;
    if (!apiResponse.ok) {
      console.error("SayaBayar API Error response (Topup):", JSON.stringify(resJson, null, 2));
      res.status(apiResponse.status).json({
        error: resJson?.error?.message || resJson?.message || resJson?.error || "Gagal membuat invoice di SayaBayar.",
      });
      return;
    }

    invoiceData = resJson.data;
    if (!invoiceData || !invoiceData.payment_url) {
      throw new Error("Missing invoice data or payment_url from SayaBayar.");
    }
  } catch (error: any) {
    console.error("Error creating SayaBayar invoice for Topup:", error);
    res.status(500).json({ error: error.message || "Terjadi kesalahan koneksi saat membuat invoice." });
    return;
  }

  await db.insert(ticketsTable).values({
    creatorId: user.id,
    ticketType: "payment",
    reason: "Wallet Topup",
    description: `Top up saldo Rp ${amount.toLocaleString("id-ID")} oleh @${user.username}`,
    status: "open",
    paymentStatus: "pending_review",
    requestedTier: null,
    grantedAt: null,
    adminNotes: `[SayaBayar ID: ${invoiceData.id}] [Wallet Topup: ${amount}]`,
  });

  res.status(201).json(serializeDates({ checkoutUrl: invoiceData.payment_url, amount }));
});

// POST /api/me/wallet/convert — convert Rp balance into diamonds at the admin rate.
router.post("/me/wallet/convert", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const rupiah = typeof req.body?.rupiah === "number" ? Math.floor(req.body.rupiah) : 0;
  if (!rupiah || rupiah <= 0) {
    res.status(400).json({ error: "Jumlah rupiah yang ditukar tidak valid." });
    return;
  }

  const settings = await getWalletSettings();
  const packRupiah = Number(settings.diamondPackRupiah) || 17000;
  const packDiamonds = Number(settings.diamondPackDiamonds) || 100;

  const diamonds = Math.floor((rupiah * packDiamonds) / packRupiah);
  if (diamonds < 1) {
    res.status(400).json({ error: `Minimal tukar Rp ${Math.ceil(packRupiah / packDiamonds).toLocaleString("id-ID")} untuk dapat 1 diamond.` });
    return;
  }
  // Charge only the exact rupiah needed for the diamonds granted (never more than requested).
  const cost = Math.ceil((diamonds * packRupiah) / packDiamonds);

  if ((user.balanceRp ?? 0) < cost) {
    res.status(400).json({ error: "Saldo Rupiah kamu tidak cukup." });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.update(usersTable)
      .set({
        balanceRp: (user.balanceRp ?? 0) - cost,
        diamonds: (user.diamonds ?? 0) + diamonds,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    await tx.insert(walletTransactionsTable).values({
      userId: user.id,
      amount: -cost,
      currency: "rp",
      type: "convert_spend",
      description: `Tukar Rp ${cost.toLocaleString("id-ID")} ke ${diamonds} diamond`,
    });
    await tx.insert(walletTransactionsTable).values({
      userId: user.id,
      amount: diamonds,
      currency: "diamond",
      type: "convert_receive",
      description: `Hasil tukar dari Rp ${cost.toLocaleString("id-ID")}`,
    });
  });

  res.json({
    success: true,
    spentRp: cost,
    diamondsAdded: diamonds,
    balanceRp: (user.balanceRp ?? 0) - cost,
    diamonds: (user.diamonds ?? 0) + diamonds,
  });
});

export default router;
