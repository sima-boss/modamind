import { describe, it, expect } from "vitest";
import { emailSchema, passwordSchema, sanitizeNext } from "../auth";

describe("emailSchema", () => {
  it("accepts a well-formed email", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });

  it("rejects a string with no @", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts a password meeting all rules", () => {
    expect(passwordSchema.safeParse("Abcdefg1").success).toBe(true);
  });

  it("rejects a password under 8 characters", () => {
    expect(passwordSchema.safeParse("Ab1defg").success).toBe(false);
  });

  it("rejects a password with no uppercase letter", () => {
    expect(passwordSchema.safeParse("abcdefg1").success).toBe(false);
  });

  it("rejects a password with no lowercase letter", () => {
    expect(passwordSchema.safeParse("ABCDEFG1").success).toBe(false);
  });

  it("rejects a password with no digit", () => {
    expect(passwordSchema.safeParse("Abcdefgh").success).toBe(false);
  });
});

describe("sanitizeNext (open-redirect guard)", () => {
  it("allows a normal same-origin relative path", () => {
    expect(sanitizeNext("/dashboard/outfits")).toBe("/dashboard/outfits");
  });

  it("falls back to /dashboard when next is missing", () => {
    expect(sanitizeNext(null)).toBe("/dashboard");
    expect(sanitizeNext(undefined)).toBe("/dashboard");
    expect(sanitizeNext("")).toBe("/dashboard");
  });

  it("blocks an absolute URL redirect target", () => {
    expect(sanitizeNext("https://evil.com/phish")).toBe("/dashboard");
  });

  it("blocks a protocol-relative redirect (//evil.com)", () => {
    expect(sanitizeNext("//evil.com")).toBe("/dashboard");
  });

  it("blocks a backslash-based protocol-relative redirect (/\\evil.com)", () => {
    // Browsers treat \ like / in a URL, so "/\evil.com" is effectively
    // protocol-relative too — this is the exact bypass the guard exists for.
    expect(sanitizeNext("/\\evil.com")).toBe("/dashboard");
  });

  it("blocks a path with no leading slash", () => {
    expect(sanitizeNext("evil.com")).toBe("/dashboard");
  });
});
