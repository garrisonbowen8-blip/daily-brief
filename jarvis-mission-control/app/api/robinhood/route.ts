import { connectorError, notConnected } from "@/lib/connectors";

// Robinhood equity — matches the number the Robinhood app shows, which is
// NOT the raw `equity` field on /portfolios/:
//   1. During pre/post-market the app shows `extended_hours_equity`;
//      `equity` freezes at the last regular-session mark.
//   2. The app total includes crypto, which lives on a separate API
//      (nummus.robinhood.com), not the brokerage portfolio.
//   3. Day change compares against `adjusted_equity_previous_close`
//      (deposit/withdrawal-adjusted) — the unadjusted previous close makes
//      every deposit look like a gain.
// Auth is a web-session bearer token in ROBINHOOD_TOKEN (see .env.example).

export const dynamic = "force-dynamic";

const BROKERAGE = "https://api.robinhood.com";
const CRYPTO = "https://nummus.robinhood.com";

async function rh<T>(base: string, pathname: string, token: string): Promise<T> {
  const res = await fetch(`${base}${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 401)
    throw new Error("Robinhood token expired or invalid — refresh ROBINHOOD_TOKEN in .env.local");
  if (!res.ok) throw new Error(`Robinhood ${pathname} → HTTP ${res.status}`);
  return res.json();
}

// Robinhood returns every number as a string ("12345.6700") or null.
function num(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Portfolio = {
  equity: string | null;
  extended_hours_equity: string | null;
  equity_previous_close: string | null;
  adjusted_equity_previous_close: string | null;
};

type Account = { account_number: string; buying_power: string | null };

type CryptoPortfolio = {
  equity: string | null;
  extended_hours_equity: string | null;
  previous_close?: string | null;
};

type Historicals = {
  equity_historicals: { adjusted_close_equity: string | null; close_equity: string | null }[];
};

export async function GET() {
  const token = process.env.ROBINHOOD_TOKEN?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return notConnected(
      "Set ROBINHOOD_TOKEN in .env.local — robinhood.com → DevTools → Network → copy the Authorization bearer from any api.robinhood.com request"
    );
  }

  try {
    const [portfolios, accounts, crypto] = await Promise.all([
      rh<{ results: Portfolio[] }>(BROKERAGE, "/portfolios/", token),
      rh<{ results: Account[] }>(BROKERAGE, "/accounts/", token).catch(() => null),
      rh<{ results: CryptoPortfolio[] }>(CRYPTO, "/portfolios/", token).catch(() => null),
    ]);

    const p = portfolios.results?.[0];
    if (!p) throw new Error("Robinhood returned no portfolio");

    const regular = num(p.equity);
    const extended = num(p.extended_hours_equity);
    const afterHours = extended != null && extended !== regular;
    const brokerageEquity = extended ?? regular;
    if (brokerageEquity == null) throw new Error("Robinhood portfolio has no equity figure");

    const c = crypto?.results?.[0];
    const cryptoEquity = c ? num(c.extended_hours_equity) ?? num(c.equity) : null;
    const equity = brokerageEquity + (cryptoEquity ?? 0);

    // Previous close, deposit-adjusted; unknown crypto prev-close contributes
    // zero to day change rather than poisoning it.
    const brokeragePrev =
      num(p.adjusted_equity_previous_close) ?? num(p.equity_previous_close);
    const cryptoPrev = c ? num(c.previous_close) ?? cryptoEquity : null;
    const prevClose = brokeragePrev != null ? brokeragePrev + (cryptoPrev ?? 0) : null;
    const dayChange = prevClose != null ? equity - prevClose : null;
    const dayChangePct =
      dayChange != null && prevClose ? (dayChange / prevClose) * 100 : null;

    const account = accounts?.results?.[0];
    const buyingPower = account ? num(account.buying_power) : null;

    let spark: number[] = [];
    if (account) {
      const hist = await rh<Historicals>(
        BROKERAGE,
        `/portfolios/historicals/${account.account_number}/?interval=5minute&span=day&bounds=trading`,
        token
      ).catch(() => null);
      spark = (hist?.equity_historicals ?? [])
        .map((h) => num(h.adjusted_close_equity) ?? num(h.close_equity))
        .filter((v): v is number => v != null);
    }

    return Response.json({
      connected: true,
      equity,
      brokerageEquity,
      cryptoEquity,
      dayChange,
      dayChangePct,
      afterHours,
      buyingPower,
      spark,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    return connectorError(err);
  }
}
