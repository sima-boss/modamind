"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  Search,
  Shirt,
  Sparkles,
  Lightbulb,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { TopUpModal } from "@/components/billing/TopUpModal";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentSubscription,
  getOutfits,
  getProducts,
} from "@/lib/supabase/queries";
import { THEME_NAMES } from "@/lib/outfits/matcher";
import { analyzeProductGaps, type GapInsight } from "@/lib/outfits/gaps";
import { cn } from "@/lib/utils";
import { getRemaining } from "@/lib/usage";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/events";
import type { OutfitWithDetails, SubscriptionWithPlan } from "@/lib/supabase/types";

const MIN_COUNT = 1;
const MAX_COUNT = 5;

function matchesSearch(o: OutfitWithDetails, query: string): boolean {
  const q = query.toLowerCase();
  if (o.title?.toLowerCase().includes(q)) return true;
  if (o.theme_name?.toLowerCase().includes(q)) return true;
  return o.outfit_items.some((item) =>
    item.products?.name?.toLowerCase().includes(q)
  );
}

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<OutfitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [countPerTheme, setCountPerTheme] = useState(1);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(THEME_NAMES);
  const [gapInsight, setGapInsight] = useState<GapInsight | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(
    null
  );
  const [showTopUpModal, setShowTopUpModal] = useState(false);

  const fetchOutfits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [data, sub] = await Promise.all([
        getOutfits(supabase),
        getCurrentSubscription(supabase),
      ]);
      setOutfits(data);
      setSubscription(sub);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load outfits";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutfits();
  }, [fetchOutfits]);

  const outfitsRemaining = subscription
    ? getRemaining(subscription.plan, subscription, "outfit_generation")
        .remaining
    : null;
  const outOfCredits = outfitsRemaining !== null && outfitsRemaining <= 0;

  function toggleTheme(name: string) {
    setSelectedThemes((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  }

  async function handleGenerate() {
    if (selectedThemes.length === 0) {
      setError("Select at least one theme to generate.");
      return;
    }
    if (outOfCredits) {
      setShowTopUpModal(true);
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: countPerTheme, selectedThemes }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "limit_reached") {
          setShowTopUpModal(true);
          return;
        }
        throw new Error(body.error ?? "Failed to generate outfits");
      }

      window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED_EVENT));

      await fetchOutfits();
      const products = await getProducts(createClient());
      setGapInsight(analyzeProductGaps(products));
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate outfits";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  const filtered = search
    ? outfits.filter((o) => matchesSearch(o, search))
    : outfits;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Outfits</h2>
        <p className="text-muted-foreground">
          Auto-generated outfit combinations from your catalog.
        </p>
      </div>

      {/* Generation controls */}
      <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Themes
          </Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {THEME_NAMES.map((name) => {
              const active = selectedThemes.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleTheme(name)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  aria-pressed={active}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Label
              htmlFor="count-per-theme"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Outfits per theme
            </Label>
            <Input
              id="count-per-theme"
              type="number"
              min={MIN_COUNT}
              max={MAX_COUNT}
              value={countPerTheme}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isNaN(n)) return;
                setCountPerTheme(Math.min(MAX_COUNT, Math.max(MIN_COUNT, n)));
              }}
              className="mt-2 w-20"
            />
          </div>

          <Button onClick={handleGenerate} disabled={generating}>
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!generating && <Sparkles className="mr-2 h-4 w-4" />}
            {outOfCredits ? "Buy more outfits" : "Generate Outfits"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Product gap insight */}
      {gapInsight?.message && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{gapInsight.message}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : outfits.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed">
          <Shirt className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No outfits yet</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Add products with images first, then click{" "}
            <strong>Generate Outfits</strong> to create matching combinations.
          </p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by theme or product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{filtered.length}</Badge>
            {search
              ? `of ${outfits.length} outfit${outfits.length !== 1 ? "s" : ""}`
              : `outfit${filtered.length !== 1 ? "s" : ""} generated`}
          </div>

          {filtered.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              No outfits match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {filtered.map((outfit) => (
                <OutfitCard key={outfit.id} outfit={outfit} />
              ))}
            </div>
          )}
        </>
      )}

      <TopUpModal
        open={showTopUpModal}
        onOpenChange={setShowTopUpModal}
        onPurchased={fetchOutfits}
      />
    </div>
  );
}
