import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, desc, asc, aliasedTable } from "drizzle-orm";
import { db, usersTable, ticketsTable, ticketMessagesTable, ticketReasonsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListTicketsResponse,
  CreateTicketBody,
  ListTicketReasonsResponse,
  ListAdminTicketReasonsResponse,
  ListAdminTicketReasonsResponseItem,
  CreateTicketReasonBody,
  UpdateTicketReasonParams,
  UpdateTicketReasonBody,
  UpdateTicketReasonResponse,
  DeleteTicketReasonParams,
  UpdateTicketBody,
  UpdateTicketResponse,
  ListTicketMessagesResponse,
  SendTicketMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

async function requireAdmin(req: Parameters<typeof getAuth>[0]) {
  const auth = getAuth(req);
  if (!auth.userId) return null;
  const user = await getDbUser(auth.userId);
  return user?.role === "admin" ? user : null;
}

function canManageTickets(user: typeof usersTable.$inferSelect) {
  return user.role === "admin" || user.role === "dev";
}

router.get("/ticket-reasons", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(ticketReasonsTable)
    .where(eq(ticketReasonsTable.isActive, true))
    .orderBy(asc(ticketReasonsTable.order), asc(ticketReasonsTable.id));

  res.json(ListTicketReasonsResponse.parse(rows.map((r) => serializeDates(r))));
});

