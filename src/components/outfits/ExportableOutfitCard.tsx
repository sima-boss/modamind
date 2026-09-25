/* eslint-disable @next/next/no-img-element */
"use client";

import { forwardRef } from "react";
import type { OutfitContent, OutfitWithDetails } from "@/lib/supabase/types";
import type { ExportLayout } from "@/lib/outfits/export-formats";

interface ExportableOutfitCardProps {
  outfit: OutfitWithDetails;
  content: OutfitContent;
  modelUrl?: string | null;
  width: number;
  height: number;
  layout: ExportLayout;
}

export const ExportableOutfitCard = forwardRef<
  HTMLDivElement,
  ExportableOutfitCardProps
>(function ExportableOutfitCard({ outfit, content, width, height, layout }, ref) {
  const items = outfit.outfit_items ?? [];

  // Scale factors based on format
  const scale = width / 1080; // base design is 1080
  const pad = Math.round(36 * scale);
  const titleSize = Math.round(layout === "story" ? 32 : 30) * scale;
  const badgeSize = Math.round(13 * scale);
  const labelSize = Math.round(11 * scale);
  const bodySize = Math.round(14 * scale);
  const captionSize = Math.round(13 * scale);
  const tipSize = Math.round(13 * scale);
  const brandSize = Math.round(18 * scale);
  const brandSubSize = Math.round(11 * scale);

  // Grid columns: story = 2 cols, square = up to 4, default = up to 4
  const cols = layout === "story" ? 2 : Math.min(items.length, 4);

  // For story layout, use smaller product images to fit everything
  const productPad = Math.round(8 * scale);
  const productRadius = Math.round(8 * scale);
  const gap = Math.round(12 * scale);

  return (
    <div
      ref={ref}
      style={{
        width,
        height,
        padding: pad,
        background:
          "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 50%, #ede9fe 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a2e",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: Math.round(16 * scale), flexShrink: 0 }}>
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
              background: "#7c3aed",
              color: "#fff",
              borderRadius: 9999,
              fontSize: badgeSize,
              fontWeight: 600,
            }}
          >
            {outfit.theme_name}
          </span>
        )}
      </div>

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

      {/* AI Content — takes remaining space */}
      <div
        style={{
          background: "#fff",
          borderRadius: Math.round(12 * scale),
          padding: Math.round(20 * scale),
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {content.description && (
          <div style={{ marginBottom: Math.round(14 * scale) }}>
            <p
              style={{
                fontSize: labelSize,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#7c3aed",
                margin: `0 0 ${Math.round(6 * scale)}px`,
              }}
            >
              Description
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
            <p
              style={{
                fontSize: labelSize,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#7c3aed",
                margin: `0 0 ${Math.round(6 * scale)}px`,
              }}
            >
              Styling Tips
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: Math.round(16 * scale),
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
              background: "#f5f3ff",
              borderRadius: Math.round(10 * scale),
              padding: Math.round(14 * scale),
            }}
          >
            <p
              style={{
                fontSize: labelSize,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#7c3aed",
                margin: `0 0 ${Math.round(6 * scale)}px`,
              }}
            >
              Instagram Caption
            </p>
            <p
              style={{
                fontSize: captionSize,
                fontStyle: "italic",
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

      {/* Branding */}
      <div
        style={{
          marginTop: Math.round(16 * scale),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(6 * scale),
          flexShrink: 0,
        }}
      >
        <span
          style={{ fontSize: brandSize, fontWeight: 700, color: "#7c3aed" }}
        >
          Fashnix
        </span>
        <span style={{ fontSize: brandSubSize, color: "#9ca3af" }}>
          AI-Powered Fashion Intelligence
        </span>
      </div>
    </div>
  );
});
