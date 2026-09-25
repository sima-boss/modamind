import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Default-deny: everything is protected unless explicitly listed here.
// New pages added later (billing, choose-plan, etc.) are protected
// automatically without needing to remember to update this file.
const PUBLIC_EXACT = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];
const PUBLIC_PREFIXES = ["/lookbook/", "/auth/"];

const AUTH_PAGES = ["/login", "/signup"];
const ONBOARDING_PAGES = ["/choose-plan", "/checkout"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath(pathname) && !AUTH_PAGES.includes(pathname)) {
    const onOnboardingPage = ONBOARDING_PAGES.includes(pathname);
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id")
      .maybeSingle();

    if (!subscription && !onOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/choose-plan";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (subscription && onOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/billing";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
