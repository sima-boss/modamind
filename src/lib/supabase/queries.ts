import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Product,
  ProductInsert,
  ProductAttributes,
  ProductWithAttributes,
  OutfitContent,
  OutfitWithDetails,
  Plan,
  BillingTransaction,
  SubscriptionWithPlan,
  UsageEvent,
  Profile,
  AnalyticsDailyPoint,
  AnalyticsSummary,
} from "./types";

type Client = SupabaseClient<Database>;

// ── Products ────────────────────────────────────────────────

export async function getProducts(supabase: Client) {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_attributes(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as ProductWithAttributes[];
}

export async function getProductById(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_attributes(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ProductWithAttributes;
}

export async function insertProduct(supabase: Client, product: ProductInsert) {
  const { data, error } = await supabase
    .from("products")
    .insert(product)
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function updateProduct(
  supabase: Client,
  id: string,
  updates: Database["public"]["Tables"]["products"]["Update"]
) {
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(supabase: Client, id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function insertProductAttributes(
  supabase: Client,
  attrs: Database["public"]["Tables"]["product_attributes"]["Insert"]
) {
  const { data, error } = await supabase
    .from("product_attributes")
    .insert(attrs)
    .select()
    .single();

  if (error) throw error;
  return data as ProductAttributes;
}

// ── Outfits ─────────────────────────────────────────────────

export async function getOutfits(supabase: Client) {
  const { data, error } = await supabase
    .from("outfits")
    .select(
      `
      *,
      outfit_items(*, products(*, product_attributes(*))),
      outfit_content(*)
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as OutfitWithDetails[];
}

export async function insertOutfitContent(
  supabase: Client,
  content: Database["public"]["Tables"]["outfit_content"]["Insert"]
) {
  const { data, error } = await supabase
    .from("outfit_content")
    .insert(content)
    .select()
    .single();

  if (error) throw error;
  return data as OutfitContent;
}

/** Removes any existing content rows for an outfit — used before
 * re-inserting so an outfit only ever has one active content row
 * (e.g. when regenerating in a different language/format). */
export async function deleteOutfitContent(supabase: Client, outfitId: string) {
  const { error } = await supabase
    .from("outfit_content")
    .delete()
    .eq("outfit_id", outfitId);
  if (error) throw error;
}

export async function getOutfitById(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from("outfits")
    .select(
      `
      *,
      outfit_items(*, products(*, product_attributes(*))),
      outfit_content(*)
    `
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as OutfitWithDetails;
}

// ── Billing ─────────────────────────────────────────────────

export async function getPlans(supabase: Client) {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as Plan[];
}

export async function getCurrentSubscription(
  supabase: Client
): Promise<SubscriptionWithPlan | null> {
  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!sub) return null;

  // Only 3 plan rows total — joining client-side avoids the multi-FK
  // PostgREST embed-hint footgun (subscriptions has two FKs into plans).
  const plans = await getPlans(supabase);
  const plan = plans.find((p) => p.id === sub.plan_id)!;
  const pendingPlan = sub.pending_plan_id
    ? (plans.find((p) => p.id === sub.pending_plan_id) ?? null)
    : null;

  return { ...sub, plan, pendingPlan };
}

export async function getBillingTransactions(supabase: Client) {
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as BillingTransaction[];
}

export async function getUsageEvents(supabase: Client) {
  const { data, error } = await supabase
    .from("usage_events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as UsageEvent[];
}

// ── Profile / brand kit ────────────────────────────────────

export async function getCurrentProfile(supabase: Client) {
  const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  supabase: Client,
  id: string,
  updates: Database["public"]["Tables"]["profiles"]["Update"]
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

// ── Analytics ──────────────────────────────────────────────
// Backed by the SECURITY INVOKER functions in 019_analytics_functions.sql,
// so RLS scopes every result to the signed-in user.

export async function getAnalyticsDailyUsage(
  supabase: Client,
  days = 30
): Promise<AnalyticsDailyPoint[]> {
  const { data, error } = await supabase.rpc("analytics_daily_usage", {
    p_days: days,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getAnalyticsSummary(
  supabase: Client
): Promise<AnalyticsSummary> {
  const { data, error } = await supabase.rpc("analytics_summary");
  if (error) throw error;
  return data![0];
}

export async function getAnalyticsOutfitsByTheme(supabase: Client) {
  const { data, error } = await supabase.rpc("analytics_outfits_by_theme");
  if (error) throw error;
  return data ?? [];
}

export async function getAnalyticsCaptionsBreakdown(supabase: Client) {
  const { data, error } = await supabase.rpc("analytics_captions_breakdown");
  if (error) throw error;
  return data ?? [];
}

export async function getAnalyticsProductsByCategory(supabase: Client) {
  const { data, error } = await supabase.rpc("analytics_products_by_category");
  if (error) throw error;
  return data ?? [];
}
