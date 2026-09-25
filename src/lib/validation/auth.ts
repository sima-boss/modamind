import { z } from "zod";

export const emailSchema = z.email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[a-z]/, "At least one lowercase letter")
  .regex(/[0-9]/, "At least one number");

/**
 * Only allow same-origin relative redirect targets ("/dashboard"), never an
 * absolute URL or protocol-relative path ("//evil.com", "/\evil.com" —
 * browsers treat "\" like "/" so this is protocol-relative too) — prevents
 * open redirects via a crafted `next` query param.
 */
export function sanitizeNext(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return "/dashboard";
  }
  return next;
}
