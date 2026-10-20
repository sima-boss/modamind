import { describe, it, expect } from "vitest";
import { brandKitSchema } from "../brand-kit";

describe("brandKitSchema", () => {
  it("accepts valid hex colors and a valid logo URL", () => {
    const result = brandKitSchema.safeParse({
      brand_logo_url: "https://example.com/logo.png",
      brand_primary_color: "#FF00AA",
      brand_secondary_color: "#000000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts nulls for optional brand fields", () => {
    const result = brandKitSchema.safeParse({
      brand_logo_url: null,
      brand_primary_color: null,
      brand_secondary_color: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed hex color (missing #)", () => {
    const result = brandKitSchema.safeParse({
      brand_logo_url: null,
      brand_primary_color: "FF00AA",
      brand_secondary_color: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a short hex color", () => {
    const result = brandKitSchema.safeParse({
      brand_logo_url: null,
      brand_primary_color: "#FFF",
      brand_secondary_color: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL logo string", () => {
    const result = brandKitSchema.safeParse({
      brand_logo_url: "not-a-url",
      brand_primary_color: null,
      brand_secondary_color: null,
    });
    expect(result.success).toBe(false);
  });
});
