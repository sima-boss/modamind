"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import { Download, Loader2, ShoppingBag, Sparkles, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { insertOutfitContent } from "@/lib/supabase/queries";
import type { OutfitContent, OutfitWithDetails } from "@/lib/supabase/types";
import { ExportableOutfitCard } from "./ExportableOutfitCard";

interface OutfitCardProps {
  outfit: OutfitWithDetails;
}

export function OutfitCard({ outfit }: OutfitCardProps) {
  const items = outfit.outfit_items ?? [];
  const [content, setContent] = useState<OutfitContent | null>(
    outfit.outfit_content?.[0] ?? null
  );
  const [isFallback, setIsFallback] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  async function handleGenerateContent() {
    setGenerating(true);
    setError(null);
    try {
      // Build payload with attributes for each item
      const payload = items.map((item) => {
        const p = item.products;
        const attrs = p?.product_attributes?.[0];
        return {
          role: item.role,
          name: p?.name ?? "Unknown",
          category: p?.category ?? "unknown",
          attributes: attrs
            ? {
                clothing_type: attrs.clothing_type,
                formality: attrs.formality,
                season: attrs.season,
                dominant_colors: attrs.dominant_colors,
                style_tags: attrs.style_tags,
              }
            : null,
        };
      });

      const res = await fetch("/api/outfit-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });

      if (!res.ok) {
        throw new Error("Content generation failed");
      }

      const { content: aiContent, fallback } = await res.json();

      // Save to DB
      const supabase = createClient();
      const saved = await insertOutfitContent(supabase, {
        outfit_id: outfit.id,
        description: aiContent.description,
        styling_tips: Array.isArray(aiContent.styling_tips)
          ? aiContent.styling_tips.join("\n")
          : aiContent.styling_tips,
        social_caption: aiContent.social_caption,
      });

      setContent(saved);
      setIsFallback(!!fallback);
    } catch {
      setError("Could not generate content. Please try again later.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport() {
    if (!exportRef.current || !content) return;
    setExporting(true);
    setError(null);
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${(outfit.title ?? "outfit").replace(/\s+/g, "-").toLowerCase()}-modamind.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("Could not export the card. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div>
          <h3 className="font-semibold">
            {outfit.title ?? "Untitled Outfit"}
          </h3>
          {outfit.theme_name && (
            <Badge variant="secondary" className="mt-1">
              {outfit.theme_name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {content && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              {exporting ? "Exporting..." : "Export Card"}
            </Button>
          )}
          {!content && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateContent}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {generating ? "Generating..." : "Generate Content"}
            </Button>
          )}
        </div>
      </div>

      {/* Product thumbnails */}
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {items.map((item) => {
          const product = item.products;
          return (
            <div key={item.id} className="bg-background p-2">
              {product?.image_url ? (
                <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                  <Image
                    src={product.image_url}
                    alt={product?.name ?? ""}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                </div>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted/50">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="mt-1.5 space-y-0.5">
                <p className="text-xs font-medium leading-tight line-clamp-1">
                  {product?.name}
                </p>
                <p className="text-[10px] capitalize text-muted-foreground">
                  {item.role}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI content */}
      {content && (
        <div className="space-y-3 border-t px-4 py-4">
          {isFallback && (
            <p className="text-[11px] italic text-muted-foreground">
              Generated with fallback content
            </p>
          )}

          {/* Description */}
          {content.description && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Type className="h-3 w-3" />
                Description
              </p>
              <p className="text-sm leading-relaxed">{content.description}</p>
            </div>
          )}

          {/* Styling tips */}
          {content.styling_tips && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Styling Tips
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {content.styling_tips.split("\n").map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Social caption */}
          {content.social_caption && (
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Instagram Caption
              </p>
              <p className="text-sm italic">{content.social_caption}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-t px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>

    {/* Off-screen exportable card for image capture */}
    {content && (
      <div
        style={{ position: "fixed", left: "-9999px", top: 0 }}
        aria-hidden="true"
      >
        <ExportableOutfitCard
          ref={exportRef}
          outfit={outfit}
          content={content}
        />
      </div>
    )}
    </>
  );
}
