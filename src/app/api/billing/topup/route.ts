import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { topupSchema } from "@/lib/validation/billing";
import { TOPUP_PACKAGES } from "@/lib/topups";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = topupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });
  }

  const pkg = TOPUP_PACKAGES.find((p) => p.id === parsed.data.package)!;

  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("add_extra_credits", {
    p_user_id: user.id,
    p_credits: pkg.credits,
    p_amount_aed: pkg.amount_aed,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ subscription: data });
}
