/**
 * Product gap detection.
 *
 * Looks at how many products fall into each outfit "role" (top, bottom,
 * shoes, dress, outerwear, accessory) and flags roles that are too thin to
 * support much outfit variety, plus a rough estimate of how many more
 * combinations a fuller category would unlock.
 */

import type { ProductWithAttributes } from "@/lib/supabase/types";
import { CATEGORY_TO_ROLE } from "./matcher";

/** Roles that gate how many outfits can be built. */
const CORE_ROLES = [
  "top",
  "bottom",
  "shoes",
  "dress",
  "outerwear",
  "accessory",
] as const;

type CoreRole = (typeof CORE_ROLES)[number];

/** Minimum product count before a role is no longer considered a "gap". */
const GAP_THRESHOLD = 3;

const ROLE_LABELS: Record<CoreRole, string> = {
  top: "tops",
  bottom: "bottoms",
  shoes: "pairs of shoes",
  dress: "dresses",
  outerwear: "outerwear pieces",
  accessory: "accessories",
};

export interface RoleGap {
  role: CoreRole;
  label: string;
  count: number;
}

export interface GapInsight {
  /** Product count per role. */
  roleCounts: Record<CoreRole, number>;
  /** Roles with fewer than GAP_THRESHOLD products, sorted thinnest-first. */
  gaps: RoleGap[];
  /** Rough estimate of outfit combinations possible right now. */
  currentCombos: number;
  /** Rough estimate of combinations possible if the bottleneck role were filled out. */
  potentialCombos: number;
  /** potentialCombos / currentCombos, rounded to 1 decimal. */
  multiplier: number;
  /** Human-readable summary of the biggest gap, or null if there isn't one. */
  message: string | null;
}

function estimateCombos(counts: Record<CoreRole, number>): number {
  // top + bottom + shoes combos, plus dress + shoes combos
  return (
    counts.top * counts.bottom * counts.shoes + counts.dress * counts.shoes
  );
}

/**
 * Count products per outfit role and identify which roles are too thin
 * to support much outfit variety.
 */
export function analyzeProductGaps(
  products: ProductWithAttributes[]
): GapInsight {
  const roleCounts = CORE_ROLES.reduce(
    (acc, role) => ({ ...acc, [role]: 0 }),
    {} as Record<CoreRole, number>
  );

  for (const p of products) {
    const role = CATEGORY_TO_ROLE[p.category] as CoreRole | undefined;
    if (role && role in roleCounts) {
      roleCounts[role] += 1;
    }
  }

  const gaps: RoleGap[] = CORE_ROLES.filter(
    (role) => roleCounts[role] < GAP_THRESHOLD
  )
    .map((role) => ({ role, label: ROLE_LABELS[role], count: roleCounts[role] }))
    .sort((a, b) => a.count - b.count);

  const currentCombos = estimateCombos(roleCounts);

  let potentialCombos = currentCombos;
  let multiplier = 1;
  let message: string | null = null;

  if (gaps.length > 0) {
    // Only roles that actually gate combo math (top/bottom/shoes/dress)
    // matter for the headline message — an accessory or outerwear gap
    // doesn't block a basic outfit from existing.
    const structuralGaps = gaps.filter((g) =>
      (["top", "bottom", "shoes", "dress"] as CoreRole[]).includes(g.role)
    );
    const bottleneck = structuralGaps[0] ?? gaps[0];

    const boostedCount = Math.max(bottleneck.count * 3, GAP_THRESHOLD);
    const boostedCounts: Record<CoreRole, number> = {
      ...roleCounts,
      [bottleneck.role]: boostedCount,
    };
    potentialCombos = estimateCombos(boostedCounts);

    multiplier =
      currentCombos > 0
        ? Math.round((potentialCombos / currentCombos) * 10) / 10
        : boostedCount;

    const largestRole = CORE_ROLES.reduce((a, b) =>
      roleCounts[b] > roleCounts[a] ? b : a
    );

    if (bottleneck.count === 0) {
      message = `You have no ${bottleneck.label} in your catalog — adding a few would unlock entirely new outfit combinations.`;
    } else if (largestRole !== bottleneck.role && multiplier > 1) {
      message = `You have ${roleCounts[largestRole]} ${ROLE_LABELS[largestRole]} but only ${bottleneck.count} ${bottleneck.label} — adding more ${bottleneck.label} would unlock ${multiplier}× more outfit combinations.`;
    } else {
      message = `You only have ${bottleneck.count} ${bottleneck.label} — adding more would unlock more outfit combinations.`;
    }
  }

  return { roleCounts, gaps, currentCombos, potentialCombos, multiplier, message };
}
