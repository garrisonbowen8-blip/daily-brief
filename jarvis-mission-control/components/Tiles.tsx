"use client";

import { useCallback, useState } from "react";
import Panel from "./Panel";
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
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // ✕ = "doesn't need me / flagged wrong" — JARVIS stops reading it everywhere
  const dismiss = (threadId: string) => {
    setHidden((h) => new Set(h).add(threadId));
    fetch("/api/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });
  };

  const row = (t: { id: string; from: string; subject: string }, urgent: boolean) => (
    <div key={t.id} className="group flex items-center gap-1">
      <span className={`truncate flex-1 ${urgent ? "text-red" : ""}`}>
        {urgent && "! "}
        <span className={urgent ? "" : "text-amber"}>{t.from}</span> {t.subject}
      </span>
      <button
        onClick={() => dismiss(t.id)}
        title="Doesn't need me — stop surfacing this"
        className="shrink-0 text-dim opacity-0 group-hover:opacity-100 hover:text-red px-1"
      >
        ✕
      </button>
    </div>
  );

  const threads = (data?.threads ?? []).filter((t) => !hidden.has(t.id));
  const urgent = (data?.urgent ?? []).filter((t) => !hidden.has(t.id));

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
            {urgent.length > 0 && (
              <span className="text-red ml-2">▲ {urgent.length} urgent</span>
            )}
          </div>
          {urgent.map((u) => row(u, true))}
          <div className="text-dim uppercase tracking-widest text-[10px]">Needs reply</div>
          {threads.length === 0 && <span className="text-green">inbox clear</span>}
          {threads.map((t) => row(t, false))}
        </div>
      )}
    </Panel>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────

type CalendarData = {
  events: { id: string; title: string; start: string | null; allDay: boolean; location: string | null }[];
  upcoming?: { id: string; title: string; start: string | null }[];
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
          {(data.upcoming?.length ?? 0) > 0 && (
            <>
              <div className="text-dim uppercase tracking-widest text-[10px] mt-1">Next 30 days</div>
              {data.upcoming!.slice(0, 4).map((e) => (
                <div key={e.id} className="flex gap-2">
                  <span className="text-cyan-dim w-16 shrink-0">
                    {e.start
                      ? new Date(e.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : ""}
                  </span>
                  <span className="truncate text-dim">{e.title}</span>
                </div>
              ))}
            </>
          )}
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
// ── Reminders ─────────────────────────────────────────────────────────────

type Reminder = {
  list: string;
  name: string;
  due: string | null;
  overdue: boolean;
  dueToday: boolean;
};

type RemindersData = { reminders: Reminder[] };

function relDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff === -1) return "yesterday";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return `in ${diff}d`;
}

export function RemindersTile() {
  const { data, loading, refresh } = useConnector<RemindersData>("/api/reminders", 60_000);
  // completing: showing the checkmark tick animation
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  // dismissed: permanently removed from display (optimistic — instant removal)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const complete = useCallback(async (list: string, name: string) => {
    const key = `${list}|${name}`;
    if (dismissed.has(key)) return;
    // Show checkmark briefly, then remove from list
    setCompleting(prev => new Set([...prev, key]));
    setTimeout(() => {
      setDismissed(prev => new Set([...prev, key]));
      setCompleting(prev => { const n = new Set(prev); n.delete(key); return n; });
    }, 500);
    // Fire the server update in background
    fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list, name }),
    }).then(() => {
      // Refresh after Apple Reminders has had time to persist it
      setTimeout(() => refresh(), 2000);
    });
  }, [dismissed, refresh]);

  // Filter out items the user has already dismissed this session
  const allReminders = (data?.reminders ?? []).filter(r => !dismissed.has(`${r.list}|${r.name}`));
  const overdue  = allReminders.filter(r => r.overdue);
  const today    = allReminders.filter(r => r.dueToday && !r.overdue);
  const upcoming = allReminders.filter(r => r.due && !r.overdue && !r.dueToday).slice(0, 5);
  const noDue    = allReminders.filter(r => !r.due).slice(0, 3);

  const Row = ({ r }: { r: Reminder }) => {
    const key = `${r.list}|${r.name}`;
    const done = completing.has(key);
    return (
      <button
        onClick={() => complete(r.list, r.name)}
        className="flex items-start gap-2 text-left group w-full"
        title="Mark complete"
      >
        <div className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-sm border transition-all ${
          done ? "border-green bg-green/20" : "border-edge group-hover:border-cyan"
        } flex items-center justify-center`}>
          {done && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 4l2 2 4-4" stroke="#3ddc84" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div className={`flex-1 min-w-0 ${done ? "opacity-40 line-through" : ""}`}>
          <div className="text-[11px] text-fg truncate">{r.name}</div>
          <div className="text-[9px] text-dim flex gap-2">
            <span>{r.list}</span>
            {r.due && (
              <span className={r.overdue ? "text-red" : r.dueToday ? "text-amber" : ""}>
                {relDate(r.due)}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Panel title="Reminders" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <div className="text-[11px] text-dim blink">loading…</div>
      ) : !data?.connected ? (
        <div className="text-[11px] text-dim">
          <span className="text-red">not connected</span>
          <p className="mt-1 opacity-80">{(data as { reason?: string })?.reason}</p>
        </div>
      ) : allReminders.length === 0 ? (
        <div className="text-[11px] text-green">all clear</div>
      ) : (
        <div className="flex flex-col gap-2">
          {overdue.length > 0 && (
            <>
              <div className="text-[9px] uppercase tracking-widest text-red">Overdue</div>
              {overdue.map((r, i) => <Row key={i} r={r} />)}
            </>
          )}
          {today.length > 0 && (
            <>
              <div className="text-[9px] uppercase tracking-widest text-amber">Due today</div>
              {today.map((r, i) => <Row key={i} r={r} />)}
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <div className="text-[9px] uppercase tracking-widest text-dim">Upcoming</div>
              {upcoming.map((r, i) => <Row key={i} r={r} />)}
            </>
          )}
          {noDue.length > 0 && (
            <>
              <div className="text-[9px] uppercase tracking-widest text-dim">No date</div>
              {noDue.map((r, i) => <Row key={i} r={r} />)}
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
