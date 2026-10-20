import { describe, it, expect } from "vitest";
import { analyzeProductGaps } from "../gaps";
import type { ProductWithAttributes } from "@/lib/supabase/types";

function product(id: string, category: string): ProductWithAttributes {
  return {
    id,
    owner_id: "owner-1",
    name: id,
    category,
    price: 100,
    image_url: null,
    created_at: new Date().toISOString(),
    product_attributes: [],
  } as unknown as ProductWithAttributes;
}

describe("analyzeProductGaps", () => {
  it("flags every role as a gap on an empty catalog", () => {
    const insight = analyzeProductGaps([]);
    expect(insight.gaps.length).toBe(6);
    expect(insight.currentCombos).toBe(0);
  });

  it("does not flag a role once it has at least GAP_THRESHOLD (3) items", () => {
    const products = [
      product("t1", "tops"),
      product("t2", "tops"),
      product("t3", "tops"),
    ];
    const insight = analyzeProductGaps(products);
    const topGap = insight.gaps.find((g) => g.role === "top");
    expect(topGap).toBeUndefined();
    expect(insight.roleCounts.top).toBe(3);
  });

  it("flags a role with fewer than 3 items, sorted thinnest-first", () => {
    const products = [
      product("t1", "tops"),
      product("t2", "tops"),
      product("t3", "tops"),
      product("d1", "dresses"),
      product("d2", "dresses"),
      product("d3", "dresses"),
      product("o1", "outerwear"),
      product("o2", "outerwear"),
      product("o3", "outerwear"),
      product("a1", "bags"),
      product("a2", "bags"),
      product("a3", "bags"),
      product("b1", "bottoms"),
      product("s1", "shoes"),
      product("s2", "shoes"),
    ];
    const insight = analyzeProductGaps(products);
    // Every role except bottoms/shoes clears the threshold (3); bottoms
    // has 1, shoes has 2 — bottoms should sort first (thinnest).
    expect(insight.gaps[0].role).toBe("bottom");
    expect(insight.gaps[0].count).toBe(1);
  });

  it("produces a non-null message pointing at the structural bottleneck", () => {
    const products = [
      product("t1", "tops"),
      product("t2", "tops"),
      product("t3", "tops"),
      product("t4", "tops"),
      product("s1", "shoes"),
      product("s2", "shoes"),
      product("s3", "shoes"),
      product("d1", "dresses"),
      product("d2", "dresses"),
      product("d3", "dresses"),
      product("b1", "bottoms"),
    ];
    // Only "bottoms" is below the gap threshold among the structural
    // roles (top/bottom/shoes/dress), so it must be the named bottleneck.
    const insight = analyzeProductGaps(products);
    expect(insight.message).not.toBeNull();
    expect(insight.message).toContain("bottoms");
  });

  it("reports no gap message when every core role clears the threshold", () => {
    const roles = ["tops", "bottoms", "shoes", "dresses", "outerwear", "bags"];
    const products = roles.flatMap((role) => [
      product(`${role}-1`, role),
      product(`${role}-2`, role),
      product(`${role}-3`, role),
    ]);
    const insight = analyzeProductGaps(products);
    expect(insight.gaps).toEqual([]);
    expect(insight.message).toBeNull();
    expect(insight.multiplier).toBe(1);
  });

  it("estimateCombos math: top*bottom*shoes + dress*shoes", () => {
    const products = [
      product("t1", "tops"),
      product("t2", "tops"),
      product("b1", "bottoms"),
      product("s1", "shoes"),
    ];
    // 2 tops * 1 bottom * 1 shoe + 0 dresses * 1 shoe = 2
    const insight = analyzeProductGaps(products);
    expect(insight.currentCombos).toBe(2);
  });
});
