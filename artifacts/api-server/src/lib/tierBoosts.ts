import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import {
  boostOrdersTable,
  boostPackagesTable,
  boostSlotEventsTable,
  boostSlotsTable,
  conversationMembersTable,
  db,
  groupBoostAssignmentsTable,
  storagePoolsTable,
  userTierSubscriptionsTable,
} from "@workspace/db";

export type UserTierKey = "free" | "premium" | "premium_plus";
export type StickerSyncMode = "local_server" | "global_cross_server";
export type GroupBoostLevel = 0 | 1 | 2 | 3;

export type TierPolicy = {
  tier: UserTierKey;
  label: string;
  maxUploadBytes: number;
  baseBoostCount: number;
  stickerSyncMode: StickerSyncMode;
  maxStickerCount: number;
  maxStickerFileBytes: number;
  canUseAnimatedStickers: boolean;
};

export const TIER_POLICIES: Record<UserTierKey, TierPolicy> = {
  free: {
    tier: "free",
    label: "User Biasa",
    maxUploadBytes: 200 * 1024 * 1024,
    baseBoostCount: 0,
    stickerSyncMode: "local_server",
    maxStickerCount: 12,
    maxStickerFileBytes: 512 * 1024,
    canUseAnimatedStickers: false,
  },
  premium: {
    tier: "premium",
    label: "Premium",
    maxUploadBytes: 500 * 1024 * 1024,
    baseBoostCount: 0,
    stickerSyncMode: "global_cross_server",
    maxStickerCount: 48,
    maxStickerFileBytes: 2 * 1024 * 1024,
    canUseAnimatedStickers: false,
  },
  premium_plus: {
    tier: "premium_plus",
    label: "Premium+",
    maxUploadBytes: 1024 * 1024 * 1024,
    baseBoostCount: 3,
    stickerSyncMode: "global_cross_server",
    maxStickerCount: 96,
    maxStickerFileBytes: 4 * 1024 * 1024,
    canUseAnimatedStickers: true,
  },
};

export const BOOST_PACKAGE_SEEDS = [
  { sku: "boost-1", displayName: "1 Boost", boostCount: 1, priceIdr: 7000, durationDays: 30 },
  { sku: "boost-2", displayName: "2 Boost", boostCount: 2, priceIdr: 13000, durationDays: 30 },
  { sku: "boost-3", displayName: "3 Boost", boostCount: 3, priceIdr: 20000, durationDays: 30 },
  { sku: "boost-4", displayName: "4 Boost", boostCount: 4, priceIdr: 27000, durationDays: 30 },
  { sku: "boost-5", displayName: "5 Boost", boostCount: 5, priceIdr: 34000, durationDays: 30 },
  { sku: "boost-14-bundle", displayName: "Bundle 14 Boost", boostCount: 14, priceIdr: 97000, durationDays: 30 },
] as const;

export const DEFAULT_SHARED_STORAGE_KEY = "shared-5tb";
export const DEFAULT_SHARED_STORAGE_CAPACITY_BYTES = 5 * 1024 * 1024 * 1024 * 1024;

export const GROUP_BOOST_THRESHOLDS = {
  level1: 2,
  level2: 7,
  level3: 14,
} as const;

export function normalizeUserTier(input: string | null | undefined): UserTierKey {
  if (input === "premium" || input === "premium_plus") return input;
  return "free";
}

export function getTierPolicy(tier: string | null | undefined): TierPolicy {
  return TIER_POLICIES[normalizeUserTier(tier)];
}

export function addMonthsClamped(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    result.setDate(0);
  }
  return result;
}

