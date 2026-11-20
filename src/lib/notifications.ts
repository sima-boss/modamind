import type { SubscriptionWithPlan } from "@/lib/supabase/types";
import { getRemaining, type UsageType } from "@/lib/usage";
import { formatDate } from "@/lib/format";

export type NotificationKind = "danger" | "warning" | "info";
export type NotificationIcon = "usage" | "credits" | "products" | "plan" | "renewal";

export interface AppNotification {
  /** Stable per billing period/date, so read state resets when the situation changes. */
  id: string;
  kind: NotificationKind;
  icon: NotificationIcon;
  title: string;
  detail: string;
  href: "/billing" | "/products";
}

export const WARN_PERCENT = 80;
export const LOW_CREDITS = 5;
export const RENEWAL_SOON_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

const USAGE_LABELS: Record<UsageType, { key: string; noun: string; title: string }> = {
  outfit_generation: { key: "outfit", noun: "outfit generations", title: "Outfit" },
  ai_caption: { key: "caption", noun: "AI captions", title: "Caption" },
};

function usageNotification(
  sub: SubscriptionWithPlan,
  type: UsageType
): AppNotification | null {
  const { percent, used, limit, extraCredits, isUnlimited } = getRemaining(
    sub.plan,
    sub,
    type
  );
  if (isUnlimited || percent === null || percent < WARN_PERCENT) return null;

  const { key, noun, title } = USAGE_LABELS[type];
  const period = sub.current_period_start;

  if (percent >= 100) {
    return {
      id: `${key}-100:${period}`,
      kind: extraCredits > 0 ? "warning" : "danger",
      icon: "usage",
      title: `${title} limit reached`,
      detail:
        extraCredits > 0
          ? `Monthly ${noun} used up. Now using extra credits (${extraCredits} left).`
          : `You've used all ${limit} ${noun} this period.`,
      href: "/billing",
    };
  }

  return {
    id: `${key}-80:${period}`,
    kind: "warning",
    icon: "usage",
    title: `${percent}% of ${noun} used`,
    detail: `${used} of ${limit} used. Renews ${formatDate(sub.current_period_end)}.`,
    href: "/billing",
  };
}

function creditsNotification(sub: SubscriptionWithPlan): AppNotification | null {
  const credits = sub.extra_credits_balance;
  if (credits > 0 && credits <= LOW_CREDITS) {
    return {
      id: `credits-low:${credits}`,
      kind: "warning",
      icon: "credits",
      title: "Extra credits running low",
      detail: `${credits} extra credit${credits === 1 ? "" : "s"} left.`,
      href: "/billing",
    };
  }

  // Zero credits only matters once a monthly allowance is exhausted.
  if (credits <= 0) {
    const exhausted = (["outfit_generation", "ai_caption"] as const).some(
      (type) => getRemaining(sub.plan, sub, type).planRemaining === 0
    );
    if (exhausted) {
      return {
        id: `credits-zero:${sub.current_period_start}`,
        kind: "danger",
        icon: "credits",
        title: "No extra credits left",
        detail: "Top up to keep generating before your plan renews.",
        href: "/billing",
      };
    }
  }
  return null;
}

function productsNotification(
  sub: SubscriptionWithPlan,
  productCount: number
): AppNotification | null {
  const limit = sub.plan.products_limit;
  if (limit === null || limit <= 0) return null;
  const percent = Math.round((productCount / limit) * 100);
  if (percent < WARN_PERCENT) return null;

  const full = productCount >= limit;
  return {
    id: `products-${full ? "100" : "80"}:${limit}`,
    kind: full ? "danger" : "warning",
    icon: "products",
    title: full ? "Product limit reached" : "Product catalog almost full",
    detail: `${productCount} of ${limit} products used.`,
    href: "/products",
  };
}

function planChangeNotification(sub: SubscriptionWithPlan): AppNotification | null {
  const date = formatDate(sub.current_period_end);
  if (sub.status === "canceled") {
    return {
      id: `canceled:${sub.current_period_end}`,
      kind: "danger",
      icon: "plan",
      title: "Subscription canceled",
      detail: `Your ${sub.plan.name} plan ends on ${date}.`,
      href: "/billing",
    };
  }
  if (sub.pendingPlan) {
    return {
      id: `pending:${sub.pendingPlan.id}:${sub.current_period_end}`,
      kind: "info",
      icon: "plan",
      title: "Plan change scheduled",
      detail: `Switching to ${sub.pendingPlan.name} on ${date}.`,
      href: "/billing",
    };
  }
  return null;
}

function renewalNotification(
  sub: SubscriptionWithPlan,
  now: Date
): AppNotification | null {
  if (sub.status !== "active" || sub.pendingPlan) return null;
  const msLeft = new Date(sub.current_period_end).getTime() - now.getTime();
  if (msLeft < 0 || msLeft > RENEWAL_SOON_DAYS * DAY_MS) return null;
  return {
    id: `renewal:${sub.current_period_end}`,
    kind: "info",
    icon: "renewal",
    title: "Plan renews soon",
    detail: `${sub.plan.name} renews on ${formatDate(sub.current_period_end)}.`,
    href: "/billing",
  };
}

/** Builds header notifications purely from the subscription row and the
 * caller's product count — no notifications table needed. */
export function buildNotifications(
  sub: SubscriptionWithPlan,
  productCount: number,
  now: Date = new Date()
): AppNotification[] {
  return [
    planChangeNotification(sub),
    usageNotification(sub, "outfit_generation"),
    usageNotification(sub, "ai_caption"),
    creditsNotification(sub),
    productsNotification(sub, productCount),
    renewalNotification(sub, now),
  ].filter((n): n is AppNotification => n !== null);
}

// ── Read state (localStorage, per user) ─────────────────────

export function readStorageKey(userId: string): string {
  return `fashnix:notifications-read:${userId}`;
}

export function loadReadIds(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(readStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
    );
  } catch {
    return new Set();
  }
}

/** Persists only ids that still exist, so storage never grows unbounded. */
export function saveReadIds(userId: string, ids: Iterable<string>): void {
  try {
    window.localStorage.setItem(readStorageKey(userId), JSON.stringify(Array.from(ids)));
  } catch {
    // Storage unavailable (private mode, quota) — read state just won't persist.
  }
}
