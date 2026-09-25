import type { Plan, Subscription } from "@/lib/supabase/types";

export type UsageType = "outfit_generation" | "ai_caption";

export interface UsageRemaining {
  used: number;
  limit: number | null;
  /** Monthly allowance remaining, floored at 0. Null when unlimited. */
  planRemaining: number | null;
  /** used/limit, capped at 100. Plan allowance only — never includes extra credits. */
  percent: number | null;
  isUnlimited: boolean;
  /** Shared extra-credits wallet balance (same value for both usage types). */
  extraCredits: number;
  /** planRemaining + extraCredits. Null when unlimited. */
  totalAvailable: number | null;
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
  const extraCredits = subscription.extra_credits_balance;

  if (limit === null) {
    return {
      used,
      limit: null,
      planRemaining: null,
      percent: null,
      isUnlimited: true,
      extraCredits,
      totalAvailable: null,
    };
  }

  const planRemaining = Math.max(limit - used, 0);
  const percent = Math.min(Math.round((used / limit) * 100), 100);

  return {
    used,
    limit,
    planRemaining,
    percent,
    isUnlimited: false,
    extraCredits,
    totalAvailable: planRemaining + extraCredits,
  };
}