export async function getActiveTierForUser(userId: number, at = new Date()) {
  const rows = await db
    .select()
    .from(userTierSubscriptionsTable)
    .where(and(
      eq(userTierSubscriptionsTable.userId, userId),
      eq(userTierSubscriptionsTable.status, "active"),
      sql`${userTierSubscriptionsTable.startsAt} <= ${at}`,
      or(isNull(userTierSubscriptionsTable.endsAt), sql`${userTierSubscriptionsTable.endsAt} > ${at}`),
      isNull(userTierSubscriptionsTable.revokedAt),
    ))
    .orderBy(asc(userTierSubscriptionsTable.startsAt));

  return rows.at(-1) ?? null;
}

export async function getUserUploadPolicy(userId: number) {
  const subscription = await getActiveTierForUser(userId);
  return getTierPolicy(subscription?.tier);
}

export async function ensureBoostPackageSeeds() {
  for (const pkg of BOOST_PACKAGE_SEEDS) {
    await db.insert(boostPackagesTable).values(pkg).onConflictDoNothing();
  }
}

export async function ensureDefaultSharedStoragePool() {
  await db.insert(storagePoolsTable).values({
    key: DEFAULT_SHARED_STORAGE_KEY,
    name: "Shared Storage 5TB",
    provider: "shared_storage",
    capacityBytes: DEFAULT_SHARED_STORAGE_CAPACITY_BYTES,
    usedBytes: 0,
    proxyUploadsEnabled: true,
    validationMode: "proxy",
  }).onConflictDoNothing();

  return db.query.storagePoolsTable.findFirst({
    where: eq(storagePoolsTable.key, DEFAULT_SHARED_STORAGE_KEY),
  });
}

export async function canUserUploadBytes(userId: number, fileSizeBytes: number) {
  const policy = await getUserUploadPolicy(userId);
  if (fileSizeBytes > policy.maxUploadBytes) {
    return {
      allowed: false as const,
      policy,
      reason: `${policy.label} max upload ${Math.round(policy.maxUploadBytes / 1024 / 1024)}MB.`,
    };
  }

  const pool = await ensureDefaultSharedStoragePool();
  const remainingBytes = pool ? Math.max(pool.capacityBytes - pool.usedBytes, 0) : DEFAULT_SHARED_STORAGE_CAPACITY_BYTES;
  if (fileSizeBytes > remainingBytes) {
    return {
      allowed: false as const,
      policy,
      reason: "Shared storage 5TB sudah penuh atau sisa kapasitas tidak cukup.",
    };
  }

  return {
    allowed: true as const,
    policy,
    remainingBytes,
  };
}

export async function getActivePurchasedBoostCount(userId: number, at = new Date()) {
  const activeSlots = await db
    .select({ count: sql<number>`count(*)` })
    .from(boostSlotsTable)
    .where(and(
      eq(boostSlotsTable.assignedUserId, userId),
      eq(boostSlotsTable.status, "active"),
      sql`${boostSlotsTable.expiresAt} > ${at}`,
    ));

  return Number(activeSlots[0]?.count ?? 0);
}

export async function getEffectiveBoostState(userId: number, at = new Date()) {
  const tierPolicy = await getUserUploadPolicy(userId);
  const purchasedBoostCount = await getActivePurchasedBoostCount(userId, at);
  return {
    tierPolicy,
    purchasedBoostCount,
    totalBoostCount: tierPolicy.baseBoostCount + purchasedBoostCount,
  };
}

export function getGroupBoostLevel(boostCount: number): GroupBoostLevel {
  if (boostCount >= GROUP_BOOST_THRESHOLDS.level3) return 3;
  if (boostCount >= GROUP_BOOST_THRESHOLDS.level2) return 2;
  if (boostCount >= GROUP_BOOST_THRESHOLDS.level1) return 1;
  return 0;
}

export function getGroupBoostPerks(boostCount: number) {
  const level = getGroupBoostLevel(boostCount);
  return {
    level,
    boostCount,
    perks: level === 3
      ? ["80 channels", "100 roles", "priority badge", "premium presence"]
      : level === 2
      ? ["40 channels", "50 roles", "group spotlight"]
      : level === 1
      ? ["20 channels", "25 roles"]
      : ["10 channels", "10 roles"],
    maxChannels: level === 3 ? 80 : level === 2 ? 40 : level === 1 ? 20 : 10,
    maxRoles: level === 3 ? 100 : level === 2 ? 50 : level === 1 ? 25 : 10,
  };
}

