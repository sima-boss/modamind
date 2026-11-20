"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, ShoppingBag, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/BrandMark";
import type { OutfitWithDetails } from "@/lib/supabase/types";

type LoadError = "not_found" | "failed";

function LookbookUnavailable({ reason }: { reason: LoadError }) {
  const notFound = reason === "not_found";
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <BrandMark className="justify-center" />
        <h1 className="mt-6 text-xl font-semibold">
          {notFound
            ? "This lookbook is no longer available"
            : "We couldn't load this lookbook"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {notFound
            ? "It may have been removed by its owner."
            : "Please try again in a moment."}
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Go to Fashnix home</Link>
        </Button>
      </div>
    </div>
  );
}

interface LookbookViewProps {
  id: string;
}

export function LookbookView({ id }: LookbookViewProps) {
  const [outfit, setOutfit] = useState<OutfitWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/outfits/${id}`);
        if (!res.ok) {
          if (active) setError(res.status === 404 ? "not_found" : "failed");
          return;
        }
        const { outfit: data } = await res.json();
        if (active) {
          if (data) setOutfit(data);
          else setError("not_found");
        }
      } catch {
        if (active) setError("failed");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !outfit) {
    return <LookbookUnavailable reason={error ?? "not_found"} />;
  }

  const items = outfit.outfit_items ?? [];
  const content = outfit.outfit_content?.[0];

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Header */}
        <div className="border-b bg-muted/30 px-6 py-5">
          <h1 className="text-xl font-semibold">
            {outfit.title ?? "Untitled Outfit"}
          </h1>
          {outfit.theme_name && (
            <Badge variant="secondary" className="mt-2">
              {outfit.theme_name}
            </Badge>
          )}
        </div>

        {/* Product thumbnails */}
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {items.map((item) => {
            const product = item.products;
            return (
              <div key={item.id} className="bg-background p-2">
                {product?.image_url ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                    <Image
                      src={product.image_url}
                      alt={product?.name ?? ""}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted/50">
                    <ShoppingBag className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-xs font-medium leading-tight line-clamp-1">
                    {product?.name}
                  </p>
                  <p className="text-[10px] capitalize text-muted-foreground">
                    {item.role}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI content */}
        {content && (
          <div className="space-y-4 border-t px-6 py-5">
            {content.description && (
              <p className="text-sm leading-relaxed">{content.description}</p>
            )}

            {content.styling_tips && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Styling Tips
                </p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {content.styling_tips.split("\n").map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {content.social_caption && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Instagram Caption
                </p>
                <p className="text-sm italic">{content.social_caption}</p>
              </div>
            )}
          </div>
        )}

        {/* Branding footer */}
        <div className="flex items-center justify-center gap-1.5 border-t bg-muted/20 px-6 py-4">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">
            Styled with <span className="font-semibold text-primary">Fashnix</span>
          </span>
        </div>
      </div>
    </div>
  );
}
