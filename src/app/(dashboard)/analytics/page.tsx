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
import { DateRangePicker } from "@/components/analytics/DateRangePicker";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  countProducts,
  getAnalyticsProductsByCategory,
  getAnalyticsRangeCaptionsBreakdown,
  getAnalyticsRangeDailyUsage,
  getAnalyticsRangeOutfitsByTheme,
  getAnalyticsRangeSummary,
  getCurrentSubscription,
} from "@/lib/supabase/queries";
import { canViewFullAnalytics } from "@/lib/plan-gate";
import {
  bucketSize,
  bucketWeekly,
  formatDay,
  formatRange,
  pctChange,
  resolveRange,
  todayInDubai,
} from "@/lib/analytics/date-range";

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

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
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
  deltaLabel,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  /** % change vs the previous period; omitted when there's no baseline. */
  delta?: number | null;
  /** e.g. "vs previous 14 days". */
  deltaLabel?: string;
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
          {Math.abs(delta)}% {deltaLabel}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
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
  // data never leaves the database for lower tiers. resolveRange also
  // pins lower tiers to the last 30 days whatever the URL says.
  const full = canViewFullAnalytics(subscription.plan);
  const today = todayInDubai();
  const range = resolveRange(searchParams, today, { full });

  const planLine = `${full ? "Full" : "Basic"} analytics on the ${subscription.plan.name} plan.`;
  const picker = (
    <DateRangePicker
      key={`${range.preset}|${range.from}|${range.to}`}
      preset={range.preset}
      from={range.from}
      to={range.to}
      today={today}
      full={full}
      error={range.ok ? undefined : range.error}
    />
  );

  // Invalid custom range: show the error and don't query anything.
  if (!range.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">{planLine}</p>
        </div>
        {picker}
      </div>
    );
  }

  const { from, to, days } = range;
  const [summary, daily, productCount, themes, captions, categories] =
    await Promise.all([
      getAnalyticsRangeSummary(supabase, from, to),
      getAnalyticsRangeDailyUsage(supabase, from, to),
      countProducts(supabase),
      full ? getAnalyticsRangeOutfitsByTheme(supabase, from, to) : Promise.resolve([]),
      full ? getAnalyticsRangeCaptionsBreakdown(supabase, from, to) : Promise.resolve([]),
      full ? getAnalyticsProductsByCategory(supabase) : Promise.resolve([]),
    ]);

  const bucket = bucketSize(days);
  const trend =
    bucket === "week" ? bucketWeekly(daily) : daily.map((p) => ({ ...p, end: p.day }));

  const avgPerActiveDay =
    summary.active_days > 0 ? Math.round(summary.outfits / summary.active_days) : 0;
  const hasUsage = summary.outfits + summary.captions > 0;
  const deltaLabel = `vs previous ${plural(days, "day")}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          {formatRange(from, to)} · {planLine}
        </p>
      </div>

      {picker}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Outfits generated"
          value={summary.outfits.toLocaleString()}
          icon={Shirt}
          delta={full ? pctChange(summary.outfits, summary.outfits_prev) : undefined}
          deltaLabel={deltaLabel}
        />
        <Kpi
          label="Captions generated"
          value={summary.captions.toLocaleString()}
          icon={FileText}
          delta={full ? pctChange(summary.captions, summary.captions_prev) : undefined}
          deltaLabel={deltaLabel}
        />
        <Kpi
          label="Products"
          value={productCount.toLocaleString()}
          icon={Package}
          hint="Current catalog"
        />
        <Kpi
          label="Saved outfits"
          value={summary.saved_outfits.toLocaleString()}
          icon={Sparkles}
          hint="Saved in range"
        />
        {full && (
          <>
            <Kpi
              label="Avg. per active day"
              value={avgPerActiveDay.toLocaleString()}
              icon={CalendarDays}
              hint={`Outfits, ${plural(summary.active_days, "active day")} in range`}
            />
            <Kpi
              label="Busiest day"
              value={summary.busiest_day ? formatDay(summary.busiest_day) : "—"}
              icon={CalendarDays}
              hint={`${summary.busiest_day_count.toLocaleString()} outfit generations`}
            />
          </>
        )}
      </div>

      {!hasUsage ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          No activity between {formatRange(from, to, " and ")}.
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              title="Generations over time"
              description={`Outfit generations and AI captions per ${bucket}`}
              className="lg:col-span-2"
            >
              <UsageTrendChart data={trend} bucket={bucket} />
            </Card>
            <Card title="Usage split" description="Outfits vs captions, selected range">
              <UsageSplitChart outfits={summary.outfits} captions={summary.captions} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {full ? (
              <>
                <Card
                  title="Outfits by occasion"
                  description="Outfits saved in range, by theme"
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
                      No outfits saved in this range.
                    </p>
                  )}
                </Card>
                <Card
                  title="Captions by language & format"
                  description="Captions generated in range"
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
                      No captions in this range.
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
              </>
            )}
          </div>
        </>
      )}

      {/* Not date-based, so it shows regardless of activity in the range. */}
      {full ? (
        <Card title="Products by category" description="Current catalog">
          {categories.length ? (
            <BreakdownBarChart
              data={categories.map((c) => ({
                label: titleCase(c.category),
                value: c.total,
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          )}
        </Card>
      ) : (
        <LockedCard
          title="Products by category"
          label="Catalogue mix — Full analytics"
        />
      )}
    </div>
  );
}
