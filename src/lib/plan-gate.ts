import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Plan, SubscriptionWithPlan } from "@/lib/supabase/types";
import { getCurrentSubscription } from "@/lib/supabase/queries";

type Client = SupabaseClient<Database>;

/** Thrown by the helpers below when a request asks for something the
 * caller's actual plan doesn't include. Routes catch this and turn it
 * into the right HTTP response — same shape as the usage-limit errors
 * already thrown by the consume_usage_credits RPC. */
export class PlanGateError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Server-side plan lookup for API routes. Always reads the caller's
 * *actual* subscription from the DB via the request-scoped (RLS'd)
 * client — never trusts a plan/tier the client claims in the payload. */
export async function requireSubscription(
  supabase: Client
): Promise<SubscriptionWithPlan> {
  const subscription = await getCurrentSubscription(supabase);
  if (!subscription) {
    throw new PlanGateError("No active subscription.", 403);
  }
  return subscription;
}

// ── Outfit generation ──────────────────────────────────────

export const MAX_BULK_OUTFITS = 10;
export const MAX_OUTFITS_WITHOUT_BULK = 1;

/** Total outfits (count × themes) allowed in a single generate request. */
export function maxOutfitsPerRequest(plan: Pick<Plan, "has_bulk_generation">): number {
  return plan.has_bulk_generation ? MAX_BULK_OUTFITS : MAX_OUTFITS_WITHOUT_BULK;
}

// ── AI captions ─────────────────────────────────────────────

export type CaptionLanguage = "en" | "ar";
export type CaptionFormat = "generic" | "instagram" | "tiktok";

export function canUseCaptionLanguage(
  plan: Pick<Plan, "languages">,
  language: CaptionLanguage
): boolean {
  return language === "en" || plan.languages.includes(language);
}

export function canUseCaptionFormat(
  plan: Pick<Plan, "social_formats">,
  format: CaptionFormat
): boolean {
  return format === "generic" || !!plan.social_formats?.includes(format);
}

// ── Export ──────────────────────────────────────────────────

export function canUseExportFormat(
  plan: Pick<Plan, "export_formats">,
  format: "csv" | "pdf"
): boolean {
  return !!plan.export_formats?.includes(format);
}

// ── Analytics ───────────────────────────────────────────────

/** Basic plans get the KPI cards + core usage charts; `full` unlocks the
 * richer breakdowns (themes, captions by language/format, catalogue mix). */
export function canViewFullAnalytics(
  plan: Pick<Plan, "analytics_level">
): boolean {
  return plan.analytics_level === "full";
}
