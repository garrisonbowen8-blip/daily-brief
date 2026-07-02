export const dynamic = "force-dynamic";

// Portfolio — pulls LIVE holdings from Robinhood when ROBINHOOD_TOKEN is set
// in .env.local (Chrome DevTools on robinhood.com → Network → any
// api.robinhood.com request → copy the Authorization: Bearer value).
// Without a token, falls back to the static snapshot below with live market
// prices, clearly labeled as a snapshot.

const RH = "https://api.robinhood.com";
// Extract the JWT itself from the env var, ignoring any stray text/whitespace
// that hitchhiked in during copy-paste (em-dashes, console labels, etc.)
const TOKEN = (process.env.ROBINHOOD_TOKEN ?? "").match(
  /eyJ[\w-]+\.[\w-]+\.[\w-]+/
)?.[0];

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

const num = (v: unknown): number => {
  if (typeof v === "object" && v !== null && "amount" in v)
    return parseFloat(String((v as { amount: unknown }).amount)) || 0;
  return parseFloat(String(v)) || 0;
};

type Totals = {
  total: number | null; // account total (stocks + crypto + cash)
  equity: number | null; // stock/ETF positions market value, per Robinhood
  crypto: number | null;
  cash: number | null;
  source: string;
  raw: Record<string, number | null>; // per-endpoint diagnostics
};

// Crypto lives in Robinhood's separate "Nummus" system — the brokerage
// endpoints don't include it, which is why it wasn't tracking.
async function liveCrypto(): Promise<number | null> {
  for (const url of [
    "https://nummus.robinhood.com/portfolios/",
    "https://nummus.robinhood.com/portfolios",
  ]) {
    try {
      const p = await rhGet(url);
      const r = ((p.results as Record<string, unknown>[]) ?? [])[0] ?? {};
      const v =
        num(r.extended_hours_market_value) || num(r.market_value) || num(r.equity);
      if (v) return v;
    } catch (e) {
      if (e instanceof TokenExpired) throw e;
    }
  }
  return null;
}

// Authoritative account numbers straight from Robinhood. Equity (stocks) from
// /portfolios/, crypto from Nummus, cash from the unified endpoint — then the
// total is the sum, so crypto is always counted exactly once.
async function liveTotals(): Promise<Totals> {
  const raw: Record<string, number | null> = {};
  let equity: number | null = null;
  let crypto: number | null = null;
  let cash: number | null = null;
  const parts: string[] = [];

  // brokerage (stocks/ETFs) market value
  try {
    const pf = await rhGet(`${RH}/portfolios/`);
    const r = ((pf.results as Record<string, unknown>[]) ?? [])[0] ?? {};
    const mv = num(r.extended_hours_market_value) || num(r.market_value);
    raw.portfolios_market_value = mv || null;
    if (mv) {
      equity = mv;
      parts.push("portfolios");
    }
  } catch (e) {
    if (e instanceof TokenExpired) throw e;
  }

  // unified — cash, plus a cross-check total and its crypto figure
  try {
    const u = await rhGet("https://phoenix.robinhood.com/accounts/unified");
    cash = num(u.uninvested_cash ?? u.cash) || null;
    raw.unified_total = num(u.total_equity) || null;
    raw.unified_crypto = num((u.crypto as Record<string, unknown> | undefined)?.equity) || null;
    if (equity == null)
      equity =
        num((u.individual as Record<string, unknown> | undefined)?.portfolio_equity) ||
        num(u.portfolio_equity) ||
        null;
    parts.push("unified");
  } catch (e) {
    if (e instanceof TokenExpired) throw e;
  }

  // crypto from Nummus (the real source)
  const nummus = await liveCrypto();
  raw.nummus_crypto = nummus;
  crypto = nummus ?? raw.unified_crypto ?? null;
  if (nummus) parts.push("nummus");

  const total =
    (equity ?? 0) + (crypto ?? 0) + (cash ?? 0) || raw.unified_total || null;

  return { total, equity, crypto, cash, source: parts.join("+"), raw };
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

// Build the per-position list (values from live prices, for the P&L breakdown)
function buildPositions(holdings: Holding[], quotes: Record<string, Quote>) {
  let reconstructed = 0;
  let totalCost = 0;
  const positions = holdings
    .map((p) => {
      const q = quotes[p.symbol];
      const price = q?.price ?? 0;
      const value = p.qty * price;
      const cost = p.qty * p.avg;
      reconstructed += value;
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
  return { positions, reconstructed, totalCost };
}

export async function GET() {
  try {
    if (TOKEN) {
      try {
        const [holdings, totals] = await Promise.all([liveHoldings(), liveTotals()]);
        const symbols = holdings.map((h) => h.symbol);
        const quotes = await rhQuotes(symbols);
        await Promise.all(
          symbols
            .filter((s) => !quotes[s] || quotes[s].price === 0)
            .map(async (s) => {
              quotes[s] = await yahooQuote(s);
            })
        );
        const { positions, reconstructed, totalCost } = buildPositions(holdings, quotes);

        // Prefer Robinhood's OWN numbers; fall back to reconstruction only if
        // an endpoint didn't return that figure.
        const equityValue = totals.equity ?? reconstructed;
        const cryptoValue = totals.crypto ?? 0;
        const cashValue = totals.cash ?? 0;
        const totalValue = totals.total ?? equityValue + cryptoValue + cashValue;

        return Response.json({
          connected: true,
          source: "live",
          equityValue,
          cryptoValue,
          cashValue,
          totalValue,
          totalCost,
          totalPnl: equityValue - totalCost,
          totalPnlPct: totalCost > 0 ? ((equityValue - totalCost) / totalCost) * 100 : 0,
          positions,
          // diagnostics — which Robinhood figure each number came from
          debug: {
            totalsSource: totals.source,
            rhTotal: totals.total,
            rhEquity: totals.equity,
            rhCrypto: totals.crypto,
            rhCash: totals.cash,
            reconstructedEquity: Math.round(reconstructed),
            positionCount: holdings.length,
            ...totals.raw,
          },
        });
      } catch (e) {
        if (e instanceof TokenExpired) {
          return Response.json({
            connected: false,
            reason:
              "ROBINHOOD_TOKEN expired — log in at robinhood.com, grab a fresh Bearer token, paste into .env.local, restart",
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
    const { positions, reconstructed, totalCost } = buildPositions(SNAPSHOT_POSITIONS, quotes);
    return Response.json({
      connected: true,
      source: "snapshot",
      note: "snapshot holdings — add ROBINHOOD_TOKEN to .env.local for live account sync",
      equityValue: reconstructed,
      cryptoValue: SNAPSHOT_CRYPTO,
      cashValue: 0,
      totalValue: reconstructed + SNAPSHOT_CRYPTO,
      totalCost,
      totalPnl: reconstructed - totalCost,
      totalPnlPct: totalCost > 0 ? ((reconstructed - totalCost) / totalCost) * 100 : 0,
      positions,
    });
  } catch (err) {
    return Response.json({
      connected: false,
      reason: err instanceof Error ? err.message : "fetch failed",
    });
  }
}
