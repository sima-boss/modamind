import type { Plan, Subscription } from "@/lib/supabase/types";

export type UsageType = "outfit_generation" | "ai_caption";

export interface UsageRemaining {
  used: number;
  limit: number | null;
  /** Monthly allowance remaining, plus any top-up balance (outfits only). */
  remaining: number | null;
  /** 0-100, or null when unlimited. */
  percent: number | null;
  isUnlimited: boolean;
  /** Only meaningful for outfit generations. */
  topupBalance: number;
}

export function getRemaining(
  plan: Plan,
  subscription: Subscription,
  type: UsageType
): UsageRemaining {
  const isOutfit = type === "outfit_generation";
  const limit = isOutfit ? plan.outfit_generations_limit : plan.ai_captions_limit;
  const used = isOutfit
    ? subscription.outfit_generations_used
    : subscription.ai_captions_used;
  const topupBalance = isOutfit ? subscription.outfit_topup_balance : 0;

  if (limit === null) {
    return {
      used,
      limit: null,
      remaining: null,
      percent: null,
      isUnlimited: true,
      topupBalance,
    };
  }

  const remaining = Math.max(limit - used, 0) + topupBalance;
  const percent = Math.min(Math.round((used / limit) * 100), 100);

  return { used, limit, remaining, percent, isUnlimited: false, topupBalance };
}
