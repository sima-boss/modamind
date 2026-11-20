import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateOutfitsSchema } from "@/lib/validation/outfits";
import { generateOutfits } from "@/lib/outfits/generate";
import { checkThemeFit } from "@/lib/outfits/matcher";
import { getProducts } from "@/lib/supabase/queries";
import { PlanGateError, maxOutfitsPerRequest, requireSubscription } from "@/lib/plan-gate";

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

  // Bulk generation (more than one outfit per request) is Premium only —
  // enforced against the caller's real plan, never a client-sent tier.
  try {
    const subscription = await requireSubscription(supabase);
    const cap = maxOutfitsPerRequest(subscription.plan);
    if (requestedMax > cap) {
      return NextResponse.json(
        {
          error: subscription.plan.has_bulk_generation
            ? `You can generate up to ${cap} outfits per request.`
            : "Bulk generation is a Premium feature. Upgrade to generate more than 1 outfit per request.",
        },
        { status: 403 }
      );
    }
  } catch (err) {
    if (err instanceof PlanGateError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  // Theme-fit pre-check — runs before credits are charged, so a catalog
  // that can't support a theme costs nothing.
  let products: Awaited<ReturnType<typeof getProducts>>;
  try {
    products = await getProducts(supabase);
  } catch {
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }

  const fittingThemes: string[] = [];
  const skipped: { theme: string; message: string }[] = [];
  for (const theme of selectedThemes) {
    const fit = checkThemeFit(products, theme);
    if (fit.ok) fittingThemes.push(theme);
    else skipped.push({ theme, message: fit.message });
  }

  if (fittingThemes.length === 0) {
    return NextResponse.json(
      { error: skipped.map((s) => s.message).join(" "), skipped },
      { status: 422 }
    );
  }

  const chargeCount = count * fittingThemes.length;

  const service = createServiceRoleClient();
  const { data: consumed, error: consumeErr } = await service.rpc(
    "consume_usage_credits",
    { p_user_id: user.id, p_type: "outfit_generation", p_count: chargeCount }
  );

  if (consumeErr) {
    if (consumeErr.message.includes("limit_reached")) {
      return NextResponse.json({ error: "limit_reached" }, { status: 403 });
    }
    return NextResponse.json({ error: consumeErr.message }, { status: 400 });
  }

  const { from_extra } = consumed[0];

  let outfits: Awaited<ReturnType<typeof generateOutfits>> = [];
  let generateError: string | null = null;
  try {
    outfits = await generateOutfits(supabase, {
      count,
      selectedThemes: fittingThemes,
      products,
    });
  } catch (err) {
    generateError = err instanceof Error ? err.message : "Failed to generate outfits";
  }

  const shortfall = chargeCount - outfits.length;
  if (shortfall > 0) {
    const refundExtra = Math.min(shortfall, from_extra);
    const refundMonthly = shortfall - refundExtra;
    await service.rpc("refund_usage_credits", {
      p_user_id: user.id,
      p_type: "outfit_generation",
      p_from_monthly: refundMonthly,
      p_from_extra: refundExtra,
    });
  }

  if (outfits.length === 0) {
    return NextResponse.json(
      { error: generateError ?? "Could not generate any outfits." },
      { status: 400 }
    );
  }

  return NextResponse.json({ outfits, skipped });
}
