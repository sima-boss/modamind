/**
 * Rule-based outfit matching engine with diversity.
 *
 * ── Scoring model (per outfit combination) ──────────────────
 *
 * 1. Base quality (pairwise between all items):
 *    - Color affinity: shared colors × 3, neutrals × 1
 *    - Style overlap: shared style tags × 2
 *    - Season match: +2 per matching pair
 *
 * 2. Theme fit (per product):
 *    - Preferred keyword match: +3 per match
 *    - Avoided keyword match: −4 per match
 *    - Dark color bonus (Evening Look): +2
 *
 * 3. Diversity (per product, within one generation run):
 *    - Soft reuse penalty: −3 × times already used
 *    - Unused product bonus: +1
 *
 * 4. Uniqueness (hard skips):
 *    - Core combo (top+bottom+shoes or dress+shoes) already
 *      picked in this run → skip
 *    - Full combo already exists → skip
 *
 * 5. Jitter: random ±2 so similarly-scored combos shuffle
 *
 * Themes are processed in random order so no single theme
 * always gets first pick of the best products.
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
  requiredRoles: string[][];
  /** Keywords that earn a bonus when found in a product's attributes */
  preferred: string[];
  /** Keywords that earn a penalty — stronger than preferred bonus */
  avoided: string[];
  /** When true, products with dark colors get extra points */
  preferDark: boolean;
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
    preferred: [
      "casual", "relaxed", "jeans", "sneakers", "hoodie",
      "t-shirt", "denim", "comfort", "sporty",
    ],
    avoided: [
      "formal", "suit", "blazer", "heels", "elegant",
      "office", "tailored",
    ],
    preferDark: false,
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
    preferred: [
      "formal", "office", "shirt", "polo", "trousers",
      "chinos", "loafers", "professional", "classic", "tailored",
    ],
    avoided: [
      "shorts", "joggers", "sporty", "hoodie", "athletic",
      "sneakers",
    ],
    preferDark: false,
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
    preferred: [
      "smart-casual", "polo", "chinos", "jeans", "loafers",
      "clean", "minimal", "modern",
    ],
    avoided: ["athletic", "joggers", "suit", "hoodie"],
    preferDark: false,
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
    preferred: [
      "elegant", "evening", "formal", "tailored",
      "sophisticated", "sleek", "heels", "classic",
    ],
    avoided: ["sporty", "athletic", "joggers", "shorts", "hoodie"],
    preferDark: true,
  },
];

// ── Scoring weights ───────────────────────────────────────

const THEME_PREFERRED_BONUS = 3;
const THEME_AVOIDED_PENALTY = -4;
const DARK_COLOR_BONUS = 2;
const REUSE_PENALTY = -3;
const UNUSED_BONUS = 1;
const JITTER_RANGE = 4;
const TOP_POOL_SIZE = 5;

// ── Utilities ─────────────────────────────────────────────

/** Fisher-Yates shuffle — returns a new array */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Order-independent key from a set of IDs */
function comboKey(ids: string[]): string {
  return [...ids].sort().join(",");
}

// ── Attribute helpers ─────────────────────────────────────

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

/**
 * All searchable keywords for a product:
 * clothing_type words + style_tags + formality + category.
 */
function productKeywords(p: ProductWithAttributes): Set<string> {
  const attr = getAttr(p);
  const words = new Set<string>();

  if (attr?.clothing_type) {
    // "polo shirt" → {"polo", "shirt", "polo shirt"}
    for (const w of attr.clothing_type.toLowerCase().split(/[\s-]+/)) {
      words.add(w);
    }
    words.add(attr.clothing_type.toLowerCase());
  }
  for (const tag of getTags(p)) words.add(tag.toLowerCase());
  if (attr?.formality) words.add(attr.formality.toLowerCase());
  words.add(p.category.toLowerCase());

  return words;
}

// ── Color sets ────────────────────────────────────────────

const NEUTRAL_COLORS = new Set([
  "black", "white", "grey", "gray", "beige", "cream",
  "ivory", "navy", "tan", "brown", "khaki", "charcoal",
]);

const DARK_COLORS = new Set([
  "black", "navy", "charcoal", "burgundy", "maroon",
  "dark blue", "dark green", "deep purple",
]);

// ── Scoring functions ─────────────────────────────────────

function colorScore(colorsA: string[], colorsB: string[]): number {
  if (colorsA.length === 0 || colorsB.length === 0) return 0;
  const a = colorsA.map((c) => c.toLowerCase());
  const b = colorsB.map((c) => c.toLowerCase());
  const shared = a.filter((c) => b.includes(c)).length;
  const neutralsA = a.filter((c) => NEUTRAL_COLORS.has(c)).length;
  const neutralsB = b.filter((c) => NEUTRAL_COLORS.has(c)).length;
  return shared * 3 + (neutralsA + neutralsB);
}

function styleScore(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 || tagsB.length === 0) return 0;
  const a = new Set(tagsA.map((t) => t.toLowerCase()));
  return tagsB.filter((t) => a.has(t.toLowerCase())).length * 2;
}

/** Pairwise color + style + season compatibility */
function baseQualityScore(items: ProductWithAttributes[]): number {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      total += colorScore(getColors(items[i]), getColors(items[j]));
      total += styleScore(getTags(items[i]), getTags(items[j]));
      const sA = getSeason(items[i]);
      const sB = getSeason(items[j]);
      if (sA && sB && (sA === sB || sA === "all-season" || sB === "all-season")) {
        total += 2;
      }
    }
  }
  return total;
}

