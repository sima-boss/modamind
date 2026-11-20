export type CooldownResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Simple in-memory cooldown: a key may pass at most once per `windowMs`.
 *
 * NOTE: state lives in this server instance's memory only. On serverless
 * hosts with several warm instances it is best-effort, not a hard guarantee.
 */
export function createCooldownLimiter(windowMs: number, now: () => number = Date.now) {
  const lastHit = new Map<string, number>();

  function prune(t: number) {
    lastHit.forEach((ts, key) => {
      if (t - ts >= windowMs) lastHit.delete(key);
    });
  }

  return {
    check(key: string): CooldownResult {
      const t = now();
      prune(t);
      const prev = lastHit.get(key);
      if (prev !== undefined && t - prev < windowMs) {
        return {
          ok: false,
          retryAfterSec: Math.max(1, Math.ceil((windowMs - (t - prev)) / 1000)),
        };
      }
      lastHit.set(key, t);
      return { ok: true };
    },
  };
}