router.get("/admin/ticket-reasons", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const admin = await requireAdmin(req);
  if (!admin) { res.status(auth.userId ? 403 : 401).json({ error: auth.userId ? "Forbidden" : "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(ticketReasonsTable)
    .orderBy(asc(ticketReasonsTable.order), asc(ticketReasonsTable.id));

  res.json(ListAdminTicketReasonsResponse.parse(rows.map((r) => serializeDates(r))));
});

router.post("/admin/ticket-reasons", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const admin = await requireAdmin(req);
  if (!admin) { res.status(auth.userId ? 403 : 401).json({ error: auth.userId ? "Forbidden" : "Unauthorized" }); return; }

  const parsed = CreateTicketReasonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [inserted] = await db.insert(ticketReasonsTable).values({
      label: parsed.data.label.trim(),
      description: parsed.data.description?.trim() || null,
      isActive: parsed.data.isActive ?? true,
      order: parsed.data.order ?? 0,
    }).returning();

    res.status(201).json(ListAdminTicketReasonsResponseItem.parse(serializeDates(inserted)));
  } catch (err: any) {
    if (String(err?.message || "").includes("duplicate")) {
      res.status(409).json({ error: "Alasan tiket sudah ada." });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/ticket-reasons/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const admin = await requireAdmin(req);
  if (!admin) { res.status(auth.userId ? 403 : 401).json({ error: auth.userId ? "Forbidden" : "Unauthorized" }); return; }

  const params = UpdateTicketReasonParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateTicketReasonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.label !== undefined) updateData.label = parsed.data.label.trim();
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description.trim() || null;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.order !== undefined) updateData.order = parsed.data.order;

  try {
    const [updated] = await db
      .update(ticketReasonsTable)
      .set(updateData)
      .where(eq(ticketReasonsTable.id, params.data.id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Ticket reason not found" }); return; }
    res.json(UpdateTicketReasonResponse.parse(serializeDates(updated)));
  } catch (err: any) {
    if (String(err?.message || "").includes("duplicate")) {
      res.status(409).json({ error: "Alasan tiket sudah ada." });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/ticket-reasons/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const admin = await requireAdmin(req);
  if (!admin) { res.status(auth.userId ? 403 : 401).json({ error: auth.userId ? "Forbidden" : "Unauthorized" }); return; }

  const params = DeleteTicketReasonParams.safeParse({ id: parseInt(req.params.id as string, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(ticketReasonsTable).where(eq(ticketReasonsTable.id, params.data.id));
  res.status(204).send();
});

router.get("/tickets", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const creators = aliasedTable(usersTable, "creators");
  const admins = aliasedTable(usersTable, "admins");

  const query = db
    .select({
      id: ticketsTable.id,
      creatorId: ticketsTable.creatorId,
      reason: ticketsTable.reason,
      description: ticketsTable.description,
      status: ticketsTable.status,
      adminId: ticketsTable.adminId,
      createdAt: ticketsTable.createdAt,
      updatedAt: ticketsTable.updatedAt,
      creatorUsername: creators.username,
      creatorDisplayName: creators.displayName,
      adminUsername: admins.username,
      adminDisplayName: admins.displayName,
    })
    .from(ticketsTable)
    .innerJoin(creators, eq(ticketsTable.creatorId, creators.id))
    .leftJoin(admins, eq(ticketsTable.adminId, admins.id));

  const rows = await (canManageTickets(user)
    ? query.orderBy(desc(ticketsTable.createdAt))
    : query.where(eq(ticketsTable.creatorId, user.id)).orderBy(desc(ticketsTable.createdAt)));

  res.json(ListTicketsResponse.parse(rows.map((r) => serializeDates(r))));
});

router.post("/tickets", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const activeReason = await db.query.ticketReasonsTable.findFirst({
    where: and(eq(ticketReasonsTable.label, parsed.data.reason), eq(ticketReasonsTable.isActive, true)),
  });
  if (!activeReason) {
    res.status(400).json({ error: "Alasan tiket tidak tersedia." });
    return;
  }

  const [inserted] = await db
    .insert(ticketsTable)
    .values({
      creatorId: user.id,
      reason: parsed.data.reason,
      description: parsed.data.description,
      status: "open",
    })
    .returning();

  const creators = aliasedTable(usersTable, "creators");
  const admins = aliasedTable(usersTable, "admins");

  const [row] = await db
    .select({
      id: ticketsTable.id,
      creatorId: ticketsTable.creatorId,
      reason: ticketsTable.reason,
      description: ticketsTable.description,
      status: ticketsTable.status,
      adminId: ticketsTable.adminId,
      createdAt: ticketsTable.createdAt,
      updatedAt: ticketsTable.updatedAt,
      creatorUsername: creators.username,
      creatorDisplayName: creators.displayName,
      adminUsername: admins.username,
      adminDisplayName: admins.displayName,
    })
    .from(ticketsTable)
    .innerJoin(creators, eq(ticketsTable.creatorId, creators.id))
    .leftJoin(admins, eq(ticketsTable.adminId, admins.id))
    .where(eq(ticketsTable.id, inserted.id));

  res.status(201).json(serializeDates(row));
});

router.patch("/tickets/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const ticketId = parseInt(req.params.id as string, 10);
  const ticket = await db.query.ticketsTable.findFirst({
    where: eq(ticketsTable.id, ticketId),
  });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const parsed = UpdateTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (!canManageTickets(user)) {
    if (ticket.creatorId !== user.id) {
      res.status(403).json({ error: "Forbidden: Not your ticket" });
      return;
    }
    // Members can only close their own ticket
    if (parsed.data.status !== "closed" || parsed.data.adminId !== undefined) {
      res.status(400).json({ error: "Members can only close their tickets" });
      return;
    }
    updateData.status = "closed";
  } else {
    // Admins and devs can change status or handler admin
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.adminId !== undefined) updateData.adminId = parsed.data.adminId;
  }

  const [updated] = await db
    .update(ticketsTable)
    .set(updateData)
    .where(eq(ticketsTable.id, ticketId))
    .returning();

  const creators = aliasedTable(usersTable, "creators");
  const admins = aliasedTable(usersTable, "admins");

  const [row] = await db
    .select({
      id: ticketsTable.id,
      creatorId: ticketsTable.creatorId,
      reason: ticketsTable.reason,
      description: ticketsTable.description,
      status: ticketsTable.status,
      adminId: ticketsTable.adminId,
      createdAt: ticketsTable.createdAt,
      updatedAt: ticketsTable.updatedAt,
      creatorUsername: creators.username,
      creatorDisplayName: creators.displayName,
      adminUsername: admins.username,
      adminDisplayName: admins.displayName,
    })
    .from(ticketsTable)
    .innerJoin(creators, eq(ticketsTable.creatorId, creators.id))
    .leftJoin(admins, eq(ticketsTable.adminId, admins.id))
    .where(eq(ticketsTable.id, updated.id));

  res.json(UpdateTicketResponse.parse(serializeDates(row)));
});

router.get("/tickets/:id/messages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const ticketId = parseInt(req.params.id as string, 10);
  const ticket = await db.query.ticketsTable.findFirst({
    where: eq(ticketsTable.id, ticketId),
  });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  if (!canManageTickets(user) && ticket.creatorId !== user.id) {
    res.status(403).json({ error: "Forbidden: Not your ticket" });
    return;
  }

  const senders = aliasedTable(usersTable, "senders");

  const rows = await db
    .select({
      id: ticketMessagesTable.id,
      ticketId: ticketMessagesTable.ticketId,
      senderId: ticketMessagesTable.senderId,
      content: ticketMessagesTable.content,
      createdAt: ticketMessagesTable.createdAt,
      senderUsername: senders.username,
      senderDisplayName: senders.displayName,
      senderAvatarUrl: senders.avatarUrl,
    })
    .from(ticketMessagesTable)
    .innerJoin(senders, eq(ticketMessagesTable.senderId, senders.id))
    .where(eq(ticketMessagesTable.ticketId, ticketId))
    .orderBy(asc(ticketMessagesTable.createdAt));

  res.json(ListTicketMessagesResponse.parse(rows.map((r) => serializeDates(r))));
});

router.post("/tickets/:id/messages", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const ticketId = parseInt(req.params.id as string, 10);
  const ticket = await db.query.ticketsTable.findFirst({
    where: eq(ticketsTable.id, ticketId),
  });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  if (!canManageTickets(user) && ticket.creatorId !== user.id) {
    res.status(403).json({ error: "Forbidden: Not your ticket" });
    return;
  }

  const parsed = SendTicketMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [inserted] = await db
    .insert(ticketMessagesTable)
    .values({
      ticketId,
      senderId: user.id,
      content: parsed.data.content,
    })
    .returning();

  res.status(201).json({
    ...serializeDates(inserted),
    senderUsername: user.username,
    senderDisplayName: user.displayName ?? null,
    senderAvatarUrl: user.avatarUrl ?? null,
  });
});

export default router;
