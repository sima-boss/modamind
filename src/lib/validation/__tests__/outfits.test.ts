import { describe, it, expect } from "vitest";
import { generateOutfitsSchema, generateContentSchema } from "../outfits";
import { MAX_BULK_OUTFITS } from "@/lib/plan-gate";

describe("generateOutfitsSchema", () => {
  it("accepts a valid request", () => {
    const result = generateOutfitsSchema.safeParse({
      count: 1,
      selectedThemes: ["Weekend Casual"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects count below 1", () => {
    const result = generateOutfitsSchema.safeParse({
      count: 0,
      selectedThemes: ["Weekend Casual"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects count above MAX_BULK_OUTFITS (plan-tier cap)", () => {
    const result = generateOutfitsSchema.safeParse({
      count: MAX_BULK_OUTFITS + 1,
      selectedThemes: ["Weekend Casual"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty selectedThemes array", () => {
    const result = generateOutfitsSchema.safeParse({
      count: 1,
      selectedThemes: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer count", () => {
    const result = generateOutfitsSchema.safeParse({
      count: 2.5,
      selectedThemes: ["Weekend Casual"],
    });
    expect(result.success).toBe(false);
  });
});

describe("generateContentSchema", () => {
  it("accepts a minimal valid request and fills in defaults", () => {
    const result = generateContentSchema.safeParse({ items: [{ id: "p1" }] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("en");
      expect(result.data.format).toBe("generic");
    }
  });

  it("rejects an empty items array", () => {
    const result = generateContentSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported language", () => {
    const result = generateContentSchema.safeParse({
      items: [{ id: "p1" }],
      language: "fr",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported format", () => {
    const result = generateContentSchema.safeParse({
      items: [{ id: "p1" }],
      format: "facebook",
    });
    expect(result.success).toBe(false);
  });
});
