import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { asc, eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getAuth } from "../lib/auth";
import { serializeDates } from "../lib/serialize";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
  ListUsersResponse,
  UpdateUserRoleParams,
  UpdateUserRoleBody,
  UpdateUserRoleResponse,
  AdminUpdateUserParams,
  AdminUpdateUserBody,
  AdminUpdateUserResponse,
  GetMySettingsResponse,
  UpdateMySettingsBody,
  UpdateMySettingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function normalizeUserTagBase(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatUserTag(value: number) {
  return `#${String(value).padStart(3, "0")}`;
}

async function generateUserTag(name: string) {
  const base = normalizeUserTagBase(name);
  const rows = await db
    .select({ userTag: usersTable.userTag })
    .from(usersTable)
    .where(sql`lower(regexp_replace(trim(coalesce(nullif(${usersTable.displayName}, ''), ${usersTable.username})), '\\s+', ' ', 'g')) = ${base}`);

  const highest = rows.reduce((max, row) => {
    const parsed = Number.parseInt(row.userTag.replace("#", ""), 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  return formatUserTag(highest + 1);
}

async function ensureUserTag(user: typeof usersTable.$inferSelect) {
  const base = normalizeUserTagBase(user.displayName ?? user.username);
  const matches = await db
    .select({ id: usersTable.id, userTag: usersTable.userTag })
    .from(usersTable)
    .where(sql`lower(regexp_replace(trim(coalesce(nullif(${usersTable.displayName}, ''), ${usersTable.username})), '\\s+', ' ', 'g')) = ${base}`)
    .orderBy(asc(usersTable.id));

  const duplicateTags = new Set(
    matches
      .map((candidate) => candidate.userTag)
      .filter((tag, index, tags) => tags.indexOf(tag) !== index),
  );

  if (!duplicateTags.has(user.userTag)) return user;

  const expectedTag = formatUserTag(matches.findIndex((candidate) => candidate.id === user.id) + 1);
  if (user.userTag === expectedTag) return user;

  const [updated] = await db
    .update(usersTable)
    .set({ userTag: expectedTag, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();

  return updated ?? user;
}

function getClaimString(claims: Record<string, unknown> | undefined, key: string) {
  const value = claims?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getDisplayNameFromClaims(claims: Record<string, unknown> | undefined) {
  const directName = getClaimString(claims, "name") ?? getClaimString(claims, "full_name");
  if (directName) return directName;

  const firstName = getClaimString(claims, "first_name") ?? getClaimString(claims, "given_name");
  const lastName = getClaimString(claims, "last_name") ?? getClaimString(claims, "family_name");
  return [firstName, lastName].filter(Boolean).join(" ") || null;
}

type ClerkProfile = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

function getEmailLocalPart(email: string | null | undefined) {
  return email?.split("@")[0]?.trim() || null;
}

function isInternalClerkUsername(username: string | null | undefined) {
  return !!username?.startsWith("arcadia_");
}

function toPublicUsername(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return normalized || null;
}

function getUnsafeMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function getClerkProfile(clerkId: string, claims: Record<string, unknown> | undefined): Promise<ClerkProfile> {
  const claimUsername = getClaimString(claims, "username");
  const claimAvatarUrl = getClaimString(claims, "image_url") ?? getClaimString(claims, "picture");
  const claimDisplayName = getDisplayNameFromClaims(claims);

  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
    const displayName =
      [clerkUser.fullName, fullName, claimDisplayName, clerkUser.username, getEmailLocalPart(primaryEmail)]
        .find((value) => typeof value === "string" && value.trim()) ?? null;
    const metadataPublicUsername = toPublicUsername(getUnsafeMetadataString(clerkUser.unsafeMetadata, "publicUsername"));
    const publicUsername =
      metadataPublicUsername ??
      (!isInternalClerkUsername(clerkUser.username) ? clerkUser.username : null) ??
      (!isInternalClerkUsername(claimUsername) ? claimUsername : null) ??
      toPublicUsername(displayName) ??
      toPublicUsername(getEmailLocalPart(primaryEmail));

    return {
      username: publicUsername,
      displayName,
      avatarUrl: clerkUser.imageUrl ?? claimAvatarUrl,
    };
  } catch {
    return {
      username: !isInternalClerkUsername(claimUsername) ? claimUsername : toPublicUsername(claimDisplayName),
      displayName: claimDisplayName,
      avatarUrl: claimAvatarUrl,
    };
  }
}

function shouldSyncDisplayName(user: typeof usersTable.$inferSelect, nextDisplayName: string | null, username: string) {
  if (!nextDisplayName) return false;
  if (!user.displayName) return true;
  return user.displayName === user.clerkId || user.displayName === user.username || user.displayName === username;
}

async function getOrCreateUser(clerkId: string, username: string, avatarUrl?: string | null, displayName?: string | null) {
  let user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkId) });
  if (!user) {
    const userTag = await generateUserTag(displayName ?? username);
    const [created] = await db.insert(usersTable).values({
      clerkId,
      username,
      userTag,
      displayName: displayName ?? null,
      avatarUrl: avatarUrl ?? null,
      role: "member",
    }).returning();
    user = created;
  } else {
    const updateData: Record<string, unknown> = {};
    if (shouldSyncDisplayName(user, displayName ?? null, username)) updateData.displayName = displayName;
    if (!user.avatarUrl && avatarUrl) updateData.avatarUrl = avatarUrl;
    if ((user.username === user.clerkId || isInternalClerkUsername(user.username)) && username !== user.clerkId) {
      updateData.username = username;
    }

    if (Object.keys(updateData).length > 0) {
      const [updated] = await db
        .update(usersTable)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id))
        .returning();
      user = updated ?? user;
    }
  }
  return ensureUserTag(user);
}

router.get("/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const clerkUser = auth as { userId: string; sessionClaims?: Record<string, unknown> };
  const profile = await getClerkProfile(auth.userId, clerkUser.sessionClaims);
  const username = profile.username ?? auth.userId;

  const user = await getOrCreateUser(auth.userId, username, profile.avatarUrl, profile.displayName);
  res.json(GetMeResponse.parse(serializeDates(user)));
});

