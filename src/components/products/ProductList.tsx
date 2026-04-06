"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "./ProductCard";
import { AddProductDialog } from "./AddProductDialog";
import { createClient } from "@/lib/supabase/client";
import { getProducts } from "@/lib/supabase/queries";
import type { ProductWithAttributes } from "@/lib/supabase/types";

export function ProductList() {
  const [products, setProducts] = useState<ProductWithAttributes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const data = await getProducts(supabase);
      setProducts(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load products";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchProducts}>
          Retry
        </Button>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────
  if (products.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed">
        <PackageOpen className="h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No products yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Start by adding your first product to the catalog.
        </p>
        <div className="mt-4">
          <AddProductDialog onProductAdded={fetchProducts} />
        </div>
      </div>
    );
  }

  // ── Grid ─────────────────────────────────────────────────
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
