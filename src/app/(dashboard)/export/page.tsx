"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Shirt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getProducts, getOutfits } from "@/lib/supabase/queries";
import type {
  ProductWithAttributes,
  OutfitWithDetails,
} from "@/lib/supabase/types";

// ── Download helpers ──────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, filename);
}

function escapeCsv(value: unknown): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadProductsCsv(products: ProductWithAttributes[]) {
  const headers = [
    "name",
    "category",
    "price",
    "image_url",
    "clothing_type",
    "dominant_colors",
    "pattern",
    "formality",
    "season",
    "style_tags",
  ];

  const rows = products.map((p) => {
    const a = p.product_attributes?.[0];
    return [
      escapeCsv(p.name),
      escapeCsv(p.category),
      escapeCsv(p.price),
      escapeCsv(p.image_url),
      escapeCsv(a?.clothing_type),
      escapeCsv(
        a?.dominant_colors
          ? (a.dominant_colors as string[]).join("; ")
          : ""
      ),
      escapeCsv(a?.pattern),
      escapeCsv(a?.formality),
      escapeCsv(a?.season),
      escapeCsv(
        a?.style_tags ? (a.style_tags as string[]).join("; ") : ""
      ),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  downloadBlob(blob, "modamind-products.csv");
}

// ── Page ──────────────────────────────────────────────────

export default function ExportPage() {
  const [products, setProducts] = useState<ProductWithAttributes[]>([]);
  const [outfits, setOutfits] = useState<OutfitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [prods, fits] = await Promise.all([
        getProducts(supabase),
        getOutfits(supabase),
      ]);
      setProducts(prods);
      setOutfits(fits);
    } catch (err) {
      console.error("Export fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exports = [
    {
      title: "Products as JSON",
      description: `Export all ${products.length} products with AI attributes as a JSON file.`,
      icon: FileJson,
      disabled: products.length === 0,
      onClick: () => downloadJson(products, "modamind-products.json"),
    },
    {
      title: "Products as CSV",
      description: `Export all ${products.length} products as a CSV spreadsheet.`,
      icon: FileSpreadsheet,
      disabled: products.length === 0,
      onClick: () => downloadProductsCsv(products),
    },
    {
      title: "Outfits as JSON",
      description: `Export all ${outfits.length} outfits with items and AI content as a JSON file.`,
      icon: Shirt,
      disabled: outfits.length === 0,
      onClick: () => downloadJson(outfits, "modamind-outfits.json"),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Export</h2>
        <p className="text-muted-foreground">
          Export your data and generated content.
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exports.map((item) => (
            <div
              key={item.title}
              className="flex flex-col justify-between rounded-xl border bg-card p-5 shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">{item.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                disabled={item.disabled}
                onClick={item.onClick}
              >
                <Download className="mr-2 h-4 w-4" />
                {item.disabled ? "No data to export" : "Download"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
