import { describe, it, expect } from "vitest";
import { createCooldownLimiter } from "../rate-limit";

describe("createCooldownLimiter", () => {
  function setup() {
    let t = 1_000_000;
    const limiter = createCooldownLimiter(30_000, () => t);
    return { limiter, advance: (ms: number) => (t += ms) };
  }

  it("allows the first call", () => {
    const { limiter } = setup();
    expect(limiter.check("u1:p1")).toEqual({ ok: true });
  });

  it("refuses a repeat call within the window with retryAfterSec", () => {
    const { limiter, advance } = setup();
    limiter.check("u1:p1");
    advance(10_000);
    expect(limiter.check("u1:p1")).toEqual({ ok: false, retryAfterSec: 20 });
  });

  it("allows again once the window has passed", () => {
    const { limiter, advance } = setup();
    limiter.check("u1:p1");
    advance(30_000);
    expect(limiter.check("u1:p1")).toEqual({ ok: true });
  });

  it("tracks keys independently", () => {
    const { limiter } = setup();
    limiter.check("u1:p1");
    expect(limiter.check("u1:p2").ok).toBe(true);
    expect(limiter.check("u2:p1").ok).toBe(true);
    expect(limiter.check("u1:p1").ok).toBe(false);
  });
});
