import { Router, type IRouter } from "express";
import { getAuth } from "../lib/auth";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  formsTable,
  formFieldsTable,
  pollOptionsTable,
  formResponsesTable,
  formAnswersTable,
} from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import * as zod from "zod";

const router: IRouter = Router();

async function getDbUser(clerkId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
}

function canManageForms(role: string | null | undefined) {
  return role === "admin" || role === "dev_website";
}

// Helper to build a full form detail (with fields/options + counts)
async function buildFormDetail(formId: number) {
  const form = await db.query.formsTable.findFirst({ where: eq(formsTable.id, formId) });
  if (!form) return null;

  const creator = form.createdBy
    ? await db.query.usersTable.findFirst({ where: eq(usersTable.id, form.createdBy) })
    : null;

  const fields = await db
    .select()
    .from(formFieldsTable)
    .where(eq(formFieldsTable.formId, formId))
    .orderBy(asc(formFieldsTable.order));

  // Poll options with vote counts
  const rawOptions = await db
    .select()
    .from(pollOptionsTable)
    .where(eq(pollOptionsTable.formId, formId))
    .orderBy(asc(pollOptionsTable.order));

  // Count votes per option
  const voteCountRows = await db
    .select({
      optionId: formResponsesTable.selectedOptionId,
      cnt: count(formResponsesTable.id),
    })
    .from(formResponsesTable)
    .where(
      and(
        eq(formResponsesTable.formId, formId),
        sql`${formResponsesTable.selectedOptionId} IS NOT NULL`
      )
    )
    .groupBy(formResponsesTable.selectedOptionId);

  const voteMap: Record<number, number> = {};
  for (const row of voteCountRows) {
    if (row.optionId !== null && row.optionId !== undefined) {
      voteMap[row.optionId] = Number(row.cnt);
    }
  }

  const options = rawOptions.map((o) => ({ ...o, voteCount: voteMap[o.id] ?? 0 }));

  const [responseCountRow] = await db
    .select({ cnt: count(formResponsesTable.id) })
    .from(formResponsesTable)
    .where(eq(formResponsesTable.formId, formId));

  return {
    ...serializeDates(form),
    createdByUsername: creator?.username ?? null,
    responseCount: Number(responseCountRow?.cnt ?? 0),
    fields: fields.map((f) => serializeDates(f)),
    options,
  };
}

// --- LIST FORMS ---
router.get("/forms", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const rows = canManageForms(user.role)
    ? await db.select().from(formsTable).orderBy(desc(formsTable.createdAt))
    : await db.select().from(formsTable).where(eq(formsTable.status, "open")).orderBy(desc(formsTable.createdAt));

  const results = await Promise.all(rows.map(async (form) => {
    const creator = await db.query.usersTable.findFirst({ where: eq(usersTable.id, form.createdBy) });
    const [rcRow] = await db
      .select({ cnt: count(formResponsesTable.id) })
      .from(formResponsesTable)
      .where(eq(formResponsesTable.formId, form.id));

    return {
      ...serializeDates(form),
      createdByUsername: creator?.username ?? null,
      responseCount: Number(rcRow?.cnt ?? 0),
    };
  }));

  res.json(results);
});

// --- CREATE FORM ---
const CreateFormSchema = zod.object({
  title: zod.string().min(1).max(255),
  description: zod.string().optional(),
  type: zod.enum(["form", "poll"]),
  deadline: zod.string().optional(),
  fields: zod.array(zod.object({
    label: zod.string(),
    fieldType: zod.enum(["text", "textarea", "radio", "checkbox", "select"]),
    options: zod.string().optional(),
    required: zod.boolean().optional(),
    order: zod.number().optional(),
  })).optional(),
  options: zod.array(zod.object({
    label: zod.string(),
    order: zod.number().optional(),
  })).optional(),
});

router.post("/forms", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !canManageForms(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const parsed = CreateFormSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { title, description, type, deadline, fields, options } = parsed.data;

  const [inserted] = await db.insert(formsTable).values({
    title,
    description: description ?? null,
    type,
    status: "open",
    createdBy: user.id,
    deadline: deadline ? new Date(deadline) : null,
  }).returning();

  // Insert fields for form
  if (type === "form" && fields && fields.length > 0) {
    await db.insert(formFieldsTable).values(
      fields.map((f, i) => ({
        formId: inserted.id,
        label: f.label,
        fieldType: f.fieldType,
        options: f.options ?? null,
        required: f.required ?? false,
        order: f.order ?? i,
      }))
    );
  }

  // Insert options for poll
  if (type === "poll" && options && options.length > 0) {
    await db.insert(pollOptionsTable).values(
      options.map((o, i) => ({
        formId: inserted.id,
        label: o.label,
        order: o.order ?? i,
      }))
    );
  }

  const detail = await buildFormDetail(inserted.id);
  res.status(201).json(detail);
});

