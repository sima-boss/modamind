type Env = Record<string, string | undefined>;

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

/** Model used by all AI routes; override with the ANTHROPIC_MODEL env var. */
export function getAnthropicModel(env: Env = process.env): string {
  return env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}
