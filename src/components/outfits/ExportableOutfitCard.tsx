/* eslint-disable @next/next/no-img-element */
"use client";

import { forwardRef } from "react";
import type { OutfitContent, OutfitWithDetails } from "@/lib/supabase/types";
import type { ExportLayout } from "@/lib/outfits/export-formats";

interface BrandKit {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  /** Store / business name shown next to the logo in the header lockup. */
  businessName?: string | null;
}

interface ExportableOutfitCardProps {
  outfit: OutfitWithDetails;
  content: OutfitContent;
  modelUrl?: string | null;
  width: number;
  /** Minimum card height. Square/story formats use it to keep their aspect
   * ratio; the default layout ignores it and sizes to its content. */
  height: number;
  layout: ExportLayout;
  /** Premium-only: replaces the default Fashnix branding strip and
   * accent color with the outfit owner's own logo/colors. */
  brandKit?: BrandKit | null;
}

const AR_LABELS = {
  description: "الوصف",
  stylingTips: "نصائح التنسيق",
  caption: "التعليق",
  tiktok: "تعليق تيك توك",
  instagram: "تعليق إنستغرام",
};

/** Picks black/white text for legibility on a hex background. */
function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a2e" : "#ffffff";
}

export const ExportableOutfitCard = forwardRef<
  HTMLDivElement,
  ExportableOutfitCardProps
