"use client";

import { useEffect, useState } from "react";
import Panel from "./Panel";
import { useConnector } from "@/lib/useConnector";

type Position = {
  symbol: string;
  qty: number;
  avgCost: number;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
  dayPct: number;
};

type RHData = {
  equityValue: number;
  cryptoValue: number;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
  positions: Position[];
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${fmt(n, 2)}%`;
}

function pnlColor(n: number) {
  return n >= 0 ? "#3ddc84" : "#ff4f5e";
}

const MASK = "••••••";

export default function RobinhoodTile() {
  const { data, loading } = useConnector<RHData>("/api/robinhood", 60_000);

  // Privacy toggle — hides every dollar figure. Persisted so it stays hidden
  // across refreshes. Init false to avoid an SSR hydration mismatch, then read
  // the saved choice after mount.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(localStorage.getItem("rh_balance_hidden") === "1");
  }, []);
  const toggle = () =>
    setHidden((h) => {
      const next = !h;
      try { localStorage.setItem("rh_balance_hidden", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });

  return (
    <Panel title="Portfolio — Robinhood" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <div className="text-[11px] text-dim blink">fetching quotes…</div>
      ) : !data?.connected ? (
        <div className="text-[11px] text-red">not connected<br /><span className="text-dim text-[10px]">{(data as {reason?: string})?.reason}</span></div>
      ) : (
        <div className="flex flex-col gap-2.5">

          {/* Summary bar */}
          <div className="flex justify-between items-end">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-dim uppercase tracking-widest">Equity</span>
                <button
                  onClick={toggle}
                  className="text-[9px] uppercase tracking-widest text-dim hover:text-cyan transition-colors leading-none"
                  title={hidden ? "Show balances" : "Hide balances"}
                  aria-label={hidden ? "Show balances" : "Hide balances"}
                >
                  {hidden ? "[show]" : "[hide]"}
                </button>
              </div>
              <div className="text-2xl text-cyan glow-text font-mono leading-none">
                {hidden ? MASK : `$${fmt(data.equityValue)}`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-dim uppercase tracking-widest">Total P&amp;L</div>
              <div className="text-sm font-mono" style={{ color: hidden ? "#6b7280" : pnlColor(data.totalPnl) }}>
                {hidden ? MASK : `${data.totalPnl >= 0 ? "+" : ""}$${fmt(Math.abs(data.totalPnl))}`}
              </div>
              <div className="text-[10px]" style={{ color: pnlColor(data.totalPnlPct) }}>
                {pct(data.totalPnlPct)}
              </div>
            </div>
          </div>

          {/* Crypto row */}
          <div className="flex justify-between text-[10px] text-dim border-t border-edge pt-1.5">
            <span>Crypto</span>
            <span className="text-fg">{hidden ? MASK : `$${fmt(data.cryptoValue)}`}</span>
          </div>

          {/* Top positions */}
          <div className="flex flex-col gap-1 border-t border-edge pt-1.5">
            <div className="text-[9px] uppercase tracking-widest text-dim mb-0.5">Positions</div>
            {data.positions.slice(0, 8).map(p => (
              <div key={p.symbol} className="flex items-center gap-1 text-[10px]">
                <span className="text-cyan w-11 shrink-0 font-mono">{p.symbol}</span>
                <span className="text-dim w-12 shrink-0">${fmt(p.price, p.price < 10 ? 3 : 2)}</span>
                <div className="flex-1 flex justify-between">
                  <span className="text-fg">{hidden ? MASK : `$${fmt(p.value, 0)}`}</span>
                  <span style={{ color: pnlColor(p.pnlPct) }}>{pct(p.pnlPct)}</span>
                </div>
              </div>
            ))}
          </div>
          {(data as { note?: string }).note && (
            <p className="mt-1 text-[9px] uppercase tracking-widest text-amber">
              ⚠ {(data as { note?: string }).note}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