export function getNitroEntitlements(tier: string | null | undefined) {
  const policy = getTierPolicy(tier);
  return {
    tier: policy.tier,
    tierLabel: policy.label,
    nitroLike: policy.tier === "premium" || policy.tier === "premium_plus",
    stickerSyncMode: policy.stickerSyncMode,
    maxStickerCount: policy.maxStickerCount,
    maxStickerFileBytes: policy.maxStickerFileBytes,
    canUseAnimatedStickers: policy.canUseAnimatedStickers,
    perks: policy.tier === "premium_plus"
      ? [
          "Global stickers across all groups",
          "Animated stickers",
          "3x server boosts included",
          "1GB upload limit",
        ]
      : policy.tier === "premium"
      ? [
          "Global stickers across all groups",
          "Bigger upload limit",
          "Nitro-style cross-server perks",
        ]
      : [
          "Local server stickers only",
          "Basic upload limit",
        ],
  };
}

export async function createBoostOrderWithSlots(params: {
  buyerUserId: number;
  packageSku: string;
  notes?: string | null;
}) {
  const pkg = await db.query.boostPackagesTable.findFirst({
    where: eq(boostPackagesTable.sku, params.packageSku),
  });
  if (!pkg || !pkg.active) {
    throw new Error("Boost package tidak ditemukan atau tidak aktif.");
  }

  const [order] = await db.insert(boostOrdersTable).values({
    buyerUserId: params.buyerUserId,
    packageId: pkg.id,
    totalBoostCount: pkg.boostCount,
    totalPriceIdr: pkg.priceIdr,
    paymentStatus: "paid",
    notes: params.notes ?? null,
  }).returning();

  await db.insert(boostSlotsTable).values(
    Array.from({ length: pkg.boostCount }, () => ({
      orderId: order.id,
      ownerUserId: params.buyerUserId,
      status: "available",
    })),
  );

  return { order, package: pkg };
}

export async function assignBoostSlot(params: {
  slotId: number;
  actorUserId: number;
  targetUserId: number;
  at?: Date;
}) {
  const at = params.at ?? new Date();
  const slot = await db.query.boostSlotsTable.findFirst({ where: eq(boostSlotsTable.id, params.slotId) });
  if (!slot) throw new Error("Boost slot tidak ditemukan.");
  if (slot.ownerUserId !== params.actorUserId) throw new Error("Hanya pembeli boost yang bisa assign boost ini.");
  if (slot.status === "expired") throw new Error("Boost slot ini sudah expired.");

  const nextExpiresAt = slot.expiresAt ?? addMonthsClamped(at, 1);
  const nextStatus = nextExpiresAt <= at ? "expired" : "active";
  if (nextStatus === "expired") throw new Error("Boost slot ini sudah expired.");

  const [updated] = await db.update(boostSlotsTable)
    .set({
      assignedUserId: params.targetUserId,
      status: "active",
      activatedAt: slot.activatedAt ?? at,
      expiresAt: nextExpiresAt,
      revokedAt: null,
      updatedAt: at,
    })
    .where(eq(boostSlotsTable.id, params.slotId))
    .returning();

  await db.insert(boostSlotEventsTable).values({
    slotId: params.slotId,
    actorUserId: params.actorUserId,
    fromUserId: slot.assignedUserId,
    toUserId: params.targetUserId,
    eventType: slot.assignedUserId ? "transfer" : "assign",
  });

  return updated;
}