/** How well each product matches the theme's keyword preferences */
function themeFitScore(items: ProductWithAttributes[], theme: Theme): number {
  let total = 0;
  for (const p of items) {
    const kw = productKeywords(p);
    for (const pref of theme.preferred) {
      if (kw.has(pref)) total += THEME_PREFERRED_BONUS;
    }
    for (const avoid of theme.avoided) {
      if (kw.has(avoid)) total += THEME_AVOIDED_PENALTY;
    }
    if (theme.preferDark) {
      const colors = getColors(p).map((c) => c.toLowerCase());
      if (colors.some((c) => DARK_COLORS.has(c))) {
        total += DARK_COLOR_BONUS;
      }
    }
  }
  return total;
}

/** Soft penalty for reuse, small bonus for fresh products */
function diversityScore(
  items: ProductWithAttributes[],
  usageCounts: Map<string, number>
): number {
  let total = 0;
  for (const p of items) {
    const uses = usageCounts.get(p.id) ?? 0;
    if (uses > 0) {
      total += REUSE_PENALTY * uses;
    } else {
      total += UNUSED_BONUS;
    }
  }
  return total;
}

/**
 * Core combo key — only structural pieces count.
 * Accessories/outerwear alone can't make an outfit "different".
 */
function coreKey(
  items: { product: ProductWithAttributes; role: string }[]
): string {
  const coreRoles = new Set(["top", "bottom", "shoes", "dress"]);
  const coreIds = items
    .filter((i) => coreRoles.has(i.role))
    .map((i) => i.product.id);
  return comboKey(coreIds);
}

// ── Main matching logic ────────────────────────────────────

/**
 * Generate one outfit per theme, maximizing both quality and diversity.
 *
 * @param existingKeys  Combo keys for outfits already in DB — hard-skipped.
 */
export function matchOutfits(
  products: ProductWithAttributes[],
  existingKeys?: Set<string>
): OutfitCandidate[] {
  const usedFullKeys = new Set(existingKeys);
  const usedCoreKeys = new Set<string>();
  const usageCounts = new Map<string, number>();

  // Group products by role, shuffling each pool for variety
  const byRole = new Map<string, ProductWithAttributes[]>();
  for (const p of products) {
    const role = CATEGORY_TO_ROLE[p.category];
    if (!role) continue;
    const list = byRole.get(role) ?? [];
    list.push(p);
    byRole.set(role, list);
  }
  byRole.forEach((pool, role) => {
    byRole.set(role, shuffle(pool));
  });

  const results: OutfitCandidate[] = [];

  // Shuffle theme processing order so no theme always gets first pick
  const themes = shuffle(THEMES);

  for (const theme of themes) {
    const topCandidates: {
      items: { product: ProductWithAttributes; role: string }[];
      score: number;
      fullKey: string;
      core: string;
    }[] = [];

    for (const roles of theme.requiredRoles) {
      if (roles.some((r) => !byRole.get(r)?.length)) continue;

      const pools = roles.map((r) => {
        const pool = byRole.get(r)!;
        const filtered = pool.filter((p) => {
          const f = getFormality(p);
          return !f || theme.formality.includes(f);
        });
        return { role: r, items: filtered.length > 0 ? filtered : pool };
      });

      const combos = cartesian(pools.map((p) => p.items), 200);

      for (const combo of combos) {
        const ids = combo.map((p) => p.id);
        if (new Set(ids).size !== ids.length) continue;

        // Hard skip: exact full combo already used
        const fk = comboKey(ids);
        if (usedFullKeys.has(fk)) continue;

        const tagged = combo.map((p, i) => ({
          product: p,
          role: pools[i].role,
        }));

        // Hard skip: same core combo already picked in this run
        const ck = coreKey(tagged);
        if (usedCoreKeys.has(ck)) continue;

        // Composite score: quality + theme fit + diversity + jitter
        const quality = baseQualityScore(combo);
        const fit = themeFitScore(combo, theme);
        const diversity = diversityScore(combo, usageCounts);
        const jitter = Math.random() * JITTER_RANGE - JITTER_RANGE / 2;

        topCandidates.push({
          items: tagged,
          score: quality + fit + diversity + jitter,
          fullKey: fk,
          core: ck,
        });

        // Periodic trim to keep memory bounded
        if (topCandidates.length > TOP_POOL_SIZE * 2) {
          topCandidates.sort((a, b) => b.score - a.score);
          topCandidates.length = TOP_POOL_SIZE;
        }
      }
    }

    if (topCandidates.length > 0) {
      // Pick randomly from the top pool
      topCandidates.sort((a, b) => b.score - a.score);
      const pool = topCandidates.slice(0, TOP_POOL_SIZE);
      const pick = pool[Math.floor(Math.random() * pool.length)];

      // Track everything for downstream themes
      usedFullKeys.add(pick.fullKey);
      usedCoreKeys.add(pick.core);
      for (const item of pick.items) {
        const id = item.product.id;
        usageCounts.set(id, (usageCounts.get(id) ?? 0) + 1);
      }

      results.push({
        theme,
        title: theme.title,
        items: pick.items,
        score: pick.score,
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
