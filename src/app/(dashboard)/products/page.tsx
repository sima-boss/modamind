"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, PackageOpen, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AddProductDialog } from "@/components/products/AddProductDialog";
import { ProductCard } from "@/components/products/ProductCard";
import { createClient } from "@/lib/supabase/client";
import { getProducts } from "@/lib/supabase/queries";
import type { ProductWithAttributes } from "@/lib/supabase/types";

function matchesSearch(p: ProductWithAttributes, query: string): boolean {
  const q = query.toLowerCase();
  if (p.name.toLowerCase().includes(q)) return true;
  if (p.category.toLowerCase().includes(q)) return true;
  const attrs = p.product_attributes?.[0];
  if (attrs?.clothing_type?.toLowerCase().includes(q)) return true;
  if (attrs?.style_tags && Array.isArray(attrs.style_tags)) {
    if ((attrs.style_tags as string[]).some((t) => t.toLowerCase().includes(q)))
      return true;
  }
  return false;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithAttributes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const filtered = search
    ? products.filter((p) => matchesSearch(p, search))
    : products;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            Manage your fashion product catalog.
          </p>
        </div>
        <AddProductDialog onProductAdded={fetchProducts} />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchProducts}>
            Retry
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed">
          <PackageOpen className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No products yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start by adding your first product to the catalog.
          </p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, category, or style tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{filtered.length}</Badge>
            {search
              ? `of ${products.length} product${products.length !== 1 ? "s" : ""}`
              : `product${filtered.length !== 1 ? "s" : ""} in catalog`}
          </div>

          {filtered.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              No products match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onProductChanged={fetchProducts}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
