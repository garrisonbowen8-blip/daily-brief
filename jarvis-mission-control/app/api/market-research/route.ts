export const dynamic = "force-dynamic";

type Position = {
  symbol: string;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
  dayPct: number;
  avgCost: number;
  qty: number;
};

type NewsItem = {
  title: string;
  publisher: string;
};

type RobinhoodData = {
  connected: boolean;
  equityValue: number;
  cryptoValue: number;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
  positions: Position[];
};

async function fetchNews(symbol: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=4&quotesCount=0&enableFuzzyQuery=false`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.news ?? []).slice(0, 4).map((n: { title: string; publisher: string }) => ({
      title: n.title,
      publisher: n.publisher,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const base = new URL(request.url).origin;

  let portfolio: RobinhoodData;
  try {
    const res = await fetch(`${base}/api/robinhood`, { cache: "no-store" });
    portfolio = await res.json();
  } catch {
    return Response.json({ connected: false, reason: "portfolio fetch failed" });
  }

  if (!portfolio.connected) {
    return Response.json({ connected: false, reason: "portfolio unavailable" });
  }

  // Top 6 positions by current value
  const topPositions = portfolio.positions.filter((p) => p.value > 0).slice(0, 6);

  // Fetch news for all in parallel
  const newsResults = await Promise.all(topPositions.map((p) => fetchNews(p.symbol)));
  const news: Record<string, NewsItem[]> = {};
  topPositions.forEach((p, i) => {
    news[p.symbol] = newsResults[i];
  });

  return Response.json({
    connected: true,
    portfolio: {
      equityValue: portfolio.equityValue,
      cryptoValue: portfolio.cryptoValue,
      totalValue: portfolio.totalValue,
      totalCost: portfolio.totalCost,
      totalPnl: portfolio.totalPnl,
      totalPnlPct: portfolio.totalPnlPct,
    },
    topPositions,
    news,
  });
}
