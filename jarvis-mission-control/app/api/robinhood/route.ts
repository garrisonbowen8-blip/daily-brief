export const dynamic = "force-dynamic";

// Known positions from Robinhood account ••••1552.
// To auto-sync positions, add ROBINHOOD_TOKEN to .env.local
// (get it from Chrome DevTools → api.robinhood.com request → Authorization header).
const POSITIONS = [
  { symbol: "NVDA",  qty: 12.830021, avg: 210.57 },
  { symbol: "PLTR",  qty: 2.000000,  avg: 195.00 },
  { symbol: "QBTS",  qty: 30.000000, avg: 22.14  },
  { symbol: "CRWV",  qty: 6.033180,  avg: 116.65 },
  { symbol: "QCOM",  qty: 4.000000,  avg: 191.00 },
  { symbol: "AVGO",  qty: 0.500000,  avg: 428.20 },
  { symbol: "ACHR",  qty: 50.000000, avg: 8.82   },
  { symbol: "OKLO",  qty: 2.000000,  avg: 71.00  },
  { symbol: "CRSP",  qty: 2.000000,  avg: 56.48  },
  { symbol: "BE",    qty: 0.861082,  avg: 290.33 },
  { symbol: "ALMS",  qty: 19.001851, avg: 22.46  },
  { symbol: "VCX",   qty: 13.000000, avg: 209.23 },
  { symbol: "NRGV",  qty: 44.000000, avg: 5.30   },
  { symbol: "TTWO",  qty: 3.000000,  avg: 233.35 },
  { symbol: "TE",    qty: 20.000000, avg: 9.08   },
  { symbol: "SPCX",  qty: 1.000000,  avg: 135.00 },
  { symbol: "REA",   qty: 1.000000,  avg: 19.00  },
  { symbol: "CBRS",  qty: 0.468944,  avg: 213.25 },
];

async function getLivePositions(token: string) {
  const res = await fetch(
    "https://api.robinhood.com/positions/?nonzero=true&account_number=710271552",
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.results ?? []).map((p: Record<string, string>) => ({
    symbol: "", // resolved via instrument URL separately — use hardcoded for now
    qty: parseFloat(p.quantity),
    avg: parseFloat(p.average_buy_price),
  }));
}

async function fetchQuote(symbol: string): Promise<{ price: number; prevClose: number; changePct: number }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return { price: 0, prevClose: 0, changePct: 0 };
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta ?? {};
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? 0;
    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    return { price, prevClose, changePct };
  } catch {
    return { price: 0, prevClose: 0, changePct: 0 };
  }
}

async function fetchQuotes(symbols: string[]) {
  const results = await Promise.all(symbols.map(s => fetchQuote(s)));
  const map: Record<string, { price: number; prevClose: number; changePct: number }> = {};
  symbols.forEach((s, i) => { map[s] = results[i]; });
  return map;
}

export async function GET() {
  try {
    const symbols = POSITIONS.map(p => p.symbol);
    const quotes  = await fetchQuotes(symbols);

    let totalValue  = 0;
    let totalCost   = 0;
    const positions = POSITIONS.map(p => {
      const q     = quotes[p.symbol];
      const price = q?.price ?? 0;
      const value = p.qty * price;
      const cost  = p.qty * p.avg;
      totalValue += value;
      totalCost  += cost;
      return {
        symbol:    p.symbol,
        qty:       p.qty,
        avgCost:   p.avg,
        price,
        value,
        pnl:       value - cost,
        pnlPct:    cost > 0 ? ((value - cost) / cost) * 100 : 0,
        dayPct:    q?.changePct ?? 0,
      };
    }).sort((a, b) => b.value - a.value);

    // Include crypto value from known portfolio snapshot
    const cryptoValue = 3708.05;

    return Response.json({
      connected:   true,
      equityValue: totalValue,
      cryptoValue,
      totalValue:  totalValue + cryptoValue,
      totalCost,
      totalPnl:    totalValue - totalCost,
      totalPnlPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      positions,
    });
  } catch (err) {
    return Response.json({
      connected: false,
      reason: err instanceof Error ? err.message : "fetch failed",
    });
  }
}
