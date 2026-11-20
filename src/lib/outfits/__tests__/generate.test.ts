import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductWithAttributes } from "@/lib/supabase/types";

vi.mock("@/lib/supabase/queries", () => ({
  getProducts: vi.fn(),
  getOutfitsByIds: vi.fn(async (_client: unknown, ids: string[]) =>
    ids.map((id) => ({ id }))
  ),
}));

import { generateOutfits } from "../generate";
import { getOutfitsByIds } from "@/lib/supabase/queries";

function product(id: string, category: string): ProductWithAttributes {
  return {
    id,
    owner_id: "owner-1",
    name: id,
    category,
    price: 100,
    image_url: null,
    created_at: new Date().toISOString(),
    product_attributes: [
      {
        id: `${id}-attr`,
        product_id: id,
        dominant_colors: ["black"],
        pattern: null,
        formality: "casual",
        style_tags: ["casual"],
        season: "all",
        clothing_type: null,
        raw_ai_json: null,
        created_at: new Date().toISOString(),
      },
    ],
  } as unknown as ProductWithAttributes;
}

const PRODUCTS = [
  product("top-1", "tops"),
  product("bottom-1", "bottoms"),
  product("shoes-1", "shoes"),
  product("top-2", "tops"),
  product("bottom-2", "bottoms"),
];

interface Call {
  table: string;
  op: "insert" | "delete";
  payload?: unknown;
  eq?: [string, unknown];
}

/** Minimal chainable fake of the supabase-js query builder, recording
 * every insert/delete. `failItemsInsertAt` makes the Nth (1-based)
 * outfit_items insert return an error. */
function fakeSupabase(opts: { failItemsInsertAt?: number } = {}) {
  const calls: Call[] = [];
  let outfitSeq = 0;
  let itemsInserts = 0;

  const client = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          calls.push({ table, op: "insert", payload });
          if (table === "outfits") {
            const id = `new-${++outfitSeq}`;
            return {
              select: () => ({
                single: async () => ({ data: { id }, error: null }),
              }),
            };
          }
          itemsInserts++;
          const fail = itemsInserts === opts.failItemsInsertAt;
          return Promise.resolve({
            error: fail ? { message: "items insert failed" } : null,
          });
        },
        delete() {
          const call: Call = { table, op: "delete" };
          calls.push(call);
          return {
            eq: async (col: string, val: unknown) => {
              call.eq = [col, val];
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { client: client as never, calls };
}

describe("generateOutfits", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds outfits without deleting any existing ones", async () => {
    const { client, calls } = fakeSupabase();
    await generateOutfits(client, { products: PRODUCTS });

    expect(calls.some((c) => c.op === "delete")).toBe(false);
    expect(calls.filter((c) => c.table === "outfits" && c.op === "insert").length)
      .toBeGreaterThan(0);
  });

  it("returns only the newly created outfits", async () => {
    const { client, calls } = fakeSupabase();
    const result = await generateOutfits(client, { products: PRODUCTS });

    const created = calls.filter(
      (c) => c.table === "outfits" && c.op === "insert"
    ).length;
    const ids = Array.from({ length: created }, (_, i) => `new-${i + 1}`);
    expect(getOutfitsByIds).toHaveBeenCalledWith(client, ids);
    expect(result.map((o) => o.id)).toEqual(ids);
  });

  it("removes the half-saved outfit and rethrows when its items fail to save", async () => {
    const { client, calls } = fakeSupabase({ failItemsInsertAt: 1 });

    await expect(
      generateOutfits(client, { products: PRODUCTS })
    ).rejects.toMatchObject({ message: "items insert failed" });

    const deletes = calls.filter((c) => c.op === "delete");
    expect(deletes).toEqual([
      { table: "outfits", op: "delete", eq: ["id", "new-1"] },
    ]);
    expect(getOutfitsByIds).not.toHaveBeenCalled();
  });

  it("throws when there are fewer than 2 products", async () => {
    const { client } = fakeSupabase();
    await expect(
      generateOutfits(client, { products: [PRODUCTS[0]] })
    ).rejects.toThrow(/at least 2 products/);
  });
});
