import { describe, it, expect } from "vitest";
import { canUseDemoTools } from "../demo-access";

describe("canUseDemoTools", () => {
  it("allows anyone outside production", () => {
    expect(canUseDemoTools("a@b.com", { NODE_ENV: "development" })).toBe(true);
    expect(canUseDemoTools(null, { NODE_ENV: "test" })).toBe(true);
  });

  it("allows a listed email in production, ignoring case and whitespace", () => {
    const env = { NODE_ENV: "production", DEMO_EMAILS: " Demo@Shop.com , other@x.io" };
    expect(canUseDemoTools("demo@shop.com", env)).toBe(true);
    expect(canUseDemoTools("  OTHER@X.IO ", env)).toBe(true);
  });

  it("denies unlisted or missing emails in production", () => {
    const env = { NODE_ENV: "production", DEMO_EMAILS: "demo@shop.com" };
    expect(canUseDemoTools("attacker@evil.com", env)).toBe(false);
    expect(canUseDemoTools(null, env)).toBe(false);
    expect(canUseDemoTools(undefined, env)).toBe(false);
    expect(canUseDemoTools("", env)).toBe(false);
  });

  it("denies everyone in production when DEMO_EMAILS is unset or empty", () => {
    expect(canUseDemoTools("demo@shop.com", { NODE_ENV: "production" })).toBe(false);
    expect(
      canUseDemoTools("demo@shop.com", { NODE_ENV: "production", DEMO_EMAILS: " , ," })
    ).toBe(false);
  });
});
