"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "./Panel";
import { speak } from "@/lib/speech";
import { fmtTime } from "@/lib/useConnector";
import { onIntent, scrollToPanel } from "@/lib/intents";

type Brief = {
  generatedAt: string;
  day: string;
  training: string;
  priorities: string[];
  script: string;
  calendar: { connected: boolean; events?: { title: string; start: string | null; allDay: boolean }[]; freeUntil?: string | null };
  gmail: { connected: boolean; unread?: number; urgent?: { subject: string }[] };
};

export default function BriefPanel() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const autoRan = useRef(false);

  const run = async (spoken: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/api/brief", { cache: "no-store" });
      const data: Brief = await res.json();
      setBrief(data);
      if (spoken) await speak(data.script);
    } finally {
      setLoading(false);
    }
  };

  // Voice/console commands: "run my brief" re-runs and speaks it,
  // other intents scroll their panel into view.
  useEffect(
    () =>
      onIntent((intent) => {
        if (intent === "run_brief") run(true);
        else if (intent === "show_vitals") scrollToPanel("System Vitals");
        else if (intent === "buddy_pulse") scrollToPanel("Buddy Check");
        else if (intent === "show_usage") scrollToPanel("Claude Usage");
      }),
    []
  );

  // Every morning at load: auto-run once per day per browser
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const today = new Date().toDateString();
    const spoken = localStorage.getItem("brief-auto-day") !== today;
    if (spoken) localStorage.setItem("brief-auto-day", today);
    run(spoken && new Date().getHours() < 12);
  }, []);

  return (
    <Panel
      title="Daily Brief"
      status={brief ? "online" : undefined}
      className="md:col-span-2"
      actions={
        <>
          <button
            onClick={() => run(false)}
            className="text-[9px] tracking-widest border border-edge rounded px-1.5 py-0.5 text-dim hover:text-cyan hover:border-cyan"
          >
            REFRESH
          </button>
          <button
            onClick={() => run(true)}
            className="text-[9px] tracking-widest border border-cyan rounded px-1.5 py-0.5 text-cyan"
          >
            ▶ BRIEF ME
          </button>
        </>
      }
    >
      {loading && !brief ? (
        <div className="text-xs text-dim blink">compiling brief…</div>
      ) : !brief ? (
        <div className="text-xs text-dim">No brief yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 text-xs">
          <div>
            <div className="text-dim uppercase tracking-widest text-[10px] mb-1">
              Top priorities — {brief.day}
            </div>
            <ol className="flex flex-col gap-1">
              {brief.priorities.map((priority, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-cyan">{String(i + 1).padStart(2, "0")}</span>
                  <span>{priority}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-dim uppercase tracking-widest text-[10px]">Training </span>
              <span className="text-amber">{brief.training}</span>
            </div>
            <div>
              <span className="text-dim uppercase tracking-widest text-[10px]">Schedule </span>
              {brief.calendar.connected ? (
                (brief.calendar.events ?? []).filter((e) => !e.allDay).length === 0 ? (
                  <span className="text-green">clear</span>
                ) : (
                  <span>
                    {(brief.calendar.events ?? [])
                      .filter((e) => !e.allDay)
                      .map((e) => `${fmtTime(e.start)} ${e.title}`)
                      .join(" · ")}
                  </span>
                )
              ) : (
                <span className="text-red">offline</span>
              )}
            </div>
            <div>
              <span className="text-dim uppercase tracking-widest text-[10px]">Inbox </span>
              {brief.gmail.connected ? (
                <span>
                  {brief.gmail.unread} unread
                  {brief.gmail.urgent?.length ? (
                    <span className="text-red"> · {brief.gmail.urgent.length} urgent</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-red">offline</span>
              )}
            </div>
            <p className="text-[10px] text-dim border-t border-edge pt-2">{brief.script}</p>
          </div>
        </div>
      )}
    </Panel>
  );
}