// --- GET FORM DETAIL ---
router.get("/forms/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const formId = parseInt(req.params.id as string, 10);
  const detail = await buildFormDetail(formId);
  if (!detail) { res.status(404).json({ error: "Form not found" }); return; }

  // Members can only see open forms
  if (!canManageForms(user.role) && detail.status !== "open") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  res.json(detail);
});

// --- UPDATE FORM ---
const UpdateFormSchema = zod.object({
  title: zod.string().min(1).max(255).optional(),
  description: zod.string().optional(),
  status: zod.enum(["open", "closed"]).optional(),
  deadline: zod.string().nullable().optional(),
});

router.patch("/forms/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !canManageForms(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const formId = parseInt(req.params.id as string, 10);
  const form = await db.query.formsTable.findFirst({ where: eq(formsTable.id, formId) });
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }

  const parsed = UpdateFormSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.deadline !== undefined) updateData.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;

  await db.update(formsTable).set(updateData).where(eq(formsTable.id, formId));
  const detail = await buildFormDetail(formId);
  res.json(detail);
});

// --- DELETE FORM ---
router.delete("/forms/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !canManageForms(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const formId = parseInt(req.params.id as string, 10);
  await db.delete(formsTable).where(eq(formsTable.id, formId));
  res.status(204).send();
});

// --- SUBMIT VOTE ---
const SubmitVoteSchema = zod.object({ optionId: zod.number().int() });

router.post("/forms/:id/vote", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const formId = parseInt(req.params.id as string, 10);
  const form = await db.query.formsTable.findFirst({ where: eq(formsTable.id, formId) });
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }
  if (form.type !== "poll") { res.status(400).json({ error: "Not a poll" }); return; }
  if (form.status !== "open") { res.status(400).json({ error: "Poll is closed" }); return; }

  const existing = await db.query.formResponsesTable.findFirst({
    where: and(eq(formResponsesTable.formId, formId), eq(formResponsesTable.userId, user.id)),
  });
  if (existing) { res.status(409).json({ error: "Already voted" }); return; }

  const parsed = SubmitVoteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Verify option belongs to this poll
  const option = await db.query.pollOptionsTable.findFirst({
    where: and(eq(pollOptionsTable.id, parsed.data.optionId), eq(pollOptionsTable.formId, formId)),
  });
  if (!option) { res.status(400).json({ error: "Invalid option" }); return; }

  const [inserted] = await db.insert(formResponsesTable).values({
    formId,
    userId: user.id,
    selectedOptionId: parsed.data.optionId,
  }).returning();

  res.status(201).json(serializeDates(inserted));
});

// --- SUBMIT FORM ---
const SubmitFormSchema = zod.object({
  answers: zod.array(zod.object({
    fieldId: zod.number().int(),
    value: zod.string(),
  })),
});

router.post("/forms/:id/submit", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const formId = parseInt(req.params.id as string, 10);
  const form = await db.query.formsTable.findFirst({ where: eq(formsTable.id, formId) });
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }
  if (form.type !== "form") { res.status(400).json({ error: "Not a form" }); return; }
  if (form.status !== "open") { res.status(400).json({ error: "Form is closed" }); return; }

  const existing = await db.query.formResponsesTable.findFirst({
    where: and(eq(formResponsesTable.formId, formId), eq(formResponsesTable.userId, user.id)),
  });
  if (existing) { res.status(409).json({ error: "Already submitted" }); return; }

  const parsed = SubmitFormSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [response] = await db.insert(formResponsesTable).values({
    formId,
    userId: user.id,
    selectedOptionId: null,
  }).returning();

  if (parsed.data.answers.length > 0) {
    await db.insert(formAnswersTable).values(
      parsed.data.answers.map((a) => ({
        responseId: response.id,
        fieldId: a.fieldId,
        value: a.value,
      }))
    );
  }

  res.status(201).json(serializeDates(response));
});

