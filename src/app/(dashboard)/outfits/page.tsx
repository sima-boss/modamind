"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, Shirt, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { createClient } from "@/lib/supabase/client";
import { getOutfits } from "@/lib/supabase/queries";
import { generateOutfits } from "@/lib/outfits/generate";
import type { OutfitWithDetails } from "@/lib/supabase/types";

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<OutfitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOutfits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await getOutfits(supabase);
      setOutfits(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load outfits";
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{outfits.length}</Badge>
            outfit{outfits.length !== 1 && "s"} generated
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {outfits.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
