"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Shirt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { BrandKitPanel } from "@/components/export/BrandKitPanel";
import { useSession } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentProfile,
  getCurrentSubscription,
  getOutfits,
  getProducts,
} from "@/lib/supabase/queries";
import { formatAED } from "@/lib/format";
import { canUseExportFormat } from "@/lib/plan-gate";
import type {
  ProductWithAttributes,
  OutfitWithDetails,
  Profile,
  SubscriptionWithPlan,
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
  downloadBlob(blob, "fashnix-products.csv");
}

function escapeHtml(value: unknown): string {
  const str = value == null ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "PDF export" via the browser's own print-to-PDF — opens a formatted,
 * print-styled summary and triggers the print dialog, where "Save as PDF"
 * produces a real PDF with no extra dependency. */
function openPdfExport(
  products: ProductWithAttributes[],
  outfits: OutfitWithDetails[]
) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;

  const productRows = products
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${escapeHtml(formatAED(Number(p.price)))}</td></tr>`
    )
    .join("");

  const outfitItems = outfits
    .map((o) => {
      const items = (o.outfit_items ?? [])
        .map((i) => escapeHtml(i.products?.name ?? ""))
        .filter(Boolean)
        .join(", ");
      return `<li><strong>${escapeHtml(o.title ?? "Untitled Outfit")}</strong>${o.theme_name ? ` — ${escapeHtml(o.theme_name)}` : ""}${items ? `<br /><span class="muted">${items}</span>` : ""}</li>`;
    })
    .join("");

  win.document.write(`<!doctype html>
<html>
<head>
<title>Fashnix Export</title>
<meta charset="utf-8" />
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a2e; padding: 32px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 32px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  .muted { color: #6b7280; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { color: #6b7280; font-weight: 600; text-transform: uppercase; font-size: 11px; }
  ul { padding-left: 18px; margin-top: 8px; }
  li { margin-bottom: 10px; font-size: 13px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>Fashnix Export</h1>
  <p class="muted">${escapeHtml(new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" }))}</p>

  <h2>Products (${products.length})</h2>
  <table>
    <thead><tr><th>Name</th><th>Category</th><th>Price</th></tr></thead>
    <tbody>${productRows || `<tr><td colspan="3" class="muted">No products</td></tr>`}</tbody>
  </table>

  <h2>Outfits (${outfits.length})</h2>
  <ul>${outfitItems || `<li class="muted">No outfits</li>`}</ul>
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

// ── Page ──────────────────────────────────────────────────

export default function ExportPage() {
  const { user } = useSession();
  const [products, setProducts] = useState<ProductWithAttributes[]>([]);
  const [outfits, setOutfits] = useState<OutfitWithDetails[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(
    null
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [prods, fits, sub, prof] = await Promise.all([
        getProducts(supabase),
        getOutfits(supabase),
        getCurrentSubscription(supabase),
        getCurrentProfile(supabase),
      ]);
      setProducts(prods);
      setOutfits(fits);
      setSubscription(sub);
      setProfile(prof);
    } catch (err) {
      console.error("Export fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const plan = subscription?.plan ?? null;
  const canCsv = plan ? canUseExportFormat(plan, "csv") : false;
  const canPdf = plan ? canUseExportFormat(plan, "pdf") : false;
  const canBrandKit = plan?.has_brand_kit ?? false;

  const exports = [
    {
      title: "Products as JSON",
      description: `Export all ${products.length} products with AI attributes as a JSON file.`,
      icon: FileJson,
      locked: false,
      disabled: products.length === 0,
      onClick: () => downloadJson(products, "fashnix-products.json"),
    },
    {
      title: "Products as CSV",
      description: `Export all ${products.length} products as a CSV spreadsheet.`,
      icon: FileSpreadsheet,
      locked: !canCsv,
      disabled: products.length === 0,
      onClick: () => downloadProductsCsv(products),
    },
    {
      title: "Outfits as JSON",
      description: `Export all ${outfits.length} outfits with items and AI content as a JSON file.`,
      icon: Shirt,
      locked: false,
      disabled: outfits.length === 0,
      onClick: () => downloadJson(outfits, "fashnix-outfits.json"),
    },
    {
      title: "Products & Outfits as PDF",
      description: "Export a printable PDF summary of your products and outfits.",
      icon: FileText,
      locked: !canPdf,
      disabled: products.length === 0 && outfits.length === 0,
      onClick: () => openPdfExport(products, outfits),
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
        <>
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
                {item.locked ? (
                  <LockedFeature label="Premium feature" className="mt-4" />
                ) : (
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    disabled={item.disabled}
                    onClick={item.onClick}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {item.disabled ? "No data to export" : "Download"}
                  </Button>
                )}
              </div>
            ))}
          </div>

          {user && (
            <BrandKitPanel
              profile={profile}
              userId={user.id}
              canUse={canBrandKit}
              onSaved={setProfile}
            />
          )}
        </>
      )}
    </div>
  );
}
