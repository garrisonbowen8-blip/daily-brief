import Anthropic from "@anthropic-ai/sdk";

/**
 * Build an Anthropic client.
 *
 * If ANTHROPIC_AUTH_TOKEN is set — a Claude Code OAuth token from
 * `claude setup-token` — authenticate via Bearer token so usage bills against
 * the Claude subscription instead of pay-per-token API credits. OAuth tokens
 * require the `oauth-2025-04-20` beta header and must NOT be sent alongside an
 * x-api-key, so we pass apiKey: null to suppress any ANTHROPIC_API_KEY in env.
 *
 * Otherwise fall back to the standard ANTHROPIC_API_KEY path.
 */
export function anthropicClient(): Anthropic {
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (token) {
    return new Anthropic({
      apiKey: null,
      authToken: token,
      defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
    });
  }
  return new Anthropic();
}

/** True if either auth method is configured. */
export function hasAnthropicAuth(): boolean {
  return Boolean(process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY);
}
