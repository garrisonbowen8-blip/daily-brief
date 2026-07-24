"use client";

import Panel from "./Panel";
import { useConnector } from "@/lib/useConnector";

type Idea = {
  ticker: string;
  name: string;
  thesis: string;
  risk: string;
  horizon: string;
};

type AlphaDeskData = {
  generatedAt?: string;
  marketView?: string;
  ideas?: Idea[];
  disclaimer?: string;
};

export default function AlphaDeskTile() {
  // server caches ~6h; hourly poll just picks up the refresh
  const { data, loading } = useConnector<AlphaDeskData>("/api/alpha-desk", 3_600_000);

  return (
    <Panel
      title="Alpha Desk — Ideas"
      status={loading ? undefined : data?.connected ? "online" : "offline"}
    >
      {loading ? (
        <div className="text-[11px] text-dim blink">reading the market…</div>
      ) : !data?.connected ? (
        <div className="text-[11px] text-dim">
          <span className="text-red">not connected</span>
          <p className="mt-1 opacity-80">{data?.reason}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-[11px]">
          {data.marketView && <p className="text-fg leading-snug">{data.marketView}</p>}
          <div className="flex flex-col gap-2">
            {(data.ideas ?? []).map((idea) => (
              <div key={idea.ticker} className="border-t border-edge pt-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-cyan glow-text font-bold">{idea.ticker}</span>
                  <span className="text-dim truncate">{idea.name}</span>
                  <span className="ml-auto shrink-0 text-[9px] uppercase tracking-widest text-amber">
                    {idea.horizon}
                  </span>
                </div>
                <p className="leading-snug mt-0.5">{idea.thesis}</p>
                <p className="text-dim leading-snug mt-0.5">risk: {idea.risk}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] uppercase tracking-widest text-amber border-t border-edge pt-1.5">
            ⚠ {data.disclaimer}
          </p>
        </div>
      )}
    </Panel>
  );
}
