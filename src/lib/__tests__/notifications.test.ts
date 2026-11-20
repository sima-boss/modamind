import { describe, it, expect } from "vitest";
import { buildNotifications } from "../notifications";
import type { Plan, SubscriptionWithPlan } from "@/lib/supabase/types";

const NOW = new Date("2026-11-10T12:00:00Z");

const plan: Plan = {
  id: "pro",
  name: "Pro",
  price_aed: 99,
  is_most_popular: false,
  outfit_generations_limit: 100,
  products_limit: 50,
  ai_captions_limit: 10,
  languages: ["en"],
  social_formats: null,
  analytics_level: "basic",
  export_formats: null,
  has_brand_kit: false,
  has_bulk_generation: false,
  team_members_limit: 1,
  sort_order: 1,
  created_at: "2026-01-01T00:00:00Z",
};

function makeSub(overrides: Partial<SubscriptionWithPlan> = {}): SubscriptionWithPlan {
  return {
    id: "sub",
    user_id: "u1",
    plan_id: plan.id,
    status: "active",
    current_period_start: "2026-11-01T00:00:00Z",
    current_period_end: "2026-12-01T00:00:00Z",
    pending_plan_id: null,
    outfit_generations_used: 0,
    ai_captions_used: 0,
    extra_credits_balance: 20,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    plan,
    pendingPlan: null,
    ...overrides,
  };
}

const ids = (sub: SubscriptionWithPlan, products = 0, now = NOW) =>
  buildNotifications(sub, products, now).map((n) => n.id.split(":")[0]);

describe("buildNotifications", () => {
  it("returns nothing for a healthy subscription", () => {
    expect(buildNotifications(makeSub(), 0, NOW)).toEqual([]);
  });

  it("warns at 80% usage but not at 79%", () => {
    expect(ids(makeSub({ outfit_generations_used: 79 }))).toEqual([]);
    expect(ids(makeSub({ outfit_generations_used: 80 }))).toEqual(["outfit-80"]);
    expect(ids(makeSub({ ai_captions_used: 8 }))).toEqual(["caption-80"]);
  });

  it("escalates to a single limit-reached item at 100%", () => {
    expect(ids(makeSub({ outfit_generations_used: 100 }))).toEqual(["outfit-100"]);
  });

  it("skips usage items on unlimited plans", () => {
    const unlimited = { ...plan, outfit_generations_limit: null, ai_captions_limit: null };
    expect(
      ids(makeSub({ plan: unlimited, outfit_generations_used: 999, ai_captions_used: 999 }))
    ).toEqual([]);
  });

  it("flags low extra credits", () => {
    expect(ids(makeSub({ extra_credits_balance: 3 }))).toEqual(["credits-low"]);
  });

  it("flags zero credits only once a plan allowance is exhausted", () => {
    expect(ids(makeSub({ extra_credits_balance: 0 }))).toEqual([]);
    expect(ids(makeSub({ extra_credits_balance: 0, ai_captions_used: 10 }))).toEqual([
      "caption-100",
      "credits-zero",
    ]);
  });

  it("warns when the product catalog is near or at the limit", () => {
    expect(ids(makeSub(), 39)).toEqual([]);
    expect(ids(makeSub(), 40)).toEqual(["products-80"]);
    expect(ids(makeSub(), 50)).toEqual(["products-100"]);
    expect(ids(makeSub({ plan: { ...plan, products_limit: null } }), 500)).toEqual([]);
  });

  it("shows a scheduled downgrade with its date", () => {
    const basic = { ...plan, id: "basic", name: "Basic" };
    const [n] = buildNotifications(
      makeSub({ pending_plan_id: "basic", pendingPlan: basic }),
      0,
      NOW
    );
    expect(n.id).toMatch(/^pending:basic:/);
    expect(n.detail).toContain("Basic");
    expect(n.detail).toContain("2026");
  });

  it("shows a cancellation with its end date", () => {
    const [n] = buildNotifications(makeSub({ status: "canceled" }), 0, NOW);
    expect(n.id).toMatch(/^canceled:/);
    expect(n.detail).toContain("2026");
  });

  it("shows renewal only within 3 days and without a pending change", () => {
    const soon = new Date("2026-11-29T00:00:00Z");
    expect(ids(makeSub(), 0, soon)).toEqual(["renewal"]);
    expect(ids(makeSub(), 0, new Date("2026-11-27T00:00:00Z"))).toEqual([]);
    const basic = { ...plan, id: "basic", name: "Basic" };
    expect(ids(makeSub({ pendingPlan: basic }), 0, soon)).toEqual(["pending"]);
  });

  it("produces ids that are stable within a period and change across periods", () => {
    const a = buildNotifications(makeSub({ outfit_generations_used: 85 }), 0, NOW);
    const b = buildNotifications(makeSub({ outfit_generations_used: 90 }), 0, NOW);
    const next = buildNotifications(
      makeSub({ outfit_generations_used: 85, current_period_start: "2026-12-01T00:00:00Z" }),
      0,
      NOW
    );
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].id).not.toBe(next[0].id);
  });
});
