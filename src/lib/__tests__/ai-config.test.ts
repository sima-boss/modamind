import { describe, it, expect } from "vitest";
import { DEFAULT_ANTHROPIC_MODEL, getAnthropicModel } from "../ai-config";

describe("getAnthropicModel", () => {
  it("defaults to claude-sonnet-5", () => {
    expect(DEFAULT_ANTHROPIC_MODEL).toBe("claude-sonnet-5");
    expect(getAnthropicModel({})).toBe("claude-sonnet-5");
    expect(getAnthropicModel({ ANTHROPIC_MODEL: "  " })).toBe("claude-sonnet-5");
  });

  it("uses ANTHROPIC_MODEL when set", () => {
    expect(getAnthropicModel({ ANTHROPIC_MODEL: " claude-opus-5-5 " })).toBe(
      "claude-opus-5-5"
    );
  });
});
