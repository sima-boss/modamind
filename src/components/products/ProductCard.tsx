import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProductWithAttributes } from "@/lib/supabase/types";

interface ProductCardProps {
  product: ProductWithAttributes;
}

export function ProductCard({ product }: ProductCardProps) {
  const attrs = product.product_attributes?.[0];

  return (
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
                  <span className="font-medium text-foreground">Pattern:</span>{" "}
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
                  <span className="font-medium text-foreground">Season:</span>{" "}
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
      </div>
    </div>
  );
}
