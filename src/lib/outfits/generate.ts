import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  OutfitWithDetails,
  ProductWithAttributes,
} from "@/lib/supabase/types";
import { getProducts, getOutfitsByIds } from "@/lib/supabase/queries";
import { comboKey, matchOutfits, type OutfitCandidate } from "./matcher";

type Client = SupabaseClient<Database>;

export interface GenerateOutfitsOptions {
  /** How many outfits to attempt per theme. Defaults to 1. */
  count?: number;
  /** When provided, only these theme names are generated. */
  selectedThemes?: string[];
  /** Already-fetched products (e.g. from a theme-fit pre-check). */
  products?: ProductWithAttributes[];
}

/**
 * Generates a fresh, diverse batch of outfits and ADDS it to the user's
 * existing outfits. Existing outfits are never deleted here — shared
 * lookbook links must keep working; users delete outfits themselves.
 *
 * 1. Fetches all products with attributes
 * 2. Runs the diversity-aware matcher, once per requested outfit-per-theme
 * 3. Saves the new outfits (an outfit whose items fail to save is removed)
 * 4. Returns ONLY the newly created outfits — the generate route bases its
 *    credit refund on this count, so it must not include older outfits.
 */
export async function generateOutfits(
  supabase: Client,
  options: GenerateOutfitsOptions = {}
): Promise<OutfitWithDetails[]> {
  const count = Math.max(1, options.count ?? 1);
  const { selectedThemes } = options;

  // 1. Fetch products with attributes
  const products = options.products ?? (await getProducts(supabase));

  if (products.length < 2) {
    throw new Error(
      "You need at least 2 products with attributes to generate outfits."
    );
  }

  // 2. Run the matcher `count` times per theme. Each run's picks are fed
  //    back in as `existingKeys` so later runs don't repeat the same
  //    exact combo — this is how we get multiple distinct outfits/theme.
  //    Usage counts are shared too, so the reuse penalty spans all runs.
  const usedKeys = new Set<string>();
  const usageCounts = new Map<string, number>();
  const candidates: OutfitCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const batch = matchOutfits(products, usedKeys, selectedThemes, usageCounts);
    for (const candidate of batch) {
      usedKeys.add(comboKey(candidate.items.map((item) => item.product.id)));
    }
    candidates.push(...batch);
  }

  if (candidates.length === 0) {
    throw new Error(
      "Could not generate any outfits from the current products. Try adding more variety."
    );
  }

  // 3. Save each outfit
  const createdIds: string[] = [];
  for (const candidate of candidates) {
    const { data: outfit, error: outfitErr } = await supabase
      .from("outfits")
      .insert({
        theme_name: candidate.theme.name,
        title: candidate.title,
      })
      .select()
      .single();

    if (outfitErr) throw outfitErr;

    const items = candidate.items.map((item) => ({
      outfit_id: outfit.id,
      product_id: item.product.id,
      role: item.role,
    }));

    const { error: itemsErr } = await supabase
      .from("outfit_items")
      .insert(items);

    if (itemsErr) {
      // Never keep a half-saved outfit with no items. Best-effort cleanup:
      // the original items error is what the caller needs to see.
      await supabase.from("outfits").delete().eq("id", outfit.id);
      throw itemsErr;
    }

    createdIds.push(outfit.id);
  }

  // 4. Return only the outfits created by this call
  return getOutfitsByIds(supabase, createdIds);
}
