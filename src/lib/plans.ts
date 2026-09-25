import type { Plan } from "@/lib/supabase/types";

function formatLimit(n: number | null, singular: string, plural: string): string {
  if (n === null) return `Unlimited ${plural}`;
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Derives the pricing-card bullet list straight from a plan row, so
 * copy is never hand-duplicated across /choose-plan and /billing. */
export function getPlanFeatures(plan: Plan): string[] {
  const features = [
    `${formatLimit(plan.outfit_generations_limit, "outfit generation", "outfit generations")}/month`,
    formatLimit(plan.products_limit, "product", "products"),
    formatLimit(plan.ai_captions_limit, "AI caption", "AI captions"),
    plan.languages.includes("ar") ? "English + Arabic" : "English only",
  ];

  if (plan.social_formats?.length) {
    features.push(`${plan.social_formats.map(capitalize).join("/")} formats`);
  }

  features.push(
    plan.analytics_level === "full" ? "Full analytics" : "Basic analytics"
  );

  if (plan.export_formats?.length) {
    features.push(`${plan.export_formats.map((f) => f.toUpperCase()).join("/")} export`);
  }
  if (plan.has_brand_kit) features.push("Brand kit");
  if (plan.has_priority_generation) features.push("Priority generation");

  features.push(
    `${plan.team_members_limit} team member${plan.team_members_limit === 1 ? "" : "s"}`
  );

  return features;
}
