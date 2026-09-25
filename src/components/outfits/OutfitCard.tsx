"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toPng } from "html-to-image";
import {
  Check,
  Download,
  Layout,
  Loader2,
  Share2,
  ShoppingBag,
  Sparkles,
  Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { insertOutfitContent } from "@/lib/supabase/queries";
import type { OutfitContent, OutfitWithDetails } from "@/lib/supabase/types";
import {
  getThemeGradient,
  getThemeTextColor,
} from "@/lib/outfits/virtual-model";
import {
  EXPORT_FORMATS,
  DEFAULT_EXPORT_FORMAT,
  getExportFormat,
} from "@/lib/outfits/export-formats";
import { ExportableOutfitCard } from "./ExportableOutfitCard";
import { TopUpModal } from "@/components/billing/TopUpModal";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/events";

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
  const [showMoodBoard, setShowMoodBoard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formatId, setFormatId] = useState(DEFAULT_EXPORT_FORMAT.id);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
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
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setShowTopUpModal(true);
          throw new Error(
            body.error ??
              "You've used all your AI captions for this period."
          );
        }
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
      window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED_EVENT));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate content. Please try again later."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport() {
    if (!exportRef.current || !content) return;
    setExporting(true);
    setError(null);
    try {
      const format = getExportFormat(formatId);
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        width: format.width,
        height: format.height,
      });
      const link = document.createElement("a");
      const slug = (outfit.title ?? "outfit").replace(/\s+/g, "-").toLowerCase();
      link.download = `${slug}-${format.id}-fashnix.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("Could not export the card. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function handleToggleMoodBoard() {
    setShowMoodBoard((prev) => !prev);
  }

  async function handleShare() {
    setError(null);
    try {
      const url = `${window.location.origin}/lookbook/${outfit.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the share link.");
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Mood-board layout helpers                                        */
  /* ---------------------------------------------------------------- */

  const gradient = getThemeGradient(outfit.theme_name);
  const textColor = getThemeTextColor(outfit.theme_name);

  // Separate items with images from those without
  const withImages = items.filter((i) => i.products?.image_url);
  const heroItem = withImages[0];
  const sideItems = withImages.slice(1);

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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant={showMoodBoard ? "default" : "outline"}
            size="sm"
            onClick={handleToggleMoodBoard}
          >
            <Layout className="mr-1.5 h-3.5 w-3.5" />
            Mood Board
          </Button>

          <Button variant="outline" size="sm" onClick={handleShare}>
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Share"}
          </Button>

          {content && (
            <div className="flex items-center gap-1.5">
              <Select
                value={formatId}
                onChange={(e) => setFormatId(e.target.value)}
                className="h-8 w-[150px] text-xs"
                aria-label="Export format"
              >
                {EXPORT_FORMATS.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </Select>
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
                {exporting ? "Exporting..." : "Export"}
              </Button>
            </div>
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

      {/* ── Mood board collage ── */}
      {showMoodBoard && (
        <div className="border-t px-4 py-4">
          <div
            className="relative mx-auto max-w-md overflow-hidden rounded-xl shadow-lg"
            style={{ background: gradient }}
          >
            {/* Title overlay */}
            <div className="px-5 pt-5 pb-3" style={{ color: textColor }}>
              <p className="text-lg font-bold leading-tight">
                {outfit.title ?? "Outfit"}
              </p>
              {outfit.theme_name && (
                <p className="mt-0.5 text-xs font-medium opacity-80">
                  {outfit.theme_name}
                </p>
              )}
            </div>

            {/* Collage grid */}
            {withImages.length > 0 && (
              <div className="px-3 pb-4">
                {withImages.length === 1 ? (
                  /* Single product — centred large */
                  <div className="relative mx-auto aspect-square w-3/4 overflow-hidden rounded-lg shadow-md">
                    <Image
                      src={heroItem!.products!.image_url!}
                      alt={heroItem!.products?.name ?? ""}
                      fill
                      className="object-cover"
                      sizes="300px"
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                      style={{
                        background:
                          "linear-gradient(transparent, rgba(0,0,0,0.6))",
                      }}
                    >
                      <p className="text-xs font-medium text-white truncate">
                        {heroItem!.products?.name}
                      </p>
                    </div>
                  </div>
                ) : withImages.length === 2 ? (
                  /* Two products side by side */
                  <div className="grid grid-cols-2 gap-2">
                    {withImages.map((item) => (
                      <div
                        key={item.id}
                        className="relative aspect-square overflow-hidden rounded-lg shadow-md"
                      >
                        <Image
                          src={item.products!.image_url!}
                          alt={item.products?.name ?? ""}
                          fill
                          className="object-cover"
                          sizes="200px"
                        />
                        <div
                          className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                          style={{
                            background:
                              "linear-gradient(transparent, rgba(0,0,0,0.6))",
                          }}
                        >
                          <p className="text-[10px] font-medium text-white truncate">
                            {item.products?.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* 3+ products — hero on left, stack on right */
                  <div className="grid grid-cols-5 gap-2">
                    {/* Hero image — takes 3/5 columns */}
                    <div className="col-span-3 relative aspect-[3/4] overflow-hidden rounded-lg shadow-md">
                      <Image
                        src={heroItem!.products!.image_url!}
                        alt={heroItem!.products?.name ?? ""}
                        fill
                        className="object-cover"
                        sizes="300px"
                      />
                      <div
                        className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                        style={{
                          background:
                            "linear-gradient(transparent, rgba(0,0,0,0.6))",
                        }}
                      >
                        <p className="text-xs font-medium text-white truncate">
                          {heroItem!.products?.name}
                        </p>
                        <p className="text-[10px] capitalize text-white/70">
                          {heroItem!.role}
                        </p>
                      </div>
                    </div>

                    {/* Side stack — 2/5 columns */}
                    <div className="col-span-2 flex flex-col gap-2">
                      {sideItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="relative aspect-square overflow-hidden rounded-lg shadow-md"
                        >
                          <Image
                            src={item.products!.image_url!}
                            alt={item.products?.name ?? ""}
                            fill
                            className="object-cover"
                            sizes="150px"
                          />
                          <div
                            className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                            style={{
                              background:
                                "linear-gradient(transparent, rgba(0,0,0,0.6))",
                            }}
                          >
                            <p className="text-[10px] font-medium text-white truncate">
                              {item.products?.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Branding strip */}
            <div
              className="flex items-center justify-center gap-1 pb-3"
              style={{ color: textColor }}
            >
              <Sparkles className="h-3 w-3 opacity-70" />
              <span className="text-[10px] font-medium opacity-70">
                Styled with Fashnix
              </span>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] italic text-muted-foreground">
            Outfit mood board • Product images from your catalog
          </p>
        </div>
      )}

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
          {error.includes("AI captions") && (
            <>
              {" "}
              <Link href="/billing" className="font-medium underline-offset-4 hover:underline">
                Go to Billing
              </Link>
            </>
          )}
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
          modelUrl={null}
          width={getExportFormat(formatId).width}
          height={getExportFormat(formatId).height}
          layout={getExportFormat(formatId).layout}
        />
      </div>
    )}

    <TopUpModal open={showTopUpModal} onOpenChange={setShowTopUpModal} />
    </>
  );
}
