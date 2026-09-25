import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateOutfitsSchema } from "@/lib/validation/outfits";
import { generateOutfits } from "@/lib/outfits/generate";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = generateOutfitsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { count, selectedThemes } = parsed.data;
  const requestedMax = count * selectedThemes.length;

  const service = createServiceRoleClient();
  const { data: consumed, error: consumeErr } = await service.rpc(
    "consume_usage_credits",
    { p_user_id: user.id, p_type: "outfit_generation", p_count: requestedMax }
  );

  if (consumeErr) {
    if (consumeErr.message.includes("limit_reached")) {
      return NextResponse.json({ error: "limit_reached" }, { status: 403 });
    }
    return NextResponse.json({ error: consumeErr.message }, { status: 400 });
  }

  const { from_topup } = consumed[0];

  let outfits: Awaited<ReturnType<typeof generateOutfits>> = [];
  let generateError: string | null = null;
  try {
    outfits = await generateOutfits(supabase, { count, selectedThemes });
  } catch (err) {
    generateError = err instanceof Error ? err.message : "Failed to generate outfits";
  }

  const shortfall = requestedMax - outfits.length;
  if (shortfall > 0) {
    const refundTopup = Math.min(shortfall, from_topup);
    const refundMonthly = shortfall - refundTopup;
    await service.rpc("refund_usage_credits", {
      p_user_id: user.id,
      p_type: "outfit_generation",
      p_from_monthly: refundMonthly,
      p_from_topup: refundTopup,
    });
  }

  if (outfits.length === 0) {
    return NextResponse.json(
      { error: generateError ?? "Could not generate any outfits." },
      { status: 400 }
    );
  }

  return NextResponse.json({ outfits });
}
