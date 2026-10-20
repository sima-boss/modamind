import { describe, it, expect } from "vitest";
import { matchOutfits, comboKey, CATEGORY_TO_ROLE, THEME_NAMES } from "../matcher";
import type { ProductWithAttributes } from "@/lib/supabase/types";

/**
 * Builds a minimal fake product with attributes for the matcher.
 * Only the fields the matcher actually reads are filled in.
 */
function product(overrides: {
  id: string;
  category: string;
  colors?: string[];
  tags?: string[];
  formality?: string | null;
  season?: string | null;
  clothingType?: string | null;
}): ProductWithAttributes {
  return {
    id: overrides.id,
    owner_id: "owner-1",
    name: overrides.id,
    category: overrides.category,
    price: 100,
    image_url: null,
    created_at: new Date().toISOString(),
    product_attributes: [
      {
        id: `${overrides.id}-attr`,
        product_id: overrides.id,
        dominant_colors: overrides.colors ?? [],
        pattern: null,
        formality: overrides.formality ?? null,
        style_tags: overrides.tags ?? [],
        season: overrides.season ?? null,
        clothing_type: overrides.clothingType ?? null,
        raw_ai_json: null,
        created_at: new Date().toISOString(),
      },
    ],
  } as ProductWithAttributes;
}

describe("CATEGORY_TO_ROLE", () => {
  it("maps every structural clothing category to a role", () => {
    expect(CATEGORY_TO_ROLE.tops).toBe("top");
    expect(CATEGORY_TO_ROLE.bottoms).toBe("bottom");
    expect(CATEGORY_TO_ROLE.dresses).toBe("dress");
    expect(CATEGORY_TO_ROLE.shoes).toBe("shoes");
  });

  it("maps accessory-like categories to the shared accessory role", () => {
    expect(CATEGORY_TO_ROLE.bags).toBe("accessory");
    expect(CATEGORY_TO_ROLE.jewelry).toBe("accessory");
    expect(CATEGORY_TO_ROLE.watches).toBe("accessory");
    expect(CATEGORY_TO_ROLE.scarves).toBe("accessory");
  });
});

describe("comboKey", () => {
  it("is order-independent", () => {
    expect(comboKey(["b", "a", "c"])).toBe(comboKey(["c", "a", "b"]));
  });

  it("produces different keys for different sets", () => {
    expect(comboKey(["a", "b"])).not.toBe(comboKey(["a", "c"]));
  });
});

describe("matchOutfits", () => {
  const catalog: ProductWithAttributes[] = [
    product({
      id: "top-casual",
      category: "tops",
      colors: ["black"],
      tags: ["casual", "relaxed"],
      formality: "casual",
      clothingType: "t-shirt",
    }),
    product({
      id: "bottom-casual",
      category: "bottoms",
      colors: ["black"],
      tags: ["casual", "denim"],
      formality: "casual",
      clothingType: "jeans",
    }),
    product({
      id: "shoes-casual",
      category: "shoes",
      colors: ["white"],
      tags: ["casual", "sneakers"],
      formality: "casual",
      clothingType: "sneakers",
    }),
    product({
      id: "top-formal",
      category: "tops",
      colors: ["navy"],
      tags: ["formal", "tailored"],
      formality: "formal",
      clothingType: "shirt",
    }),
    product({
      id: "bottom-formal",
      category: "bottoms",
      colors: ["navy"],
      tags: ["formal", "trousers"],
      formality: "formal",
      clothingType: "trousers",
    }),
    product({
      id: "shoes-formal",
      category: "shoes",
      colors: ["black"],
      tags: ["formal", "loafers"],
      formality: "formal",
      clothingType: "loafers",
    }),
  ];

  it("returns at most one outfit per requested theme", () => {
    const results = matchOutfits(catalog, undefined, [
      "Weekend Casual",
      "Office Essentials",
    ]);
    const themeNames = results.map((r) => r.theme.name);
    expect(new Set(themeNames).size).toBe(themeNames.length);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("only generates outfits for explicitly selected themes", () => {
    const results = matchOutfits(catalog, undefined, ["Weekend Casual"]);
    expect(results.every((r) => r.theme.name === "Weekend Casual")).toBe(true);
  });

  it("every generated outfit uses only products from the input catalog", () => {
    const results = matchOutfits(catalog, undefined, THEME_NAMES);
    const catalogIds = new Set(catalog.map((p) => p.id));
    for (const outfit of results) {
      for (const item of outfit.items) {
        expect(catalogIds.has(item.product.id)).toBe(true);
      }
    }
  });

  it("never repeats the same product twice within a single outfit", () => {
    const results = matchOutfits(catalog, undefined, THEME_NAMES);
    for (const outfit of results) {
      const ids = outfit.items.map((i) => i.product.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("respects a hard-skip list of already-used combo keys", () => {
    // "Evening Look" has no bare [top, bottom] fallback — every one of its
    // requiredRoles options needs shoes (and most need an accessory too) —
    // so with only one formal top/bottom/shoes in the catalog and no
    // accessory or dress, there is exactly one possible combo.
    const first = matchOutfits(catalog, undefined, ["Evening Look"]);
    expect(first.length).toBe(1);
    const usedKey = comboKey(first[0].items.map((i) => i.product.id));

    // Re-running with that exact combo pre-seeded as "already used" leaves
    // no valid alternative, so the theme must be skipped entirely.
    const second = matchOutfits(catalog, new Set([usedKey]), ["Evening Look"]);
    expect(second.length).toBe(0);
  });

  it("does not reuse an exact combo that was explicitly hard-skipped", () => {
    const first = matchOutfits(catalog, undefined, ["Weekend Casual"]);
    expect(first.length).toBe(1);
    const usedKey = comboKey(first[0].items.map((i) => i.product.id));

    const second = matchOutfits(catalog, new Set([usedKey]), ["Weekend Casual"]);
    for (const outfit of second) {
      const key = comboKey(outfit.items.map((i) => i.product.id));
      expect(key).not.toBe(usedKey);
    }
  });

  it("returns nothing when no product fills a required role", () => {
    const onlyTops = catalog.filter((p) => p.category === "tops");
    const results = matchOutfits(onlyTops, undefined, THEME_NAMES);
    expect(results).toEqual([]);
  });

  it("is deterministic in structure across runs despite internal randomness", () => {
    // Score/jitter is randomized, but the set of valid theme outcomes
    // for a fixed small catalog should remain within the expected themes.
    for (let i = 0; i < 10; i++) {
      const results = matchOutfits(catalog, undefined, ["Office Essentials"]);
      expect(results.length).toBeLessThanOrEqual(1);
      if (results.length === 1) {
        expect(results[0].theme.name).toBe("Office Essentials");
        expect(results[0].items.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
