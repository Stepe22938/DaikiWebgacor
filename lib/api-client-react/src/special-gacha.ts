import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenRoyalPrize {
  id: number;
  eventId: number;
  tokenPosition: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
}

export interface SpecialGachaEvent {
  id: number;
  type: "token_royal" | "bidding" | "rush_board";
  name: string;
  description: string | null;
  videoUrl: string | null;
  isActive: boolean;
  costPerToken: number | null;
  startingBid: number | null;
  minBidIncrement: number | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  // enriched
  prizes?: TokenRoyalPrize[];
  bidCount?: number;
  topBid?: number | null;
  winner?: { titleNo: string; userId: number } | null;
  // user-facing
  tokensCollected?: number;
  completedAt?: string | null;
  myBid?: number | null;
}

// ─── Admin Hooks ──────────────────────────────────────────────────────────────

export function useGetAdminSpecialGacha() {
  return useQuery<SpecialGachaEvent[]>({
    queryKey: ["/api/admin/special-gacha"],
    queryFn: () => customFetch<SpecialGachaEvent[]>("/api/admin/special-gacha"),
  });
}

export interface CreateSpecialGachaInput {
  type: "token_royal" | "bidding" | "rush_board";
  name: string;
  description?: string;
  videoUrl?: string;
  isActive?: boolean;
  // token_royal
  costPerToken?: number;
  prizes?: { name: string; description?: string; imageUrl?: string }[];
  // bidding
  startingBid?: number;
  minBidIncrement?: number;
  endsAt?: string;
}

export function useCreateSpecialGacha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSpecialGachaInput) =>
      customFetch<SpecialGachaEvent>("/api/admin/special-gacha", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/special-gacha"] }),
  });
}

export function useUpdateSpecialGacha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateSpecialGachaInput> }) =>
      customFetch<SpecialGachaEvent>(`/api/admin/special-gacha/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/special-gacha"] }),
  });
}

export function useDeleteSpecialGacha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ success: boolean }>(`/api/admin/special-gacha/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/special-gacha"] }),
  });
}

export function useAwardBiddingWinner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<{ titleNo: string; winner: any; winningBid: number }>(
        `/api/admin/special-gacha/${id}/award-winner`,
        { method: "POST" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/special-gacha"] }),
  });
}

// ─── User Hooks ───────────────────────────────────────────────────────────────

export function useGetSpecialGacha() {
  return useQuery<SpecialGachaEvent[]>({
    queryKey: ["/api/special-gacha"],
    queryFn: () => customFetch<SpecialGachaEvent[]>("/api/special-gacha"),
  });
}

export function useSpinSpecialEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<any>(`/api/special-gacha/${id}/spin`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/special-gacha"] });
      qc.invalidateQueries({ queryKey: ["/api/gacha/board"] });
    },
  });
}

export function useGetEventRewards() {
  return useQuery<any[]>({
    queryKey: ["/api/admin/special-gacha/rewards"],
    queryFn: (context) => {
      const eventId = context.queryKey[1];
      return customFetch<any[]>(`/api/admin/special-gacha/${eventId}/rewards`);
    },
  });
}

export function useSetEventRewards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rewards }: { id: number; rewards: any[] }) =>
      customFetch<any[]>(`/api/admin/special-gacha/${id}/rewards`, {
        method: "POST",
        body: JSON.stringify({ rewards }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/special-gacha"] }),
  });
}

export function usePlaceBid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      customFetch<{ success: boolean; bidAmount: number; diamondsLeft: number }>(
        `/api/special-gacha/${id}/bid`,
        {
          method: "POST",
          body: JSON.stringify({ amount }),
          headers: { "Content-Type": "application/json" },
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/special-gacha"] });
      qc.invalidateQueries({ queryKey: ["/api/gacha/board"] });
    },
  });
}
