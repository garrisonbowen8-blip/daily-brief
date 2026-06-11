"use client";

import Panel from "./Panel";
import { useConnector, timeAgo } from "@/lib/useConnector";

type Bucket = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  messages: number;
};

type UsageData = {
  sessions30d: number;
  lastActive: string | null;
  totals: { today: Bucket; week: Bucket; month: Bucket };
  byModel: Record<string, Bucket>;
};

function fmtTokens(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

const total = (b: Bucket) => b.input + b.output + b.cacheRead + b.cacheWrite;

export default function ClaudeUsageTile() {
  const { data, loading } = useConnector<UsageData>("/api/claude-usage", 300_000);

  return (
    <Panel
      title="Claude Usage"
      status={loading ? undefined : data?.connected ? "online" : "offline"}
    >
      {loading ? (
        <div className="text-[11px] text-dim blink">parsing transcripts…</div>
      ) : !data?.connected ? (
        <div className="text-[11px] text-dim">
          <span className="text-red">not connected</span>
          <p className="mt-1 opacity-80">{data?.reason}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-[11px]">
          <div className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["today", data.totals.today],
                ["7 days", data.totals.week],
                ["30 days", data.totals.month],
              ] as const
            ).map(([label, b]) => (
              <div key={label}>
                <div className="text-lg text-cyan glow-text">{fmtTokens(total(b))}</div>
                <div className="text-[9px] uppercase tracking-widest text-dim">
                  tok · {label}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-dim">
            <span>{data.totals.week.messages} msgs / 7d</span>
            <span>{data.sessions30d} sessions / 30d</span>
            {data.lastActive && <span>active {timeAgo(data.lastActive)} ago</span>}
          </div>
          <div className="flex flex-col gap-1">
            {Object.entries(data.byModel)
              .sort((a, b) => total(b[1]) - total(a[1]))
              .slice(0, 4)
              .map(([model, b]) => {
                const max = Math.max(
                  ...Object.values(data.byModel).map((x) => total(x)),
                  1
                );
                return (
                  <div key={model} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 truncate text-dim">
                      {model.replace(/^claude-/, "")}
                    </span>
                    <div className="flex-1 h-1.5 rounded bg-edge overflow-hidden">
                      <div
                        className="h-full bg-cyan opacity-70"
                        style={{ width: `${(total(b) / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-right">{fmtTokens(total(b))}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </Panel>
  );
}
