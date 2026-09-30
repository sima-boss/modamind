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
  RefreshCw,
  Share2,
  ShoppingBag,
  Sparkles,
  Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { deleteOutfitContent, insertOutfitContent } from "@/lib/supabase/queries";
import type { OutfitContent, OutfitWithDetails, Plan, Profile } from "@/lib/supabase/types";
import {
  canUseCaptionFormat,
  canUseCaptionLanguage,
  type CaptionFormat,
  type CaptionLanguage,
} from "@/lib/plan-gate";
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

const CAPTION_HEADING: Record<CaptionFormat, string> = {
  generic: "Caption",
  instagram: "Instagram Caption",
  tiktok: "TikTok Caption",
};

interface OutfitCardProps {
  outfit: OutfitWithDetails;
  /** Caller's current plan — drives caption language/format + brand kit
   * gating. Null while the subscription is still loading. */
  plan: Plan | null;
  /** Caller's profile — supplies brand kit assets for Premium exports. */
  profile: Profile | null;
}

export function OutfitCard({ outfit, plan, profile }: OutfitCardProps) {
  const items = outfit.outfit_items ?? [];
  const existingContent = outfit.outfit_content?.[0] ?? null;
  const [content, setContent] = useState<OutfitContent | null>(existingContent);
  const [isFallback, setIsFallback] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMoodBoard, setShowMoodBoard] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formatId, setFormatId] = useState(DEFAULT_EXPORT_FORMAT.id);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [language, setLanguage] = useState<CaptionLanguage>(
    (existingContent?.language as CaptionLanguage) ?? "en"
  );
  const [captionFormat, setCaptionFormat] = useState<CaptionFormat>(
    (existingContent?.format as CaptionFormat) ?? "generic"
  );
  const exportRef = useRef<HTMLDivElement>(null);

  const canArabic = plan ? canUseCaptionLanguage(plan, "ar") : false;
  const canInstagram = plan ? canUseCaptionFormat(plan, "instagram") : false;
  const canTiktok = plan ? canUseCaptionFormat(plan, "tiktok") : false;
  const canBrandKit = plan?.has_brand_kit ?? false;
  const hasBrandAssets =
    canBrandKit &&
    !!profile &&
    (!!profile.brand_logo_url || !!profile.brand_primary_color);

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
        body: JSON.stringify({ items: payload, language, format: captionFormat }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) {
          if (body.error?.includes("captions for this period")) {
            setShowTopUpModal(true);
          }
          throw new Error(
            body.error ??
              "You've used all your AI captions for this period."
          );
        }
        throw new Error("Content generation failed");
      }

      const { content: aiContent, fallback } = await res.json();

      // Save to DB — an outfit only ever keeps one active content row,
      // so regenerating (possibly with a different language/format)
      // replaces whatever was there before.
      const supabase = createClient();
      await deleteOutfitContent(supabase, outfit.id);
      const saved = await insertOutfitContent(supabase, {
        outfit_id: outfit.id,
        description: aiContent.description,
        styling_tips: Array.isArray(aiContent.styling_tips)
          ? aiContent.styling_tips.join("\n")
          : aiContent.styling_tips,
        social_caption: aiContent.social_caption,
        language,
        format: captionFormat,
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
        // Default layout sizes to its content; measure the rendered height.
        height: exportRef.current.offsetHeight,
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

      {/* Caption options */}
      <div className="flex flex-wrap items-end gap-3 border-t px-4 py-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Language
          </label>
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value as CaptionLanguage)}
            className="h-8 w-[150px] text-xs"
            aria-label="Caption language"
          >
            <option value="en">English</option>
            <option value="ar" disabled={!canArabic}>
              Arabic (Gulf) {canArabic ? "" : "🔒"}
            </option>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Format
          </label>
          <Select
            value={captionFormat}
            onChange={(e) => setCaptionFormat(e.target.value as CaptionFormat)}
            className="h-8 w-[150px] text-xs"
            aria-label="Caption format"
          >
            <option value="generic">Generic</option>
            <option value="instagram" disabled={!canInstagram}>
              Instagram {canInstagram ? "" : "🔒"}
            </option>
            <option value="tiktok" disabled={!canTiktok}>
              TikTok {canTiktok ? "" : "🔒"}
            </option>
          </Select>
        </div>

        {(!canArabic || !canInstagram || !canTiktok) && (
          <Link
            href="/billing"
            className="mb-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Unlock Arabic &amp; Instagram/TikTok captions →
          </Link>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateContent}
          disabled={generating}
          className="ml-auto"
        >
          {generating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : content ? (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          {generating ? "Generating..." : content ? "Regenerate" : "Generate Content"}
        </Button>
      </div>

      {/* AI content */}
      {content && (
        <div
          className="space-y-3 border-t px-4 py-4"
          dir={content.language === "ar" ? "rtl" : "ltr"}
        >
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
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {CAPTION_HEADING[(content.format as CaptionFormat) ?? "generic"]}
                {content.language === "ar" && (
                  <Badge variant="secondary" className="text-[10px]">
                    AR
                  </Badge>
                )}
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
          {(error.includes("AI captions") || error.includes("Upgrade")) && (
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
          brandKit={
            hasBrandAssets
              ? {
                  logoUrl: profile!.brand_logo_url,
                  primaryColor: profile!.brand_primary_color,
                  secondaryColor: profile!.brand_secondary_color,
                  businessName: profile!.business_name,
                }
              : null
          }
        />
      </div>
    )}

    <TopUpModal open={showTopUpModal} onOpenChange={setShowTopUpModal} />
    </>
  );
}
