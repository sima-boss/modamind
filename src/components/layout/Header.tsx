"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "@/components/providers/AuthProvider";
import { useLogout } from "@/lib/hooks/use-logout";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { createClient } from "@/lib/supabase/client";
import { getCurrentSubscription } from "@/lib/supabase/queries";
import type { SubscriptionWithPlan } from "@/lib/supabase/types";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/events";
import { getRemaining } from "@/lib/usage";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Products",
  "/outfits": "Outfits",
  "/analytics": "Analytics",
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
        <GlobalSearch />

        <NotificationBell subscription={subscription} userId={user?.id} />

        <div className="flex items-center gap-2 pl-1">
          {subscription &&
            (() => {
              const { planRemaining, extraCredits, totalAvailable, isUnlimited } =
                getRemaining(subscription.plan, subscription, "outfit_generation");
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="hidden flex-col items-end sm:flex">
                      <Badge variant="secondary">{subscription.plan.name}</Badge>
                      <span className="mt-0.5 text-[11px] text-muted-foreground">
                        {isUnlimited
                          ? "Unlimited outfits"
                          : `${totalAvailable} outfits left`}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isUnlimited
                      ? "Unlimited outfit generations on this plan"
                      : `Plan: ${planRemaining} remaining · Extra credits: ${extraCredits}`}
                  </TooltipContent>
                </Tooltip>
              );
            })()}
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
