/**
 * Rule-based outfit matching engine.
 *
 * Scores every possible combination of products (one per role slot)
 * based on formality, season, color affinity, and style overlap,
 * then returns the best outfit per theme.
 *
 * No AI is used — just deterministic scoring.
 */

import type { ProductWithAttributes } from "@/lib/supabase/types";

// ── Types ──────────────────────────────────────────────────

export interface OutfitCandidate {
  theme: Theme;
  title: string;
  items: { product: ProductWithAttributes; role: string }[];
  score: number;
}

// ── Constants ──────────────────────────────────────────────

/** Map product categories → outfit role */
const CATEGORY_TO_ROLE: Record<string, string> = {
  tops: "top",
  bottoms: "bottom",
  dresses: "dress",
  outerwear: "outerwear",
  shoes: "shoes",
  bags: "accessory",
  accessories: "accessory",
};

interface Theme {
  name: string;
  title: string;
  formality: string[];
  requiredRoles: string[][];   // each sub-array is one valid role combo
}

const THEMES: Theme[] = [
  {
    name: "Weekend Casual",
    title: "Weekend Casual",
    formality: ["casual"],
    requiredRoles: [
      ["top", "bottom", "shoes"],
      ["dress", "shoes"],
      ["top", "bottom"],
    ],
  },
  {
    name: "Office Essentials",
    title: "Office Essentials",
    formality: ["formal", "smart-casual"],
    requiredRoles: [
      ["top", "bottom", "shoes"],
      ["dress", "shoes"],
      ["top", "bottom"],
    ],
  },
  {
    name: "Smart Casual",
    title: "Smart Casual",
    formality: ["smart-casual", "casual"],
    requiredRoles: [
      ["top", "bottom", "shoes"],
      ["top", "bottom", "outerwear"],
      ["dress", "shoes"],
      ["top", "bottom"],
    ],
  },
  {
    name: "Evening Look",
    title: "Evening Look",
    formality: ["formal", "smart-casual"],
    requiredRoles: [
      ["top", "bottom", "shoes", "accessory"],
      ["dress", "shoes", "accessory"],
      ["top", "bottom", "shoes"],
      ["dress", "shoes"],
    ],
  },
];

// ── Color compatibility ────────────────────────────────────

const NEUTRAL_COLORS = new Set([
  "black", "white", "grey", "gray", "beige", "cream",
  "ivory", "navy", "tan", "brown", "khaki", "charcoal",
]);

function colorScore(colorsA: string[], colorsB: string[]): number {
  if (colorsA.length === 0 || colorsB.length === 0) return 0;

  const a = colorsA.map((c) => c.toLowerCase());
  const b = colorsB.map((c) => c.toLowerCase());

  // Shared colors → good match
  const shared = a.filter((c) => b.includes(c)).length;
  // Neutrals pair well with anything
  const neutralsA = a.filter((c) => NEUTRAL_COLORS.has(c)).length;
  const neutralsB = b.filter((c) => NEUTRAL_COLORS.has(c)).length;

  return shared * 3 + (neutralsA + neutralsB);
}

// ── Style overlap ──────────────────────────────────────────

function styleScore(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 || tagsB.length === 0) return 0;
  const a = new Set(tagsA.map((t) => t.toLowerCase()));
  return tagsB.filter((t) => a.has(t.toLowerCase())).length * 2;
}

// ── Helpers to extract attributes safely ───────────────────

function getAttr(p: ProductWithAttributes) {
  return p.product_attributes?.[0] ?? null;
}

function getColors(p: ProductWithAttributes): string[] {
  const a = getAttr(p);
  if (!a?.dominant_colors || !Array.isArray(a.dominant_colors)) return [];
  return a.dominant_colors as string[];
}

function getTags(p: ProductWithAttributes): string[] {
  const a = getAttr(p);
  if (!a?.style_tags || !Array.isArray(a.style_tags)) return [];
  return a.style_tags as string[];
}

function getFormality(p: ProductWithAttributes): string | null {
  return getAttr(p)?.formality ?? null;
}

function getSeason(p: ProductWithAttributes): string | null {
  return getAttr(p)?.season ?? null;
}

// ── Score a set of items together ──────────────────────────

function scoreOutfit(items: ProductWithAttributes[]): number {
  let total = 0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      total += colorScore(getColors(items[i]), getColors(items[j]));
      total += styleScore(getTags(items[i]), getTags(items[j]));

      // Season match bonus
      const sA = getSeason(items[i]);
      const sB = getSeason(items[j]);
      if (sA && sB && (sA === sB || sA === "all-season" || sB === "all-season")) {
        total += 2;
      }
    }
  }

  return total;
}

// ── Main matching logic ────────────────────────────────────

/**
 * Given all products, generate the best outfit for each theme.
 * Returns only themes where a valid combination was found.
 */
export function matchOutfits(
  products: ProductWithAttributes[]
): OutfitCandidate[] {
  // Group products by role
  const byRole = new Map<string, ProductWithAttributes[]>();
  for (const p of products) {
    const role = CATEGORY_TO_ROLE[p.category];
    if (!role) continue;
    const list = byRole.get(role) ?? [];
    list.push(p);
    byRole.set(role, list);
  }

  const results: OutfitCandidate[] = [];

  for (const theme of THEMES) {
    let bestCombo: { product: ProductWithAttributes; role: string }[] | null = null;
    let bestScore = -1;

    // Try each valid role combination for this theme
    for (const roles of theme.requiredRoles) {
      // Check all roles have at least one product
      if (roles.some((r) => !byRole.get(r)?.length)) continue;

      // Build candidates per role
      const pools = roles.map((r) => {
        const pool = byRole.get(r)!;
        // Pre-filter: formality match
        const filtered = pool.filter((p) => {
          const f = getFormality(p);
          return !f || theme.formality.includes(f);
        });
        return { role: r, items: filtered.length > 0 ? filtered : pool };
      });

      // Generate combinations (cap at 200 to stay fast)
      const combos = cartesian(pools.map((p) => p.items), 200);

      for (const combo of combos) {
        // No duplicate products
        const ids = new Set(combo.map((p) => p.id));
        if (ids.size !== combo.length) continue;

        const s = scoreOutfit(combo);
        if (s > bestScore) {
          bestScore = s;
          bestCombo = combo.map((p, i) => ({
            product: p,
            role: pools[i].role,
          }));
        }
      }
    }

    if (bestCombo) {
      results.push({
        theme,
        title: theme.title,
        items: bestCombo,
        score: bestScore,
      });
    }
  }

  return results;
}

// ── Cartesian product with cap ─────────────────────────────

function cartesian<T>(arrays: T[][], limit: number): T[][] {
  const result: T[][] = [];

  function helper(idx: number, current: T[]) {
    if (result.length >= limit) return;
    if (idx === arrays.length) {
      result.push([...current]);
      return;
    }
    for (const item of arrays[idx]) {
      current.push(item);
      helper(idx + 1, current);
      current.pop();
      if (result.length >= limit) return;
    }
  }

  helper(0, []);
  return result;
}
