import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OutfitWithDetails } from "@/lib/supabase/types";
import { getProducts, getOutfits } from "@/lib/supabase/queries";
import { comboKey, matchOutfits, type OutfitCandidate } from "./matcher";

type Client = SupabaseClient<Database>;

export interface GenerateOutfitsOptions {
  /** How many outfits to attempt per theme. Defaults to 1. */
  count?: number;
  /** When provided, only these theme names are generated. */
  selectedThemes?: string[];
}

/**
 * Replaces the current set of outfits with a fresh, diverse set.
 *
 * 1. Fetches all products with attributes
 * 2. Deletes existing outfits (CASCADE handles items + content)
 * 3. Runs the diversity-aware matcher, once per requested outfit-per-theme
 * 4. Saves the new outfits
 * 5. Returns the fresh set
 */
export async function generateOutfits(
  supabase: Client,
  options: GenerateOutfitsOptions = {}
): Promise<OutfitWithDetails[]> {
  const count = Math.max(1, options.count ?? 1);
  const { selectedThemes } = options;

  // 1. Fetch products with attributes
  const products = await getProducts(supabase);

  if (products.length < 2) {
    throw new Error(
      "You need at least 2 products with attributes to generate outfits."
    );
  }

  // 2. Delete existing outfits — ON DELETE CASCADE clears outfit_items + outfit_content
  const existingOutfits = await getOutfits(supabase);
  if (existingOutfits.length > 0) {
    const outfitIds = existingOutfits.map((o) => o.id);
    const { error: delErr } = await supabase
      .from("outfits")
      .delete()
      .in("id", outfitIds);
    if (delErr) throw delErr;
  }

  // 3. Run the matcher `count` times per theme. Each run's picks are fed
  //    back in as `existingKeys` so later runs don't repeat the same
  //    exact combo — this is how we get multiple distinct outfits/theme.
  const usedKeys = new Set<string>();
  const candidates: OutfitCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const batch = matchOutfits(products, usedKeys, selectedThemes);
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

  // 4. Save each outfit
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

    if (itemsErr) throw itemsErr;
  }

  // 5. Return the fresh set
  return getOutfits(supabase);
}
