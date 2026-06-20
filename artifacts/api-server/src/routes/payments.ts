import { Router, type IRouter } from "express";
import { aliasedTable, and, asc, desc, eq, like } from "drizzle-orm";
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
