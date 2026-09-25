"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Coins,
  Download,
  FileText,
  Loader2,
  Package,
  Plus,
  Shirt,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TopUpModal } from "@/components/billing/TopUpModal";
import { createClient } from "@/lib/supabase/client";
import {
  getProducts,
  getOutfits,
  getCurrentSubscription,
} from "@/lib/supabase/queries";
import { getRemaining, type UsageType } from "@/lib/usage";
import { cn } from "@/lib/utils";
import type {
  ProductWithAttributes,
  OutfitWithDetails,
  SubscriptionWithPlan,
} from "@/lib/supabase/types";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Shared bar renderer for any "used / limit" metric (plan allowance or
 * total products) — amber at >=80%, hidden entirely when unlimited. */
function LimitBar({
  label,
  used,
  limit,
  unlimitedLabel = "Unlimited",
}: {
  label: string;
  used: number;
  limit: number | null;
  unlimitedLabel?: string;
}) {
  const isUnlimited = limit === null;
  const percent = isUnlimited
    ? null
    : Math.min(Math.round((used / limit) * 100), 100);
  const warning = percent !== null && percent >= 80;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {isUnlimited
            ? unlimitedLabel
            : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              warning ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

function UsageRow({
  label,
  plan,
  subscription,
  type,
}: {
  label: string;
  plan: SubscriptionWithPlan["plan"];
  subscription: SubscriptionWithPlan;
  type: UsageType;
}) {
  const { used, limit, isUnlimited, planRemaining, extraCredits, totalAvailable } =
    getRemaining(plan, subscription, type);

  return (
    <div>
      <LimitBar label={label} used={used} limit={limit} />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {isUnlimited
          ? "Unlimited this month"
          : `Total available: ${totalAvailable!.toLocaleString()} (${planRemaining!.toLocaleString()} plan + ${extraCredits.toLocaleString()} extra)`}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [products, setProducts] = useState<ProductWithAttributes[]>([]);
  const [outfits, setOutfits] = useState<OutfitWithDetails[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [showTopUpModal, setShowTopUpModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [prods, fits, sub] = await Promise.all([
        getProducts(supabase),
        getOutfits(supabase),
        getCurrentSubscription(supabase),
      ]);
      setProducts(prods);
      setOutfits(fits);
      setSubscription(sub);
    } catch (err) {
      console.error("Dashboard fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const contentCount = outfits.filter(
    (o) => o.outfit_content?.length > 0
  ).length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: "Total Products", value: products.length, icon: Package },
    { label: "Outfits Created", value: outfits.length, icon: Shirt },
    {
      label: "AI Content Generated",
      value: contentCount,
      icon: FileText,
    },
  ];

  const recentProducts = products.slice(0, 3);
  const recentOutfits = outfits.slice(0, 3);
  const hasActivity = recentProducts.length > 0 || recentOutfits.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Welcome to Fashnix
        </h2>
        <p className="text-muted-foreground">
          Your AI-powered fashion intelligence hub.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="mt-1 block text-2xl font-semibold">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Usage this period */}
      {subscription && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-4 font-semibold">Usage this period</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <UsageRow
              label="Outfit generations"
              plan={subscription.plan}
              subscription={subscription}
              type="outfit_generation"
            />
            <UsageRow
              label="AI captions"
              plan={subscription.plan}
              subscription={subscription}
              type="ai_caption"
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                Extra credits: {subscription.extra_credits_balance.toLocaleString()} left
              </span>
              <span className="text-xs text-muted-foreground">
                (usable for outfits or captions)
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTopUpModal(true)}
            >
              Buy more
            </Button>
          </div>

          <div className="mt-5 border-t pt-4">
            <LimitBar
              label="Products"
              used={products.length}
              limit={subscription.plan.products_limit}
              unlimitedLabel="Unlimited"
            />
          </div>
        </div>
      )}

      <TopUpModal open={showTopUpModal} onOpenChange={setShowTopUpModal} />

      {/* Recent Activity + Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-3">
            <h3 className="font-semibold">Recent Activity</h3>
          </div>

          {!hasActivity ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No activity yet. Start by adding products!
            </div>
          ) : (
            <div className="divide-y">
              {recentProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {p.category}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(p.created_at)}
                  </span>
                </div>
              ))}
              {recentOutfits.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <Shirt className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {o.title ?? "Untitled Outfit"}
                    </p>
                    {o.theme_name && (
                      <p className="text-xs text-muted-foreground">
                        {o.theme_name}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(o.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-3">
            <h3 className="font-semibold">Quick Actions</h3>
          </div>
          <div className="space-y-2 p-5">
            <Button
              asChild
              variant="outline"
              className="w-full justify-start"
            >
              <Link href="/products">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
                <ArrowRight className="ml-auto h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start"
            >
              <Link href="/outfits">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Outfits
                <ArrowRight className="ml-auto h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-start"
            >
              <Link href="/export">
                <Download className="mr-2 h-4 w-4" />
                Go to Export
                <ArrowRight className="ml-auto h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
