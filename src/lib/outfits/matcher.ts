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
 * 0. Theme eligibility (hard filter, per product):
 *    - Any avoided keyword → excluded
 *    - Otherwise needs a matching formality or a preferred keyword
 *    - A theme with no eligible product for some role produces nothing
 *
 * 2. Theme fit (per product):
 *    - Preferred keyword match: +3 per match
 *    - Avoided keyword match: −4 per match
 *    - Dark color bonus (Evening Look): +2
 *
 * 3. Diversity (per product, across one generation run):
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
export const CATEGORY_TO_ROLE: Record<string, string> = {
  tops: "top",
  bottoms: "bottom",
  dresses: "dress",
  outerwear: "outerwear",
  shoes: "shoes",
  bags: "accessory",
  accessories: "accessory",
  activewear: "top",
  swimwear: "top",
  jewelry: "accessory",
  watches: "accessory",
  scarves: "accessory",
};

interface Theme {
  name: string;
  title: string;
  /** Adjective used in "not enough X items" messages, e.g. "formal" */
  fitLabel: string;
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
    fitLabel: "casual",
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
    fitLabel: "office-appropriate",
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
    fitLabel: "smart-casual",
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
    fitLabel: "evening",
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
  {
    name: "Gym / Athleisure",
    title: "Gym / Athleisure",
    fitLabel: "athletic",
    formality: ["casual"],
    requiredRoles: [
      ["top", "bottom", "shoes"],
      ["top", "bottom"],
    ],
    preferred: [
      "athletic", "sporty", "joggers", "sneakers", "hoodie",
      "leggings", "workout", "activewear",
    ],
    avoided: ["formal", "heels", "suit", "blazer"],
    preferDark: false,
  },
  {
    name: "Date Night",
    title: "Date Night",
    fitLabel: "dressy",
    formality: ["formal", "smart-casual"],
    requiredRoles: [
      ["dress", "shoes", "accessory"],
      ["top", "bottom", "shoes", "accessory"],
      ["dress", "shoes"],
      ["top", "bottom", "shoes"],
    ],
    preferred: [
      "elegant", "romantic", "chic", "heels", "dress", "sleek", "fitted",
    ],
    avoided: ["athletic", "sporty", "joggers", "hoodie", "shorts"],
    preferDark: true,
  },
  {
    name: "Streetwear",
    title: "Streetwear",
    fitLabel: "streetwear",
    formality: ["casual", "smart-casual"],
    requiredRoles: [
      ["top", "bottom", "shoes"],
      ["top", "bottom", "outerwear", "shoes"],
      ["top", "bottom"],
    ],
    preferred: [
      "streetwear", "oversized", "sneakers", "hoodie", "graphic",
      "urban", "bold", "casual",
    ],
    avoided: ["formal", "office", "tailored", "heels", "elegant"],
    preferDark: false,
  },
  {
    name: "Beach / Resort",
    title: "Beach / Resort",
    fitLabel: "resort",
    formality: ["casual"],
    requiredRoles: [
      ["top", "bottom", "shoes"],
      ["dress", "shoes"],
      ["top", "bottom"],
    ],
    preferred: [
      "light", "summer", "sandals", "shorts", "linen", "flowy",
      "relaxed", "beach",
    ],
    avoided: ["formal", "suit", "blazer", "heavy", "winter", "boots"],
    preferDark: false,
  },
  {
    name: "Eid / Celebration",
    title: "Eid / Celebration",
    fitLabel: "formal",
    formality: ["formal"],
    requiredRoles: [
      ["dress", "shoes", "accessory"],
      ["top", "bottom", "shoes", "accessory"],
      ["dress", "shoes"],
      ["top", "bottom", "shoes"],
    ],
    preferred: [
      "elegant", "formal", "traditional", "luxurious", "embroidered",
      "rich", "festive", "gold", "silk",
    ],
    avoided: ["casual", "athletic", "sporty", "denim", "sneakers"],
    preferDark: false,
  },
  {
    name: "Business Meeting",
    title: "Business Meeting",
    fitLabel: "formal",
    formality: ["formal", "smart-casual"],
    requiredRoles: [
      ["top", "bottom", "shoes"],
      ["top", "bottom", "outerwear", "shoes"],
      ["top", "bottom"],
    ],
    preferred: [
      "professional", "sharp", "tailored", "blazer", "shirt", "trousers",
      "polished", "classic", "formal",
    ],
    avoided: ["casual", "sneakers", "hoodie", "shorts", "athletic", "joggers"],
    preferDark: false,
  },
];

/** All theme names, in declaration order — for UI selection lists. */
export const THEME_NAMES: string[] = THEMES.map((t) => t.name);

// ── Scoring weights ───────────────────────────────────────

