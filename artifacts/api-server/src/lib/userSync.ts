import { clerkClient } from "@clerk/express";
import { asc, eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getActiveTierForUser } from "./tierBoosts";

const CLERK_PROFILE_TIMEOUT_MS = 5000;

type ClerkProfile = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

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
    const clerkUser = await Promise.race([
      clerkClient.users.getUser(clerkId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Clerk profile request timed out")), CLERK_PROFILE_TIMEOUT_MS),
      ),
    ]);
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

export async function getOrCreateUser(clerkId: string, username: string, avatarUrl?: string | null, displayName?: string | null) {
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

export async function syncUserSubscriptionRole(user: typeof usersTable.$inferSelect) {
  if (["admin", "staff", "dev", "dev_website"].includes(user.role)) {
    return user;
  }
  const activeSub = await getActiveTierForUser(user.id);
  const expectedRole = activeSub ? activeSub.tier : "member";

  if (user.role !== expectedRole) {
    const [updated] = await db
      .update(usersTable)
      .set({ role: expectedRole, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id))
      .returning();
    return updated ?? user;
  }
  return user;
}

export async function ensureAuthUser(clerkId: string, claims?: Record<string, unknown>) {
  const profile = await getClerkProfile(clerkId, claims);
  const username = profile.username ?? clerkId;
  const user = await getOrCreateUser(clerkId, username, profile.avatarUrl, profile.displayName);
  return syncUserSubscriptionRole(user);
}
