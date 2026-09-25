"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSession } from "@/components/providers/AuthProvider";
import { useLogout } from "@/lib/hooks/use-logout";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { createClient } from "@/lib/supabase/client";
import { getCurrentSubscription } from "@/lib/supabase/queries";
import type { SubscriptionWithPlan } from "@/lib/supabase/types";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/events";
import { getRemaining } from "@/lib/usage";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/outfits": "Outfits",
  "/export": "Export",
  "/billing": "Billing",
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Fashnix";
  const { user } = useSession();
  const { logout, loggingOut } = useLogout();
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);

  useEffect(() => {
    function loadSubscription() {
      getCurrentSubscription(createClient())
        .then(setSubscription)
        .catch(() => setSubscription(null));
    }
    loadSubscription();
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, loadSubscription);
    return () =>
      window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, loadSubscription);
  }, []);

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "FX";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
      {/* Mobile nav trigger + page title */}
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 pl-9"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <div className="flex items-center gap-2 pl-1">
          {subscription && (
            <div className="hidden flex-col items-end sm:flex">
              <Badge variant="secondary">{subscription.plan.name}</Badge>
              <span className="mt-0.5 text-[11px] text-muted-foreground">
                {(() => {
                  const { remaining, isUnlimited } = getRemaining(
                    subscription.plan,
                    subscription,
                    "outfit_generation"
                  );
                  return isUnlimited
                    ? "Unlimited outfits"
                    : `${remaining} outfits left`;
                })()}
              </span>
            </div>
          )}
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {fullName && (
            <span className="hidden text-sm font-medium sm:inline">
              {fullName}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            disabled={loggingOut}
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
