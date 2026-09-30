import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sanitizeNext } from "@/lib/validation/auth";

/** OAuth (Google) return URL. Exchanges the ?code for a session, then sends
 * the user on — via /complete-profile first when Google didn't give us a
 * business name (it never does). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  // Provider-side failure or the user cancelling the consent screen.
  if (searchParams.get("error") || !code) {
    return NextResponse.redirect(`${origin}/login?error=oauth-failed`);
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oauth-failed`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.business_name?.trim()) {
    const target = new URL("/complete-profile", origin);
    target.searchParams.set("next", next);
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
