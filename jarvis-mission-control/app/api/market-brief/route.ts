import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PositionSummary = {
  symbol: string;
  price: number;
  value: number;
  dayPct: number;
  pnl: number;
  pnlPct: number;
};

type NewsItem = { title: string; publisher: string };

type ResearchData = {
  connected: boolean;
  reason?: string;
  portfolio: {
    equityValue: number;
    cryptoValue: number;
    totalValue: number;
    totalCost: number;
    totalPnl: number;
    totalPnlPct: number;
  };
  topPositions: PositionSummary[];
  news: Record<string, NewsItem[]>;
};

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function sign(n: number) {
  return n >= 0 ? "+" : "";
}

export async function GET(request: Request) {
  const base = new URL(request.url).origin;

  // Agent 1: fetch market research
  let research: ResearchData;
  try {
    const res = await fetch(`${base}/api/market-research`, { cache: "no-store" });
    research = await res.json();
  } catch {
    return Response.json({ script: "Market data is currently unavailable, sir." });
  }

  if (!research.connected) {
    return Response.json({ script: "Portfolio is offline. Cannot generate market brief.", research: null });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ script: "Market brief unavailable — API key not configured.", research });
  }

  const client = new Anthropic();

  // Agent 2: synthesize into spoken paragraph
  const systemPrompt = [
    "You are the market intelligence layer of JARVIS, an AI briefing system for Garrison Bowen.",
    "Given live portfolio data and recent news headlines, write a concise spoken brief — 3 to 5 sentences — for JARVIS to read aloud.",
    "",
    "Rules:",
    "- Write for the ear only: no markdown, no bullet points, no dashes, no symbols like $ or %",
    "- Say 'up' or 'down' instead of using plus or minus signs",
    "- Lead with the overall portfolio direction and magnitude today",
    "- Name 2 to 3 specific holdings and what is driving their movement",
    "- Weave in one relevant headline that matters for the positions held",
    "- Close with one sharp forward-looking observation",
    "- Dry, precise tone — intelligence briefing, not financial TV energy",
  ].join("\n");

  const portfolioLines = [
    `Total equity: ${fmt(research.portfolio.equityValue)} dollars`,
    `Total P&L: ${sign(research.portfolio.totalPnl)}${fmt(research.portfolio.totalPnl)} dollars (${sign(research.portfolio.totalPnlPct)}${fmt(research.portfolio.totalPnlPct)} percent overall)`,
    `Crypto: ${fmt(research.portfolio.cryptoValue)} dollars`,
  ].join("\n");

  const positionLines = research.topPositions
    .map(
      (p) =>
        `${p.symbol}: ${fmt(p.price)} dollars, ${sign(p.dayPct)}${fmt(p.dayPct)}% today, total P&L ${sign(p.pnlPct)}${fmt(p.pnlPct)}%`
    )
    .join("\n");

  const newsLines = research.topPositions
    .map((p) => {
      const items = research.news[p.symbol];
      if (!items?.length) return "";
      return `${p.symbol}:\n${items.map((n) => `  - ${n.title} (${n.publisher})`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = [
    "Portfolio summary:",
    portfolioLines,
    "",
    "Top positions:",
    positionLines,
    "",
    "Recent headlines:",
    newsLines || "No headlines retrieved.",
    "",
    "Write the spoken market brief now.",
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const script = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    return Response.json({ script, research });
  } catch (err) {
    return Response.json({
      script: "Market brief synthesis failed. Portfolio data is available on the dashboard.",
      research,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
