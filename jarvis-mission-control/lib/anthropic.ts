import Anthropic from "@anthropic-ai/sdk";
import { readdirSync } from "fs";

/**
 * True when the Anthropic SDK has *some* credential available:
 *  - ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in the environment, or
 *  - an `ant auth login` OAuth profile on disk (Claude subscription auth).
 *
 * This lets JARVIS run on a Claude Pro/Max subscription (via `ant auth login`)
 * without a paid API key. Note: a set ANTHROPIC_API_KEY *shadows* the OAuth
 * profile, so for subscription auth the key must be absent from the env.
 */
export function hasAnthropicAuth(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true;
  try {
    const dir = `${process.env.HOME}/.config/anthropic/credentials`;
    return readdirSync(dir).some((f) => f.endsWith(".json"));
  } catch {
    return false;
  }
}

/**
 * A bare Anthropic client. The SDK resolves credentials itself, in order:
 * ANTHROPIC_API_KEY → ANTHROPIC_AUTH_TOKEN → active `ant auth login` profile.
 */
export function anthropicClient(): Anthropic {
  return new Anthropic();
}
