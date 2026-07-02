"use client";

import Panel from "./Panel";
import Sparkline from "./Sparkline";
import { useConnector, timeAgo, fmtTime } from "@/lib/useConnector";

function NotConnected({ reason }: { reason?: string }) {
  return (
    <div className="text-[11px] text-dim">
      <span className="text-red">not connected</span>
      {reason ? <p className="mt-1 opacity-80">{reason}</p> : null}
    </div>
  );
}

function Loading() {
  return <div className="text-[11px] text-dim blink">querying…</div>;
}

// ── Gmail ────────────────────────────────────────────────────────────────

type GmailData = {
  unread: number;
  threads: { id: string; subject: string; from: string; snippet: string }[];
  urgent: { id: string; subject: string; from: string }[];
};

export function GmailTile() {
  const { data, loading } = useConnector<GmailData>("/api/gmail", 120_000);
  return (
    <Panel title="Inbox — Gmail" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <Loading />
      ) : !data?.connected ? (
        <NotConnected reason={data?.reason} />
      ) : (
        <div className="flex flex-col gap-2 text-[11px]">
          <div>
            <span className="text-2xl text-cyan glow-text">{data.unread}</span>
            <span className="text-dim"> unread</span>
            {data.urgent.length > 0 && (
              <span className="text-red ml-2">▲ {data.urgent.length} urgent</span>
            )}
          </div>
          {data.urgent.map((u) => (
            <div key={u.id} className="text-red truncate">! {u.from} — {u.subject}</div>
          ))}
          <div className="text-dim uppercase tracking-widest text-[10px]">Needs reply</div>
          {data.threads.length === 0 && <span className="text-green">inbox clear</span>}
          {data.threads.map((t) => (
            <div key={t.id} className="truncate">
              <span className="text-amber">{t.from}</span> <span>{t.subject}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────

type CalendarData = {
  events: { id: string; title: string; start: string | null; allDay: boolean; location: string | null }[];
  freeUntil: string | null;
};

export function CalendarTile() {
  const { data, loading } = useConnector<CalendarData>("/api/calendar", 120_000);
  return (
    <Panel title="Today — Calendar" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <Loading />
      ) : !data?.connected ? (
        <NotConnected reason={data?.reason} />
      ) : (
        <div className="flex flex-col gap-2 text-[11px]">
          <div className="text-dim uppercase tracking-widest text-[10px]">
            Free until{" "}
            <span className="text-green normal-case tracking-normal text-sm">
              {data.freeUntil ? fmtTime(data.freeUntil) : "end of day"}
            </span>
          </div>
          {data.events.length === 0 && <span className="text-green">no events ahead today</span>}
          {data.events.map((e) => (
            <div key={e.id} className="flex gap-2">
              <span className="text-cyan w-16 shrink-0">{e.allDay ? "all-day" : fmtTime(e.start)}</span>
              <span className="truncate">{e.title}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Drive ────────────────────────────────────────────────────────────────

type DriveData = {
  files: { id: string; name: string; modifiedTime: string; link: string }[];
};

export function DriveTile() {
  const { data, loading } = useConnector<DriveData>("/api/drive", 300_000);
  return (
    <Panel title="Drive" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <Loading />
      ) : !data?.connected ? (
        <NotConnected reason={data?.reason} />
      ) : (
        <div className="flex flex-col gap-1 text-[11px]">
          {data.files.map((f) => (
            <a key={f.id} href={f.link} target="_blank" className="flex gap-2 hover:text-cyan">
              <span className="text-dim w-8 shrink-0">{timeAgo(f.modifiedTime)}</span>
              <span className="truncate">{f.name}</span>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Buddy Check (Supabase) ───────────────────────────────────────────────

type PulseData = {
  verifiedUsers: number;
  checkins24h: number;
  activeThreads: number;
  newMatches7d: number;
};

export function SupabaseTile() {
  const { data, loading } = useConnector<PulseData>("/api/supabase", 120_000);
  const stat = (label: string, value: number) => (
    <div className="text-center">
      <div className="text-xl text-cyan glow-text">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-dim">{label}</div>
    </div>
  );
  return (
    <Panel title="Buddy Check Pulse" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <Loading />
      ) : !data?.connected ? (
        <NotConnected reason={data?.reason} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {stat("verified vets", data.verifiedUsers)}
          {stat("check-ins 24h", data.checkins24h)}
          {stat("forum threads", data.activeThreads)}
          {stat("matches 7d", data.newMatches7d)}
        </div>
      )}
    </Panel>
  );
}

// ── Porter Metrics ───────────────────────────────────────────────────────

type PorterData = { result?: unknown };

export function PorterTile() {
  const { data, loading } = useConnector<PorterData>("/api/porter", 300_000);
  return (
    <Panel
      title="Social — Porter Metrics"
      status={loading ? undefined : data?.connected ? "online" : "offline"}
    >
      {loading ? (
        <Loading />
      ) : !data?.connected ? (
        <div className="text-[11px]">
          <NotConnected reason={data?.reason} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center opacity-40">
            {["posts 24h", "posts 7d", "reach"].map((l) => (
              <div key={l}>
                <div className="text-xl">—</div>
                <div className="text-[9px] uppercase tracking-widest">{l}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <pre className="text-[10px] whitespace-pre-wrap break-all">
          {JSON.stringify(data.result, null, 1)}
        </pre>
      )}
    </Panel>
  );
}

// ── Robinhood ────────────────────────────────────────────────────────────

type RobinhoodData = {
  equity: number;
  brokerageEquity: number;
  cryptoEquity: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  afterHours: boolean;
  buyingPower: number | null;
  spark: number[];
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function RobinhoodTile() {
  const { data, loading } = useConnector<RobinhoodData>("/api/robinhood", 120_000);
  // Re-zero the day's curve so intraday moves are visible — raw equity
  // against a 0-floor sparkline renders as a flat line at the top.
  const spark = data?.spark ?? [];
  const floor = spark.length ? Math.min(...spark) : 0;
  const rebased = spark.map((v) => v - floor);
  const up = (data?.dayChange ?? 0) >= 0;

  return (
    <Panel
      title="Portfolio — Robinhood"
      status={loading ? undefined : data?.connected ? "online" : "offline"}
    >
      {loading ? (
        <Loading />
      ) : !data?.connected ? (
        <NotConnected reason={data?.reason} />
      ) : (
        <div className="flex flex-col gap-2 text-[11px]">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl text-cyan glow-text">{usd(data.equity)}</span>
            {data.afterHours && (
              <span className="text-[9px] uppercase tracking-widest text-amber">
                after hours
              </span>
            )}
          </div>
          {data.dayChange != null && (
            <div className={up ? "text-green" : "text-red"}>
              {up ? "▲" : "▼"} {usd(Math.abs(data.dayChange))}
              {data.dayChangePct != null && ` (${Math.abs(data.dayChangePct).toFixed(2)}%)`}
              <span className="text-dim"> today</span>
            </div>
          )}
          {rebased.length > 1 && (
            <Sparkline
              data={rebased}
              width={160}
              color={up ? "var(--color-green)" : "var(--color-red)"}
            />
          )}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-2">
              <span className="text-dim">brokerage</span>
              <span>{usd(data.brokerageEquity)}</span>
            </div>
            {data.cryptoEquity != null && (
              <div className="flex justify-between gap-2">
                <span className="text-dim">crypto</span>
                <span>{usd(data.cryptoEquity)}</span>
              </div>
            )}
            {data.buyingPower != null && (
              <div className="flex justify-between gap-2">
                <span className="text-dim">buying power</span>
                <span className="text-amber">{usd(data.buyingPower)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Obsidian ─────────────────────────────────────────────────────────────

type ObsidianData = {
  noteCount: number;
  openTasks: number;
  recentNotes: { name: string; modified: string }[];
  graphics: { name: string; modified: string }[];
};

export function ObsidianTile() {
  const { data, loading } = useConnector<ObsidianData>("/api/obsidian", 300_000);
  return (
    <Panel title="Obsidian Vault" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <Loading />
      ) : !data?.connected ? (
        <NotConnected reason={data?.reason} />
      ) : (
        <div className="flex flex-col gap-2 text-[11px]">
          <div className="flex gap-4">
            <span><span className="text-cyan text-lg">{data.noteCount}</span> <span className="text-dim">notes</span></span>
            <span><span className="text-amber text-lg">{data.openTasks}</span> <span className="text-dim">open tasks</span></span>
          </div>
          {data.recentNotes.map((n) => (
            <div key={n.name} className="flex gap-2">
              <span className="text-dim w-8 shrink-0">{timeAgo(n.modified)}</span>
              <span className="truncate">{n.name}</span>
            </div>
          ))}
          {data.graphics.length > 0 && (
            <>
              <div className="text-dim uppercase tracking-widest text-[10px]">Canvas / graphics</div>
              {data.graphics.slice(0, 3).map((g) => (
                <div key={g.name} className="truncate text-cyan-dim">▦ {g.name}</div>
              ))}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