router.patch("/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

  const [updated] = await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.clerkId, auth.userId))
    .returning();

  res.json(UpdateMeResponse.parse(serializeDates(updated)));
});

router.get("/users/switchable", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "dev")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(serializeDates(users)));
});

router.get("/users", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!currentUser || currentUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(serializeDates(users)));
});

router.patch("/users/:id/role", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!currentUser || currentUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateUserRoleParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateUserRoleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ role: body.data.role, updatedAt: new Date() })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(UpdateUserRoleResponse.parse(serializeDates(updated)));
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!currentUser || currentUser.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminUpdateUserParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const body = AdminUpdateUserBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.username !== undefined) updateData.username = body.data.username;
  if (body.data.displayName !== undefined) updateData.displayName = body.data.displayName;
  if (body.data.bio !== undefined) updateData.bio = body.data.bio;
  if (body.data.youtubeLiveUrl !== undefined) updateData.youtubeLiveUrl = body.data.youtubeLiveUrl;
  if (body.data.role !== undefined) updateData.role = body.data.role;
  if (body.data.mcUsername !== undefined) updateData.mcUsername = body.data.mcUsername;

  const [updated] = await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(AdminUpdateUserResponse.parse(serializeDates(updated)));
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!currentUser || currentUser.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = parseInt(rawId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  try {
    const userToDelete = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    if (!userToDelete) { res.status(404).json({ error: "User not found" }); return; }

    // Prevent deleting self
    if (userToDelete.clerkId === auth.userId) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }

    // Delete user from Clerk backend client
    try {
      if (userToDelete.clerkId && !userToDelete.clerkId.startsWith("bot_")) {
        await clerkClient.users.deleteUser(userToDelete.clerkId);
      }
    } catch (clerkErr: any) {
      console.error("Failed to delete user from Clerk:", clerkErr.message);
      // Proceed with deleting from local database
    }

    // Delete user from local database
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me/settings", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json(GetMySettingsResponse.parse({ messagePrivacy: user.messagePrivacy ?? "friends_only" }));
});

router.patch("/me/settings", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = UpdateMySettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.messagePrivacy !== undefined) updateData.messagePrivacy = parsed.data.messagePrivacy;

  const [updated] = await db.update(usersTable)
    .set(updateData)
    .where(eq(usersTable.clerkId, auth.userId))
    .returning();

  res.json(UpdateMySettingsResponse.parse({ messagePrivacy: updated.messagePrivacy ?? "friends_only" }));
});

export default router;
