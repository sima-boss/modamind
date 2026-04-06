import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OutfitWithDetails } from "@/lib/supabase/types";
import { getProducts, getOutfits } from "@/lib/supabase/queries";
import { matchOutfits } from "./matcher";

type Client = SupabaseClient<Database>;

/**
 * Fetches all products, runs the matching engine, and saves
 * the generated outfits to the database.
 *
 * Returns the full list of outfits (including any that existed before).
 */
export async function generateOutfits(
  supabase: Client
): Promise<OutfitWithDetails[]> {
  // 1. Fetch products with attributes
  const products = await getProducts(supabase);

  if (products.length < 2) {
    throw new Error("You need at least 2 products with attributes to generate outfits.");
  }

  // 2. Run matcher
  const candidates = matchOutfits(products);

  if (candidates.length === 0) {
    throw new Error("Could not generate any outfits from the current products. Try adding more variety.");
  }

  // 3. Save each outfit
  for (const candidate of candidates) {
    // Insert outfit row
    const { data: outfit, error: outfitErr } = await supabase
      .from("outfits")
      .insert({
        theme_name: candidate.theme.name,
        title: candidate.title,
      })
      .select()
      .single();

    if (outfitErr) throw outfitErr;

    // Insert outfit items
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

  // 4. Return all outfits (newly created + any existing)
  return getOutfits(supabase);
}
