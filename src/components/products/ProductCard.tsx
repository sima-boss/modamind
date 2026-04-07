"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Pencil, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { deleteProduct, insertProductAttributes } from "@/lib/supabase/queries";
import type { ProductWithAttributes } from "@/lib/supabase/types";
import { EditProductDialog } from "./EditProductDialog";

interface ProductCardProps {
  product: ProductWithAttributes;
  onProductChanged: () => void;
}

export function ProductCard({ product, onProductChanged }: ProductCardProps) {
  const attrs = product.product_attributes?.[0];
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      const supabase = createClient();
      await deleteProduct(supabase, product.id);
      onProductChanged();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAnalyze() {
    if (!product.image_url) return;
    setAnalyzing(true);
    setAnalyzeMsg(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: product.image_url }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const { attributes } = await res.json();
      const supabase = createClient();
      await insertProductAttributes(supabase, {
        product_id: product.id,
        dominant_colors: attributes.dominant_colors,
        pattern: attributes.pattern,
        formality: attributes.formality,
        style_tags: attributes.style_tags,
        season: attributes.season,
        clothing_type: attributes.clothing_type,
        raw_ai_json: attributes,
      });
      setAnalyzeMsg("Analysis complete!");
      onProductChanged();
    } catch {
      setAnalyzeMsg("Analysis failed. Try again later.");
    } finally {
      setAnalyzing(false);
    }
  }

  const showAnalyze = !attrs && !!product.image_url;

  return (
    <>
      <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
        {/* Image */}
        {product.image_url ? (
          <div className="relative h-48 w-full">
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center bg-muted/50">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Info */}
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium leading-tight line-clamp-2">
              {product.name}
            </h3>
            <span className="shrink-0 font-semibold">
              ${Number(product.price).toFixed(2)}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {product.category}
            </Badge>
            {attrs?.clothing_type && (
              <Badge variant="outline" className="capitalize">
                {attrs.clothing_type}
              </Badge>
            )}
          </div>

          {/* AI attributes */}
          {attrs && (
            <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
              {attrs.dominant_colors && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Colors:</span>
                  <div className="flex flex-wrap gap-1">
                    {(attrs.dominant_colors as string[]).map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-muted px-2 py-0.5 capitalize"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {attrs.pattern && (
                  <span>
                    <span className="font-medium text-foreground">
                      Pattern:
                    </span>{" "}
                    {attrs.pattern}
                  </span>
                )}
                {attrs.formality && (
                  <span>
                    <span className="font-medium text-foreground">
                      Formality:
                    </span>{" "}
                    {attrs.formality}
                  </span>
                )}
                {attrs.season && (
                  <span>
                    <span className="font-medium text-foreground">
                      Season:
                    </span>{" "}
                    {attrs.season}
                  </span>
                )}
              </div>

              {attrs.style_tags && (
                <div className="flex flex-wrap gap-1">
                  {(attrs.style_tags as string[]).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-primary capitalize"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No-attributes notice */}
          {showAnalyze && !analyzeMsg && (
            <p className="text-xs italic text-muted-foreground">
              No AI attributes yet. Click Re-analyze below.
            </p>
          )}

          {/* Analyze feedback */}
          {analyzeMsg && (
            <p
              className={`text-xs font-medium ${
                analyzeMsg.includes("complete")
                  ? "text-green-600"
                  : "text-destructive"
              }`}
            >
              {analyzeMsg}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t px-4 py-2.5">
          {showAnalyze && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex-1"
            >
              {analyzing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {analyzing ? "Analyzing..." : "Re-analyze"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="flex-1"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 text-destructive hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <EditProductDialog
        product={product}
        open={editOpen}
        onOpenChange={setEditOpen}
        onProductUpdated={onProductChanged}
      />
    </>
  );
}
