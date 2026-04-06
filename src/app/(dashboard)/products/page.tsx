"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertCircle, PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddProductDialog } from "@/components/products/AddProductDialog";
import { ProductCard } from "@/components/products/ProductCard";
import { createClient } from "@/lib/supabase/client";
import { getProducts } from "@/lib/supabase/queries";
import type { ProductWithAttributes } from "@/lib/supabase/types";

export default function ProductsPage() {
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{products.length}</Badge>
            product{products.length !== 1 && "s"} in catalog
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
