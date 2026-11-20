"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Search, Shirt, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { searchOutfits, searchProducts } from "@/lib/supabase/queries";
import {
  MIN_QUERY_LENGTH,
  RESULT_LIMIT,
  SEARCH_DEBOUNCE_MS,
  matchPages,
  toIlikePattern,
} from "@/lib/search";

interface ResultItem {
  key: string;
  label: string;
  sublabel?: string;
  href: string;
}

interface ResultGroup {
  title: string;
  icon: typeof Search;
  items: ResultItem[];
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const trimmed = query.trim();
  const active = trimmed.length >= MIN_QUERY_LENGTH;

  // Debounced search; stale responses are dropped via requestId.
  useEffect(() => {
    if (!active) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const pattern = toIlikePattern(trimmed);
      const [products, outfits] = await Promise.all([
        searchProducts(supabase, trimmed, pattern, RESULT_LIMIT).catch(() => []),
        searchOutfits(supabase, pattern, RESULT_LIMIT).catch(() => []),
      ]);
      if (id !== requestId.current) return;

      setGroups(
        [
          {
            title: "Products",
            icon: ShoppingBag,
            items: products.map((p) => ({
              key: `product-${p.id}`,
              label: p.name,
              sublabel: p.category,
              href: `/products?q=${encodeURIComponent(p.name)}`,
            })),
          },
          {
            title: "Outfits",
            icon: Shirt,
            items: outfits.map((o) => ({
              key: `outfit-${o.id}`,
              label: o.title ?? "Untitled Outfit",
              sublabel: o.theme_name ?? undefined,
              href: "/outfits",
            })),
          },
          {
            title: "Pages",
            icon: FileText,
            items: matchPages(trimmed).map((p) => ({
              key: `page-${p.href}`,
              label: p.label,
              href: p.href,
            })),
          },
        ].filter((g) => g.items.length > 0)
      );
      setLoading(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, active]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter") {
      const first = groups[0]?.items[0];
      if (first && !loading) go(first.href);
    }
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder="Search..."
        className="w-64 pl-9"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label="Search products, outfits and pages"
        aria-expanded={open && active}
        maxLength={100}
      />

      {open && active && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results</p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              {groups.map((group) => (
                <div key={group.title} className="py-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </p>
                  {group.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => go(item.href)}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-accent"
                    >
                      <group.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                      {item.sublabel && (
                        <span className="shrink-0 truncate text-xs capitalize text-muted-foreground">
                          {item.sublabel}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