export async function revokeBoostSlot(params: {
  slotId: number;
  actorUserId: number;
  note?: string | null;
  at?: Date;
}) {
  const at = params.at ?? new Date();
  const slot = await db.query.boostSlotsTable.findFirst({ where: eq(boostSlotsTable.id, params.slotId) });
  if (!slot) throw new Error("Boost slot tidak ditemukan.");
  if (slot.ownerUserId !== params.actorUserId) throw new Error("Hanya pembeli boost yang bisa revoke boost ini.");
  if (!slot.assignedUserId) throw new Error("Boost slot ini belum sedang dipakai.");

  const status = slot.expiresAt && slot.expiresAt <= at ? "expired" : "available";
  const [updated] = await db.update(boostSlotsTable)
    .set({
      assignedUserId: null,
      status,
      revokedAt: at,
      updatedAt: at,
    })
    .where(eq(boostSlotsTable.id, params.slotId))
    .returning();

  await db.insert(boostSlotEventsTable).values({
    slotId: params.slotId,
    actorUserId: params.actorUserId,
    fromUserId: slot.assignedUserId,
    toUserId: null,
    eventType: "revoke",
    notes: params.note ?? null,
  });

  return updated;
}

export async function transferBoostSlot(params: {
  slotId: number;
  actorUserId: number;
  targetUserId: number;
  note?: string | null;
  at?: Date;
}) {
  const at = params.at ?? new Date();
  const slot = await db.query.boostSlotsTable.findFirst({ where: eq(boostSlotsTable.id, params.slotId) });
  if (!slot) throw new Error("Boost slot tidak ditemukan.");
  if (slot.ownerUserId !== params.actorUserId) throw new Error("Hanya pembeli boost yang bisa transfer boost ini.");
  if (!slot.assignedUserId) throw new Error("Boost slot ini belum aktif, assign dulu sebelum transfer.");
  if (slot.expiresAt && slot.expiresAt <= at) throw new Error("Boost slot ini sudah expired.");

  const [updated] = await db.update(boostSlotsTable)
    .set({
      assignedUserId: params.targetUserId,
      status: "active",
      lastTransferredAt: at,
      updatedAt: at,
    })
    .where(eq(boostSlotsTable.id, params.slotId))
    .returning();

  await db.insert(boostSlotEventsTable).values({
    slotId: params.slotId,
    actorUserId: params.actorUserId,
    fromUserId: slot.assignedUserId,
    toUserId: params.targetUserId,
    eventType: "transfer",
    notes: params.note ?? null,
  });

  return updated;
}

export async function getGroupBoostState(conversationId: number, at = new Date()) {
  const rows = await db
    .select()
    .from(groupBoostAssignmentsTable)
    .where(and(
      eq(groupBoostAssignmentsTable.conversationId, conversationId),
      eq(groupBoostAssignmentsTable.status, "active"),
      sql`${groupBoostAssignmentsTable.expiresAt} > ${at}`,
    ));

  const premiumPlusMembers = await db
    .select({ userId: conversationMembersTable.userId })
    .from(conversationMembersTable)
    .innerJoin(userTierSubscriptionsTable, and(
      eq(userTierSubscriptionsTable.userId, conversationMembersTable.userId),
      eq(userTierSubscriptionsTable.tier, "premium_plus"),
      eq(userTierSubscriptionsTable.status, "active"),
      sql`${userTierSubscriptionsTable.startsAt} <= ${at}`,
      or(isNull(userTierSubscriptionsTable.endsAt), sql`${userTierSubscriptionsTable.endsAt} > ${at}`),
      isNull(userTierSubscriptionsTable.revokedAt),
    ))
    .where(eq(conversationMembersTable.conversationId, conversationId))
    .groupBy(conversationMembersTable.userId);

  const premiumPlusMemberBoostCount = premiumPlusMembers.length;
  const activeBoostCount = rows.length + premiumPlusMemberBoostCount;
  return {
    assignments: rows,
    slotAssignments: rows.length,
    premiumPlusMemberBoostCount,
    activeBoostCount,
    ...getGroupBoostPerks(activeBoostCount),
  };
}

