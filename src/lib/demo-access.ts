type Env = Record<string, string | undefined>;

/**
 * Demo/debug tools (e.g. "set my usage near the limit") hand out free usage,
 * so in production they're restricted to emails listed in DEMO_EMAILS
 * (comma-separated). Outside production anyone can use them.
 */
export function canUseDemoTools(
  email: string | null | undefined,
  env: Env = process.env
): boolean {
  if (env.NODE_ENV !== "production") return true;
  if (!email) return false;

  const allowed = (env.DEMO_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}