// --- LIST RESPONSES (Admin) ---
router.get("/forms/:id/responses", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user || !canManageForms(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }

  const formId = parseInt(req.params.id as string, 10);
  const form = await db.query.formsTable.findFirst({ where: eq(formsTable.id, formId) });
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }

  const responses = await db
    .select()
    .from(formResponsesTable)
    .where(eq(formResponsesTable.formId, formId))
    .orderBy(desc(formResponsesTable.createdAt));

  const detailedResponses = await Promise.all(responses.map(async (r) => {
    const respUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, r.userId) });
    const answers = await db
      .select({
        answerId: formAnswersTable.id,
        fieldId: formAnswersTable.fieldId,
        value: formAnswersTable.value,
        fieldLabel: formFieldsTable.label,
      })
      .from(formAnswersTable)
      .innerJoin(formFieldsTable, eq(formAnswersTable.fieldId, formFieldsTable.id))
      .where(eq(formAnswersTable.responseId, r.id));

    let selectedOptionLabel: string | null = null;
    if (r.selectedOptionId) {
      const opt = await db.query.pollOptionsTable.findFirst({
        where: eq(pollOptionsTable.id, r.selectedOptionId),
      });
      selectedOptionLabel = opt?.label ?? null;
    }

    return {
      id: r.id,
      userId: r.userId,
      username: respUser?.username ?? "Unknown",
      displayName: respUser?.displayName ?? null,
      mcUsername: respUser?.mcUsername ?? null,
      selectedOptionId: r.selectedOptionId,
      selectedOptionLabel,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      answers: answers.map((a) => ({
        fieldId: a.fieldId,
        fieldLabel: a.fieldLabel,
        value: a.value,
      })),
    };
  }));

  // Build poll results for polls
  let pollResults: Array<{ optionId: number; label: string; count: number }> = [];
  if (form.type === "poll") {
    const options = await db
      .select()
      .from(pollOptionsTable)
      .where(eq(pollOptionsTable.formId, formId))
      .orderBy(asc(pollOptionsTable.order));

    const voteCountRows = await db
      .select({ optionId: formResponsesTable.selectedOptionId, cnt: count(formResponsesTable.id) })
      .from(formResponsesTable)
      .where(and(eq(formResponsesTable.formId, formId), sql`${formResponsesTable.selectedOptionId} IS NOT NULL`))
      .groupBy(formResponsesTable.selectedOptionId);

    const voteMap: Record<number, number> = {};
    for (const row of voteCountRows) {
      if (row.optionId !== null && row.optionId !== undefined) {
        voteMap[row.optionId] = Number(row.cnt);
      }
    }

    pollResults = options.map((o) => ({
      optionId: o.id,
      label: o.label,
      count: voteMap[o.id] ?? 0,
    }));
  }

  res.json({
    formId: form.id,
    type: form.type,
    responses: detailedResponses,
    pollResults,
  });
});

// --- MY RESPONSE ---
router.get("/forms/:id/my-response", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getDbUser(auth.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const formId = parseInt(req.params.id as string, 10);
  const response = await db.query.formResponsesTable.findFirst({
    where: and(eq(formResponsesTable.formId, formId), eq(formResponsesTable.userId, user.id)),
  });

  if (!response) { res.json({ hasResponded: false, response: null }); return; }

  const answers = await db
    .select({
      answerId: formAnswersTable.id,
      fieldId: formAnswersTable.fieldId,
      value: formAnswersTable.value,
      fieldLabel: formFieldsTable.label,
    })
    .from(formAnswersTable)
    .innerJoin(formFieldsTable, eq(formAnswersTable.fieldId, formFieldsTable.id))
    .where(eq(formAnswersTable.responseId, response.id));

  let selectedOptionLabel: string | null = null;
  if (response.selectedOptionId) {
    const opt = await db.query.pollOptionsTable.findFirst({
      where: eq(pollOptionsTable.id, response.selectedOptionId),
    });
    selectedOptionLabel = opt?.label ?? null;
  }

  res.json({
    hasResponded: true,
    response: {
      id: response.id,
      userId: response.userId,
      username: user.username,
      displayName: user.displayName ?? null,
      mcUsername: user.mcUsername ?? null,
      selectedOptionId: response.selectedOptionId,
      selectedOptionLabel,
      createdAt: response.createdAt instanceof Date ? response.createdAt.toISOString() : response.createdAt,
      answers: answers.map((a) => ({
        fieldId: a.fieldId,
        fieldLabel: a.fieldLabel,
        value: a.value,
      })),
    },
  });
});

export default router;