>(function ExportableOutfitCard(
  { outfit, content, width, height, layout, brandKit },
  ref
) {
  const items = outfit.outfit_items ?? [];
  const isRtl = content.language === "ar";
  const isStory = layout === "story";
  const hasBrand = !!(brandKit?.logoUrl || brandKit?.businessName);
  const accentColor = brandKit?.primaryColor || "#7c3aed";
  const secondary = brandKit?.secondaryColor || "#7c3aed";
  const backgroundGradient = brandKit?.secondaryColor
    ? `linear-gradient(135deg, #ffffff 0%, #ffffff 50%, ${brandKit.secondaryColor}33 100%)`
    : "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 50%, #ede9fe 100%)";

  // Scale factors based on format
  const scale = width / 1080; // base design is 1080
  // Story canvas is tall — bump type so its content fills the space.
  const boost = isStory ? 1.25 : 1;
  const pad = Math.round(36 * scale);
  const titleSize = Math.round(layout === "story" ? 32 : 30) * scale;
  const badgeSize = Math.round(13 * scale);
  const labelSize = Math.round(11 * scale * boost);
  const bodySize = Math.round(14 * scale * boost);
  const captionSize = Math.round(13 * scale * boost);
  const tipSize = Math.round(13 * scale * boost);
  const brandSize = Math.round(18 * scale);
  const brandSubSize = Math.round(11 * scale);

  // Grid columns: story = 2 cols, square = up to 4, default = up to 4
  const cols = isStory ? 2 : Math.max(1, Math.min(items.length, 4));

  const productPad = Math.round(8 * scale);
  const productRadius = Math.round(8 * scale);
  const gap = Math.round(12 * scale);

  const labelStyle = {
    fontSize: labelSize,
    fontWeight: 700,
    // Uppercase / letter-spacing have no meaning in Arabic and break joining.
    textTransform: isRtl ? ("none" as const) : ("uppercase" as const),
    letterSpacing: isRtl ? "normal" : "0.05em",
    color: accentColor,
    margin: `0 0 ${Math.round(6 * scale)}px`,
  };

  const captionLabel = isRtl
    ? content.format === "tiktok"
      ? AR_LABELS.tiktok
      : content.format === "generic"
        ? AR_LABELS.caption
        : AR_LABELS.instagram
    : content.format === "tiktok"
      ? "TikTok Caption"
      : content.format === "generic"
        ? "Caption"
        : "Instagram Caption";

  const headerText = hasBrand ? readableTextOn(accentColor) : "#1a1a2e";

  return (
    <div
      ref={ref}
      style={{
        width,
        // Story/square keep their aspect ratio; default sizes to content.
        minHeight: layout === "default" ? undefined : height,
        padding: `0 0 ${pad}px`,
        backgroundImage: `radial-gradient(${secondary}26 ${Math.max(1, Math.round(2 * scale))}px, transparent ${Math.max(1, Math.round(2 * scale))}px), ${backgroundGradient}`,
        backgroundSize: `${Math.round(24 * scale)}px ${Math.round(24 * scale)}px, auto`,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Header — brand lockup band when a brand kit is set */}
      <div
        style={{
          padding: `${pad}px ${pad}px ${Math.round(16 * scale)}px`,
          marginBottom: Math.round(16 * scale),
          flexShrink: 0,
          ...(hasBrand
            ? { background: accentColor, color: headerText }
            : {}),
        }}
      >
        {hasBrand && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: Math.round(14 * scale),
              marginBottom: Math.round(14 * scale),
              paddingBottom: Math.round(14 * scale),
              borderBottom: `${Math.max(1, Math.round(1 * scale))}px solid ${headerText}33`,
            }}
          >
            {brandKit?.logoUrl && (
              <img
                src={brandKit.logoUrl}
                alt="Brand logo"
                crossOrigin="anonymous"
                style={{
                  height: Math.round(64 * scale),
                  maxWidth: Math.round(220 * scale),
                  objectFit: "contain",
                }}
              />
            )}
            {brandKit?.businessName && (
              <span
                style={{
                  fontSize: Math.round(22 * scale),
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                {brandKit.businessName}
              </span>
            )}
          </div>
        )}
        <h2
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {outfit.title ?? "Untitled Outfit"}
        </h2>
        {outfit.theme_name && (
          <span
            style={{
              display: "inline-block",
              marginTop: Math.round(6 * scale),
              padding: `${Math.round(4 * scale)}px ${Math.round(12 * scale)}px`,
              background: hasBrand ? headerText : accentColor,
              color: hasBrand ? accentColor : "#fff",
              borderRadius: 9999,
              fontSize: badgeSize,
              fontWeight: 600,
            }}
          >
            {outfit.theme_name}
          </span>
        )}
      </div>

      <div
        style={{
          padding: `0 ${pad}px`,
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        {/* Product grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap,
            marginBottom: Math.round(16 * scale),
            flexShrink: 0,
          }}
        >
          {items.map((item) => {
            const product = item.products;
            return (
              <div
                key={item.id}
                style={{
                  background: "#fff",
                  borderRadius: Math.round(10 * scale),
                  padding: productPad,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                {product?.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name ?? ""}
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      objectFit: "cover",
                      borderRadius: productRadius,
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      background: "#f3f4f6",
                      borderRadius: productRadius,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#9ca3af",
                      fontSize: bodySize,
                    }}
                  >
                    No image
                  </div>
                )}
                <p
                  style={{
                    margin: `${Math.round(6 * scale)}px 0 ${Math.round(2 * scale)}px`,
                    fontSize: captionSize,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {product?.name}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: Math.round(10 * scale),
                    color: "#6b7280",
                    textTransform: "capitalize",
                  }}
                >
                  {item.role}
                </p>
              </div>
            );
          })}
        </div>

        {/* AI Content — sized to its content; only the story canvas stretches it */}
        <div
          dir={isRtl ? "rtl" : "ltr"}
          style={{
            background: "#fff",
            borderRadius: Math.round(12 * scale),
            padding: Math.round(20 * scale),
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            textAlign: isRtl ? "right" : "left",
            display: "flex",
            flexDirection: "column",
            ...(isStory ? { flex: 1, justifyContent: "center" } : {}),
          }}
        >
          {content.description && (
            <div style={{ marginBottom: Math.round(14 * scale) }}>
              <p style={labelStyle}>
                {isRtl ? AR_LABELS.description : "Description"}
              </p>
              <p
                style={{
                  fontSize: bodySize,
                  lineHeight: 1.5,
                  margin: 0,
                  color: "#374151",
                }}
              >
                {content.description}
              </p>
            </div>
          )}

          {content.styling_tips && (
            <div style={{ marginBottom: Math.round(14 * scale) }}>
              <p style={labelStyle}>
                {isRtl ? AR_LABELS.stylingTips : "Styling Tips"}
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingInlineStart: Math.round(18 * scale),
                  color: "#374151",
                }}
              >
                {content.styling_tips.split("\n").map((tip, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: tipSize,
                      lineHeight: 1.5,
                      marginBottom: Math.round(2 * scale),
                    }}
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.social_caption && (
            <div
              style={{
                background: hasBrand ? `${secondary}22` : "#f5f3ff",
                borderRadius: Math.round(10 * scale),
                padding: Math.round(14 * scale),
              }}
            >
              <p style={labelStyle}>{captionLabel}</p>
              <p
                style={{
                  fontSize: captionSize,
                  fontStyle: isRtl ? "normal" : "italic",
                  lineHeight: 1.5,
                  margin: 0,
                  color: "#374151",
                }}
              >
                {content.social_caption}
              </p>
            </div>
          )}
        </div>

        {/* Footer — default Fashnix strip; brand-kit cards are branded in the header */}
        {!hasBrand && (
          <div
            style={{
              marginTop: "auto",
              paddingTop: Math.round(16 * scale),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: Math.round(6 * scale),
              flexShrink: 0,
            }}
          >
            <span
              style={{ fontSize: brandSize, fontWeight: 700, color: accentColor }}
            >
              Fashnix
            </span>
            <span style={{ fontSize: brandSubSize, color: "#9ca3af" }}>
              AI-Powered Fashion Intelligence
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
