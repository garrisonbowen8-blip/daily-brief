export const dynamic = "force-dynamic";

// Portfolio — pulls LIVE holdings from Robinhood when ROBINHOOD_TOKEN is set
// in .env.local (Chrome DevTools on robinhood.com → Network → any
// api.robinhood.com request → copy the Authorization: Bearer value).
// Without a token, falls back to the static snapshot below with live market
// prices, clearly labeled as a snapshot.

const RH = "https://api.robinhood.com";
const TOKEN = process.env.ROBINHOOD_TOKEN;

// Snapshot fallback (account ••••1552) — used only when no token is set
const SNAPSHOT_POSITIONS = [
  { symbol: "NVDA", qty: 12.830021, avg: 210.57 },
  { symbol: "PLTR", qty: 2.0, avg: 195.0 },
  { symbol: "QBTS", qty: 30.0, avg: 22.14 },
  { symbol: "CRWV", qty: 6.03318, avg: 116.65 },
  { symbol: "QCOM", qty: 4.0, avg: 191.0 },
  { symbol: "AVGO", qty: 0.5, avg: 428.2 },
  { symbol: "ACHR", qty: 50.0, avg: 8.82 },
  { symbol: "OKLO", qty: 2.0, avg: 71.0 },
  { symbol: "CRSP", qty: 2.0, avg: 56.48 },
  { symbol: "BE", qty: 0.861082, avg: 290.33 },
  { symbol: "ALMS", qty: 19.001851, avg: 22.46 },
  { symbol: "VCX", qty: 13.0, avg: 209.23 },
  { symbol: "NRGV", qty: 44.0, avg: 5.3 },
  { symbol: "TTWO", qty: 3.0, avg: 233.35 },
  { symbol: "TE", qty: 20.0, avg: 9.08 },
  { symbol: "SPCX", qty: 1.0, avg: 135.0 },
  { symbol: "REA", qty: 1.0, avg: 19.0 },
  { symbol: "CBRS", qty: 0.468944, avg: 213.25 },
];
const SNAPSHOT_CRYPTO = 3708.05;

type Holding = { symbol: string; qty: number; avg: number };
type Quote = { price: number; prevClose: number; changePct: number };

class TokenExpired extends Error {}

async function rhGet(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 401 || res.status === 403) throw new TokenExpired();
  if (!res.ok) throw new Error(`Robinhood ${res.status} on ${new URL(url).pathname}`);
  return res.json();
}

// instrument URL → ticker symbol, cached across requests
const instrumentSymbols: Record<string, string> = {};

async function liveHoldings(): Promise<Holding[]> {
  const data = await rhGet(`${RH}/positions/?nonzero=true`);
  const results = (data.results ?? []) as Record<string, string>[];
  const out: Holding[] = [];
  for (const p of results) {
    const qty = parseFloat(p.quantity);
    if (!qty) continue;
    let symbol = instrumentSymbols[p.instrument];
    if (!symbol) {
      const inst = await rhGet(p.instrument);
      symbol = String(inst.symbol ?? "?");
      instrumentSymbols[p.instrument] = symbol;
    }
    out.push({ symbol, qty, avg: parseFloat(p.average_buy_price) || 0 });
  }
  return out;
}

// account-level totals (crypto + cash) from the unified account endpoint
async function liveTotals(): Promise<{ crypto: number; cash: number } | null> {
  try {
    const u = await rhGet("https://phoenix.robinhood.com/accounts/unified");
    const num = (v: unknown): number => {
      if (typeof v === "object" && v !== null && "amount" in v)
        return parseFloat(String((v as { amount: unknown }).amount)) || 0;
      return parseFloat(String(v)) || 0;
    };
    return {
      crypto: num((u.crypto as Record<string, unknown> | undefined)?.equity),
      cash: num(u.uninvested_cash),
    };
  } catch (e) {
    if (e instanceof TokenExpired) throw e;
    return null; // endpoint shape drift — totals degrade, positions stay live
  }
}

async function rhQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const map: Record<string, Quote> = {};
  if (symbols.length === 0) return map;
  try {
    const data = await rhGet(`${RH}/quotes/?symbols=${symbols.join(",")}`);
    for (const q of (data.results ?? []) as (Record<string, string> | null)[]) {
      if (!q) continue;
      const price = parseFloat(q.last_extended_hours_trade_price || q.last_trade_price) || 0;
      const prevClose = parseFloat(q.adjusted_previous_close || q.previous_close) || 0;
      map[q.symbol] = {
        price,
        prevClose,
        changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      };
    }
  } catch (e) {
    if (e instanceof TokenExpired) throw e;
    // fall through — missing quotes get filled from Yahoo below
  }
  return map;
}

async function yahooQuote(symbol: string): Promise<Quote> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "application/json",
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
    return {
      price,
      prevClose,
      changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    };
  } catch {
    return { price: 0, prevClose: 0, changePct: 0 };
  }
}

function summarize(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  cryptoValue: number,
  source: "live" | "snapshot",
  cash = 0,
  note?: string
) {
  let totalValue = 0;
  let totalCost = 0;
  const positions = holdings
    .map((p) => {
      const q = quotes[p.symbol];
      const price = q?.price ?? 0;
      const value = p.qty * price;
      const cost = p.qty * p.avg;
      totalValue += value;
      totalCost += cost;
      return {
        symbol: p.symbol,
        qty: p.qty,
        avgCost: p.avg,
        price,
        value,
        pnl: value - cost,
        pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        dayPct: q?.changePct ?? 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  return {
    connected: true,
    source,
    note,
    equityValue: totalValue,
    cryptoValue,
    cashValue: cash,
    totalValue: totalValue + cryptoValue + cash,
    totalCost,
    totalPnl: totalValue - totalCost,
    totalPnlPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    positions,
  };
}

export async function GET() {
  try {
    if (TOKEN) {
      try {
        const holdings = await liveHoldings();
        const symbols = holdings.map((h) => h.symbol);
        const quotes = await rhQuotes(symbols);
        // fill any quote gaps from Yahoo
        await Promise.all(
          symbols
            .filter((s) => !quotes[s] || quotes[s].price === 0)
            .map(async (s) => {
              quotes[s] = await yahooQuote(s);
            })
        );
        const totals = await liveTotals();
        return Response.json(
          summarize(holdings, quotes, totals?.crypto ?? 0, "live", totals?.cash ?? 0)
        );
      } catch (e) {
        if (e instanceof TokenExpired) {
          return Response.json({
            connected: false,
            reason:
              "ROBINHOOD_TOKEN expired — log in at robinhood.com, copy a fresh Bearer token from DevTools → Network → api.robinhood.com, paste into .env.local, restart",
          });
        }
        throw e;
      }
    }

    // no token — snapshot holdings with live market prices
    const symbols = SNAPSHOT_POSITIONS.map((p) => p.symbol);
    const quotes: Record<string, Quote> = {};
    await Promise.all(
      symbols.map(async (s) => {
        quotes[s] = await yahooQuote(s);
      })
    );
    return Response.json(
      summarize(
        SNAPSHOT_POSITIONS,
        quotes,
        SNAPSHOT_CRYPTO,
        "snapshot",
        0,
        "snapshot holdings — add ROBINHOOD_TOKEN to .env.local for live account sync"
      )
    );
  } catch (err) {
    return Response.json({
      connected: false,
      reason: err instanceof Error ? err.message : "fetch failed",
    });
  }
}
