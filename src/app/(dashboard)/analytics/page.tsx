import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  FileText,
  Package,
  Shirt,
  Sparkles,
} from "lucide-react";

import { LockedFeature } from "@/components/billing/LockedFeature";
import {
  BreakdownBarChart,
  UsageSplitChart,
  UsageTrendChart,
} from "@/components/analytics/charts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getAnalyticsCaptionsBreakdown,
  getAnalyticsDailyUsage,
  getAnalyticsOutfitsByTheme,
  getAnalyticsProductsByCategory,
  getAnalyticsSummary,
  getCurrentSubscription,
} from "@/lib/supabase/queries";
import { canViewFullAnalytics } from "@/lib/plan-gate";

// Reads the signed-in user's cookies/RLS — never statically cacheable.
export const dynamic = "force-dynamic";

const LANGUAGE_LABEL: Record<string, string> = { en: "English", ar: "Arabic" };
const FORMAT_LABEL: Record<string, string> = {
  generic: "Generic",
  instagram: "Instagram",
  tiktok: "TikTok",
};

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Card({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-sm ${className ?? ""}`}>
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-4 text-xs text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function LockedCard({ title, label }: { title: string; label: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="mb-4 font-semibold">{title}</h3>
      <LockedFeature label={label} />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  delta,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  /** % change vs the previous 30 days; omitted when there's no baseline. */
  delta?: number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="mt-1 block text-2xl font-semibold">{value}</span>
      {delta != null && (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
            delta >= 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {delta >= 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(delta)}% vs previous 30 days
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function AnalyticsPage() {
  const supabase = createServerSupabaseClient();
  const subscription = await getCurrentSubscription(supabase);

  if (!subscription) {
    return (
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          Choose a plan to start tracking your usage.{" "}
          <Link
            href="/choose-plan"
            className="text-primary underline-offset-4 hover:underline"
          >
            View plans
          </Link>
        </p>
      </div>
    );
  }

  // The plan is checked here, before any gated query runs, so locked
  // data never leaves the database for lower tiers.
  const full = canViewFullAnalytics(subscription.plan);

  const [summary, daily, themes, captions, categories] = await Promise.all([
    getAnalyticsSummary(supabase),
    getAnalyticsDailyUsage(supabase, full ? 60 : 30),
    full ? getAnalyticsOutfitsByTheme(supabase) : Promise.resolve([]),
    full ? getAnalyticsCaptionsBreakdown(supabase) : Promise.resolve([]),
    full ? getAnalyticsProductsByCategory(supabase) : Promise.resolve([]),
  ]);

  const avgPerActiveDay =
    summary.active_days_last_30 > 0
      ? Math.round(summary.outfits_last_30 / summary.active_days_last_30)
      : 0;

  const hasUsage =
    summary.total_outfit_generations + summary.total_captions > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          How you&apos;re using Fashnix — {full ? "full" : "basic"} analytics on
          the {subscription.plan.name} plan.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Outfits generated"
          value={summary.total_outfit_generations.toLocaleString()}
          icon={Shirt}
          delta={
            full
              ? pctChange(summary.outfits_last_30, summary.outfits_prev_30)
              : undefined
          }
        />
        <Kpi
          label="Captions generated"
          value={summary.total_captions.toLocaleString()}
          icon={FileText}
          delta={
            full
              ? pctChange(summary.captions_last_30, summary.captions_prev_30)
              : undefined
          }
        />
        <Kpi
          label="Products"
          value={summary.products.toLocaleString()}
          icon={Package}
        />
        <Kpi
          label="Saved outfits"
          value={summary.saved_outfits.toLocaleString()}
          icon={Sparkles}
        />
        {full && (
          <>
            <Kpi
              label="Avg. per active day"
              value={avgPerActiveDay.toLocaleString()}
              icon={CalendarDays}
              hint={`Outfits, last 30 days (${summary.active_days_last_30} active days)`}
            />
            <Kpi
              label="Busiest day"
              value={
                summary.busiest_day
                  ? new Date(
                      `${summary.busiest_day}T00:00:00`
                    ).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })
                  : "—"
              }
              icon={CalendarDays}
              hint={`${summary.busiest_day_count.toLocaleString()} outfit generations`}
            />
          </>
        )}
      </div>

      {!hasUsage ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          No usage yet. Generate some outfits and your charts will appear here.
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              title="Generations over time"
              description={`Outfit generations and AI captions per day, last ${full ? "30 or 60" : "30"} days`}
              className="lg:col-span-2"
            >
              <UsageTrendChart data={daily} allowRangeToggle={full} />
            </Card>
            <Card title="Usage split" description="Outfits vs captions, all time">
              <UsageSplitChart
                outfits={summary.total_outfit_generations}
                captions={summary.total_captions}
              />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {full ? (
              <>
                <Card
                  title="Outfits by occasion"
                  description="Your saved outfits, by theme"
                >
                  {themes.length ? (
                    <BreakdownBarChart
                      data={themes.map((t) => ({
                        label: t.theme,
                        value: t.total,
                      }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No saved outfits yet.
                    </p>
                  )}
                </Card>
                <Card
                  title="Captions by language & format"
                  description="Your saved captions"
                >
                  {captions.length ? (
                    <BreakdownBarChart
                      color="hsl(263 70% 60%)"
                      data={captions.map((c) => ({
                        label: `${LANGUAGE_LABEL[c.language] ?? c.language} · ${
                          FORMAT_LABEL[c.format] ?? c.format
                        }`,
                        value: c.total,
                      }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No saved captions yet.
                    </p>
                  )}
                </Card>
                <Card
                  title="Products by category"
                  description="Your catalogue mix"
                  className="lg:col-span-2"
                >
                  {categories.length ? (
                    <BreakdownBarChart
                      data={categories.map((c) => ({
                        label: titleCase(c.category),
                        value: c.total,
                      }))}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No products yet.
                    </p>
                  )}
                </Card>
              </>
            ) : (
              <>
                <LockedCard
                  title="Outfits by occasion"
                  label="Occasion breakdown — Full analytics"
                />
                <LockedCard
                  title="Captions by language & format"
                  label="Caption breakdown — Full analytics"
                />
                <div className="lg:col-span-2">
                  <LockedCard
                    title="Products by category"
                    label="Catalogue mix & 60-day trends — Full analytics"
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
