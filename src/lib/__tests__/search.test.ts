import { describe, it, expect } from "vitest";
import { matchPages, toIlikePattern } from "../search";

describe("toIlikePattern", () => {
  it("wraps the term in wildcards and trims whitespace", () => {
    expect(toIlikePattern("  dress ")).toBe("%dress%");
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(toIlikePattern("50%")).toBe("%50\\%%");
    expect(toIlikePattern("a_b")).toBe("%a\\_b%");
  });

  it("escapes the escape character itself", () => {
    expect(toIlikePattern("a\\b")).toBe("%a\\\\b%");
  });

  it("leaves PostgREST syntax characters as literals (only used with .ilike, never .or)", () => {
    expect(toIlikePattern("a,b(c)")).toBe("%a,b(c)%");
  });
});

describe("matchPages", () => {
  it("returns nothing below the minimum length", () => {
    expect(matchPages("b")).toEqual([]);
  });

  it("matches page labels case-insensitively", () => {
    expect(matchPages("BIL").map((p) => p.href)).toEqual(["/billing"]);
    expect(matchPages("out").map((p) => p.href)).toEqual(["/outfits"]);
  });
});
