import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

// Alpha Desk — market read + 3–5 tickers worth RESEARCHING, generated from
// live web search + Garrison's portfolio + his Alpha Desk strategy note.
// These are idea starters, never advice; the disclaimer ships in the payload
// and the tile renders it. Cached ~6h to keep API cost sane under polling.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Idea = {
  ticker: string;
  name: string;
  thesis: string;
  risk: string;
  horizon: string;
};
type AlphaDesk = {
  connected: boolean;
  reason?: string;
  generatedAt?: string;
  marketView?: string;
  ideas?: Idea[];
  disclaimer?: string;
};

const DISCLAIMER =
  "Idea starters for your own research — not financial advice, not a recommendation to buy or sell.";

let cache: { at: number; data: AlphaDesk } | null = null;
const CACHE_MS = 6 * 3600 * 1000;

// find the Alpha Desk strategy note in the vault (name contains "alpha")
function findAlphaNote(): string {
  const vault = process.env.ALPHA_DESK_FILE ? null : process.env.OBSIDIAN_VAULT_PATH;
  if (process.env.ALPHA_DESK_FILE) {
    try {
      return readFileSync(process.env.ALPHA_DESK_FILE, "utf-8");
    } catch {
      return "";
    }
  }
  if (!vault) return "";
  const walk = (dir: string, depth: number): string | null => {
    if (depth > 2) return null;
    try {
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith(".")) continue;
        const p = path.join(dir, entry);
        const st = statSync(p);
        if (st.isDirectory()) {
          const hit = walk(p, depth + 1);
          if (hit) return hit;
        } else if (/alpha/i.test(entry) && entry.endsWith(".md")) {
          return p;
        }
      }
    } catch {
      /* unreadable dir */
    }
    return null;
  };
  const hit = walk(vault, 0);
  try {
    return hit ? readFileSync(hit, "utf-8") : "";
  } catch {
    return "";
  }
}

export async function GET(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({
      connected: false,
      reason: "ANTHROPIC_API_KEY not set in .env.local",
    } satisfies AlphaDesk);
  }
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return Response.json(cache.data);
  }

  const origin = new URL(request.url).origin;
  let portfolio = "";
  try {
    const res = await fetch(`${origin}/api/robinhood`, { cache: "no-store" });
    const rh = await res.json();
    if (rh.connected) {
      const tops = (rh.positions ?? [])
        .slice(0, 8)
        .map((p: { symbol: string; value: number; pnlPct: number }) =>
          `${p.symbol} ($${Math.round(p.value)}, ${p.pnlPct.toFixed(0)}% P&L)`)
        .join(", ");
      portfolio = `Current portfolio: total $${Math.round(rh.totalValue)}. Positions: ${tops}.`;
    }
  } catch {
    /* portfolio context optional */
  }

  const strategy = findAlphaNote();

  try {
    const client = new Anthropic();
    let messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Today is ${new Date().toDateString()}. ${portfolio}\n${
          strategy ? `\nMy Alpha Desk strategy notes:\n${strategy.slice(0, 4000)}\n` : ""
        }\nSearch the current market and produce: (1) a two-sentence market view for today, (2) exactly 3 to 5 tickers worth researching right now given the current market and, where sensible, complementing rather than duplicating my existing positions. Respond ONLY with JSON: {"marketView": string, "ideas": [{"ticker","name","thesis","risk","horizon"}]}. thesis: one specific sentence with a number or catalyst. risk: one sentence, the honest bear case. horizon: e.g. "weeks", "6-12 months". No markdown fences.`,
      },
    ];

    for (let i = 0; i < 5; i++) {
      const r = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1600,
        system:
          "You are a markets research assistant generating WATCHLIST ideas for a user's own further research — never advice. Be specific and current: use web search for today's prices, moves, and catalysts. Plain JSON output only.",
        tools: [{ type: "web_search_20260209", name: "web_search" }],
        messages,
      });
      if (r.stop_reason === "pause_turn") {
        messages = [...messages, { role: "assistant", content: r.content }];
        continue;
      }
      const text = r.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "");
      const parsed = JSON.parse(text) as { marketView: string; ideas: Idea[] };
      const data: AlphaDesk = {
        connected: true,
        generatedAt: new Date().toISOString(),
        marketView: parsed.marketView,
        ideas: (parsed.ideas ?? []).slice(0, 5),
        disclaimer: DISCLAIMER,
      };
      cache = { at: Date.now(), data };
      return Response.json(data);
    }
    return Response.json({
      connected: false,
      reason: "research ran long — try refreshing",
    } satisfies AlphaDesk);
  } catch (err) {
    return Response.json({
      connected: false,
      reason: err instanceof Error ? err.message : "generation failed",
    } satisfies AlphaDesk);
  }
}