const THEME_PREFERRED_BONUS = 3;
const THEME_AVOIDED_PENALTY = -4;
const DARK_COLOR_BONUS = 2;
const REUSE_PENALTY = -3;
const UNUSED_BONUS = 1;
const JITTER_RANGE = 4;
const TOP_POOL_SIZE = 5;
const MAX_COMBOS = 200;

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
export function comboKey(ids: string[]): string {
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

/**
 * Whether a product is appropriate for a theme at all. Avoided keywords
 * always disqualify; otherwise the product needs either a formality the
 * theme accepts or at least one preferred keyword.
 */
function productFitsTheme(p: ProductWithAttributes, theme: Theme): boolean {
  const kw = productKeywords(p);
  if (theme.avoided.some((a) => kw.has(a))) return false;
  const f = getFormality(p);
  if (f && theme.formality.includes(f)) return true;
  return theme.preferred.some((pref) => kw.has(pref));
}

/** Products grouped by outfit role (unshuffled). */
function groupByRole(
  products: ProductWithAttributes[]
): Map<string, ProductWithAttributes[]> {
  const byRole = new Map<string, ProductWithAttributes[]>();
  for (const p of products) {
    const role = CATEGORY_TO_ROLE[p.category];
    if (!role) continue;
    const list = byRole.get(role) ?? [];
    list.push(p);
    byRole.set(role, list);
  }
  return byRole;
}

export type ThemeFitResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Checks — before anything is generated or charged — whether the catalog
 * can build at least one outfit for the theme from theme-appropriate
 * products only.
 */
export function checkThemeFit(
  products: ProductWithAttributes[],
  themeName: string
): ThemeFitResult {
  const theme = THEMES.find((t) => t.name === themeName);
  if (!theme) return { ok: false, message: `Unknown theme "${themeName}".` };

  const byRole = groupByRole(products);
  const fits = theme.requiredRoles.some((roles) =>
    roles.every((r) =>
      (byRole.get(r) ?? []).some((p) => productFitsTheme(p, theme))
    )
  );
  if (fits) return { ok: true };

  return {
    ok: false,
    message: `Your catalog doesn't have enough ${theme.fitLabel} items for ${theme.name}.`,
  };
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
 * @param existingKeys    Combo keys for outfits already in DB (or produced in
 *                        an earlier call within the same generation run) —
 *                        hard-skipped.
 * @param selectedThemes  When provided, only themes whose `name` is in this
 *                        list are considered. Omit to use every theme.
 * @param usageCounts     Per-product use counts, mutated in place. Pass the
 *                        same map across calls so the reuse penalty spans
 *                        the whole generation run.
 */
export function matchOutfits(
  products: ProductWithAttributes[],
  existingKeys?: Set<string>,
  selectedThemes?: string[],
  usageCounts: Map<string, number> = new Map()
): OutfitCandidate[] {
  const usedFullKeys = new Set(existingKeys);
  const usedCoreKeys = new Set<string>();

  // Group products by role, shuffling each pool for variety
  const byRole = groupByRole(products);
  byRole.forEach((pool, role) => {
    byRole.set(role, shuffle(pool));
  });

  const results: OutfitCandidate[] = [];

  // Shuffle theme processing order so no theme always gets first pick
  const themePool = selectedThemes
    ? THEMES.filter((t) => selectedThemes.includes(t.name))
    : THEMES;
  const themes = shuffle(themePool);

  for (const theme of themes) {
    const topCandidates: {
      items: { product: ProductWithAttributes; role: string }[];
      score: number;
      fullKey: string;
      core: string;
    }[] = [];

    for (const roles of theme.requiredRoles) {
      // Only theme-appropriate products — no fallback to the full pool,
      // so an outfit can never contain an item that doesn't fit the theme.
      const pools = roles.map((r) => ({
        role: r,
        items: (byRole.get(r) ?? []).filter((p) => productFitsTheme(p, theme)),
      }));
      if (pools.some((p) => p.items.length === 0)) continue;

      const combos = sampleCombos(pools.map((p) => p.items), MAX_COMBOS);

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

/**
 * Up to `limit` distinct combos. Small spaces are enumerated fully; large
 * ones are sampled at random so every product has a chance to appear
 * (depth-first enumeration with a cap only ever reaches the first few
 * items of the first pool).
 */
function sampleCombos<T>(arrays: T[][], limit: number): T[][] {
  const total = arrays.reduce((n, a) => n * a.length, 1);
  if (total <= limit) return cartesian(arrays, limit);

  const seen = new Set<string>();
  const result: T[][] = [];
  for (let attempt = 0; result.length < limit && attempt < limit * 5; attempt++) {
    const idx = arrays.map((a) => Math.floor(Math.random() * a.length));
    const key = idx.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(idx.map((i, k) => arrays[k][i]));
  }
  return result;
}
