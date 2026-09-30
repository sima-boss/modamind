import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { brandKitSchema } from "@/lib/validation/brand-kit";
import { PlanGateError, requireSubscription } from "@/lib/plan-gate";

/** Saves brand kit settings (logo + colors). Premium only — enforced here
 * against the caller's real subscription, not just hidden in the UI, so a
 * Basic/Standard account can't set brand_logo_url etc. by calling the API
 * directly even though the profiles row is otherwise self-updatable. */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = brandKitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const subscription = await requireSubscription(supabase);
    if (!subscription.plan.has_brand_kit) {
      return NextResponse.json(
        { error: "Brand kit is a Premium feature. Upgrade to unlock." },
        { status: 403 }
      );
    }
  } catch (err) {
    if (err instanceof PlanGateError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}