export async function applyBoostSlotToConversation(params: {
  slotId: number;
  actorUserId: number;
  conversationId: number;
  ownerOverrideUserId?: number;
  at?: Date;
}) {
  const at = params.at ?? new Date();
  const slot = await db.query.boostSlotsTable.findFirst({ where: eq(boostSlotsTable.id, params.slotId) });
  if (!slot) throw new Error("Boost slot tidak ditemukan.");

  const ownerId = params.ownerOverrideUserId ?? params.actorUserId;
  if (slot.ownerUserId !== ownerId) throw new Error("Boost slot ini bukan milik user target.");
  if (slot.status === "expired") throw new Error("Boost slot ini sudah expired.");

  const existingAssignment = await db.query.groupBoostAssignmentsTable.findFirst({
    where: eq(groupBoostAssignmentsTable.slotId, params.slotId),
  });

  if (existingAssignment && existingAssignment.status === "active" && existingAssignment.expiresAt > at) {
    throw new Error("Boost slot ini sedang dipakai di group lain.");
  }

  const nextExpiresAt = slot.expiresAt ?? addMonthsClamped(at, 1);
  if (nextExpiresAt <= at) throw new Error("Boost slot ini sudah expired.");

  await db.update(boostSlotsTable)
    .set({
      status: "active",
      activatedAt: slot.activatedAt ?? at,
      expiresAt: nextExpiresAt,
      revokedAt: null,
      updatedAt: at,
    })
    .where(eq(boostSlotsTable.id, params.slotId));

  if (existingAssignment) {
    await db.update(groupBoostAssignmentsTable)
      .set({
        conversationId: params.conversationId,
        appliedByUserId: params.actorUserId,
        status: "active",
        appliedAt: at,
        expiresAt: nextExpiresAt,
        revokedAt: null,
        updatedAt: at,
      })
      .where(eq(groupBoostAssignmentsTable.id, existingAssignment.id));
  } else {
    await db.insert(groupBoostAssignmentsTable).values({
      slotId: params.slotId,
      conversationId: params.conversationId,
      appliedByUserId: params.actorUserId,
      status: "active",
      appliedAt: at,
      expiresAt: nextExpiresAt,
    });
  }

  await db.insert(boostSlotEventsTable).values({
    slotId: params.slotId,
    actorUserId: params.actorUserId,
    fromUserId: null,
    toUserId: null,
    eventType: "assign",
    notes: `Applied to group ${params.conversationId}`,
  });
}

export async function revokeGroupBoostAssignment(params: {
  slotId: number;
  actorUserId: number;
  ownerOverrideUserId?: number;
  at?: Date;
}) {
  const at = params.at ?? new Date();
  const slot = await db.query.boostSlotsTable.findFirst({ where: eq(boostSlotsTable.id, params.slotId) });
  if (!slot) throw new Error("Boost slot tidak ditemukan.");
  const ownerId = params.ownerOverrideUserId ?? params.actorUserId;
  if (slot.ownerUserId !== ownerId) throw new Error("Boost slot ini bukan milik user target.");

  const assignment = await db.query.groupBoostAssignmentsTable.findFirst({
    where: eq(groupBoostAssignmentsTable.slotId, params.slotId),
  });
  if (!assignment || assignment.status !== "active") throw new Error("Boost group assignment tidak aktif.");

  await db.update(groupBoostAssignmentsTable)
    .set({
      status: assignment.expiresAt <= at ? "expired" : "revoked",
      revokedAt: at,
      updatedAt: at,
    })
    .where(eq(groupBoostAssignmentsTable.id, assignment.id));

  await db.update(boostSlotsTable)
    .set({
      status: slot.expiresAt && slot.expiresAt <= at ? "expired" : "available",
      updatedAt: at,
      revokedAt: at,
    })
    .where(eq(boostSlotsTable.id, params.slotId));
}
