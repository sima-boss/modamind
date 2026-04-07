"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Search, Shirt, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { createClient } from "@/lib/supabase/client";
import { getOutfits } from "@/lib/supabase/queries";
import { generateOutfits } from "@/lib/outfits/generate";
import type { OutfitWithDetails } from "@/lib/supabase/types";

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

  const fetchOutfits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await getOutfits(supabase);
      setOutfits(data);
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

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await generateOutfits(supabase);
      setOutfits(data);
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Outfits</h2>
          <p className="text-muted-foreground">
            Auto-generated outfit combinations from your catalog.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate Outfits
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
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
    </div>
  );
}
