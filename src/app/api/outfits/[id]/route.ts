import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, OutfitWithDetails } from "@/lib/supabase/types";

/**
 * Public read endpoint for a single outfit — used by the shareable
 * lookbook page. Uses the service role key to bypass RLS (owner-scoped
 * `select` policies would otherwise hide the outfit from anonymous
 * visitors) since a lookbook link is meant to be viewable by anyone.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Public lookbooks are not configured on this server." },
      { status: 500 }
    );
  }

  const supabase = createClient<Database>(url, serviceKey);

  const { data, error } = await supabase
    .from("outfits")
    .select(
      `
      *,
      outfit_items(*, products(*, product_attributes(*))),
      outfit_content(*)
    `
    )
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Outfit not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ outfit: data as OutfitWithDetails });
}
