/* eslint-disable @next/next/no-img-element */
"use client";

import { forwardRef } from "react";
import type { OutfitContent, OutfitWithDetails } from "@/lib/supabase/types";

interface ExportableOutfitCardProps {
  outfit: OutfitWithDetails;
  content: OutfitContent;
}

export const ExportableOutfitCard = forwardRef<
  HTMLDivElement,
  ExportableOutfitCardProps
>(function ExportableOutfitCard({ outfit, content }, ref) {
  const items = outfit.outfit_items ?? [];

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        padding: 48,
        background:
          "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 50%, #ede9fe 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a2e",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, margin: 0 }}>
          {outfit.title ?? "Untitled Outfit"}
        </h2>
        {outfit.theme_name && (
          <span
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "5px 14px",
              background: "#7c3aed",
              color: "#fff",
              borderRadius: 9999,
              fontSize: 14,
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
          gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
          gap: 16,
          marginBottom: 32,
        }}
      >
        {items.map((item) => {
          const product = item.products;
          return (
            <div
              key={item.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 12,
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
                    borderRadius: 8,
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    background: "#f3f4f6",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9ca3af",
                    fontSize: 14,
                  }}
                >
                  No image
                </div>
              )}
              <p
                style={{
                  margin: "8px 0 2px",
                  fontSize: 14,
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
                  fontSize: 12,
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

      {/* AI Content */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        {content.description && (
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#7c3aed",
                margin: "0 0 8px",
              }}
            >
              Description
            </p>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.6,
                margin: 0,
                color: "#374151",
              }}
            >
              {content.description}
            </p>
          </div>
        )}

        {content.styling_tips && (
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#7c3aed",
                margin: "0 0 8px",
              }}
            >
              Styling Tips
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#374151" }}>
              {content.styling_tips.split("\n").map((tip, i) => (
                <li
                  key={i}
                  style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 4 }}
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
              borderRadius: 12,
              padding: 20,
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#7c3aed",
                margin: "0 0 8px",
              }}
            >
              Instagram Caption
            </p>
            <p
              style={{
                fontSize: 15,
                fontStyle: "italic",
                lineHeight: 1.6,
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
          marginTop: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 700, color: "#7c3aed" }}>
          Fashnix
        </span>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>
          AI-Powered Fashion Intelligence
        </span>
      </div>
    </div>
  );
});
