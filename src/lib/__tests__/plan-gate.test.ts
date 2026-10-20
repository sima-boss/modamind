import { describe, it, expect } from "vitest";
import {
  maxOutfitsPerRequest,
  canUseCaptionLanguage,
  canUseCaptionFormat,
  canUseExportFormat,
  canViewFullAnalytics,
  MAX_BULK_OUTFITS,
  MAX_OUTFITS_WITHOUT_BULK,
} from "../plan-gate";

describe("maxOutfitsPerRequest", () => {
  it("returns the bulk cap for a plan with bulk generation", () => {
    expect(maxOutfitsPerRequest({ has_bulk_generation: true })).toBe(
      MAX_BULK_OUTFITS
    );
  });

  it("returns the single-outfit cap for a plan without bulk generation", () => {
    expect(maxOutfitsPerRequest({ has_bulk_generation: false })).toBe(
      MAX_OUTFITS_WITHOUT_BULK
    );
  });
});

describe("canUseCaptionLanguage", () => {
  it("always allows English regardless of plan", () => {
    expect(canUseCaptionLanguage({ languages: [] }, "en")).toBe(true);
  });

  it("allows Arabic only when the plan includes it", () => {
    expect(canUseCaptionLanguage({ languages: ["ar"] }, "ar")).toBe(true);
    expect(canUseCaptionLanguage({ languages: [] }, "ar")).toBe(false);
  });
});

describe("canUseCaptionFormat", () => {
  it("always allows the generic format", () => {
    expect(canUseCaptionFormat({ social_formats: null }, "generic")).toBe(
      true
    );
  });

  it("gates instagram/tiktok behind plan.social_formats", () => {
    expect(
      canUseCaptionFormat({ social_formats: ["instagram"] }, "instagram")
    ).toBe(true);
    expect(canUseCaptionFormat({ social_formats: null }, "instagram")).toBe(
      false
    );
    expect(canUseCaptionFormat({ social_formats: ["instagram"] }, "tiktok")).toBe(
      false
    );
  });
});

describe("canUseExportFormat", () => {
  it("denies an export format not listed on the plan", () => {
    expect(canUseExportFormat({ export_formats: null }, "csv")).toBe(false);
  });

  it("allows an export format explicitly granted by the plan", () => {
    expect(canUseExportFormat({ export_formats: ["csv", "pdf"] }, "pdf")).toBe(
      true
    );
  });
});

describe("canViewFullAnalytics", () => {
  it("only unlocks full analytics at the 'full' tier", () => {
    expect(canViewFullAnalytics({ analytics_level: "full" })).toBe(true);
    expect(canViewFullAnalytics({ analytics_level: "basic" })).toBe(false);
  });
});
