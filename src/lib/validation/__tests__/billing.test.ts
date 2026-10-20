import { describe, it, expect } from "vitest";
import { planChangeSchema, topupSchema } from "../billing";

describe("planChangeSchema", () => {
  it.each(["basic", "standard", "premium"])(
    "accepts the valid plan id '%s'",
    (plan_id) => {
      expect(planChangeSchema.safeParse({ plan_id }).success).toBe(true);
    }
  );

  it("rejects a plan id outside the allowed set", () => {
    expect(
      planChangeSchema.safeParse({ plan_id: "enterprise" }).success
    ).toBe(false);
  });

  it("rejects a missing plan id", () => {
    expect(planChangeSchema.safeParse({}).success).toBe(false);
  });
});

describe("topupSchema", () => {
  it.each(["small", "medium", "large"])(
    "accepts the valid package '%s'",
    (pkg) => {
      expect(topupSchema.safeParse({ package: pkg }).success).toBe(true);
    }
  );

  it("rejects a package outside the allowed set", () => {
    expect(topupSchema.safeParse({ package: "xl" }).success).toBe(false);
  });
});
