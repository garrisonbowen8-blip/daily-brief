"use client";

import { useState } from "react";
import Panel from "./Panel";
import { speak } from "@/lib/speech";
import { askJarvis } from "@/lib/agentClient";

// Clearly-TODO panels: wired-looking UI, stubbed data, every one labeled STUB
// (or LOCKED) in its status chip so nothing reads as real.

export function PlaceholderTile({
  title,
  rows,
  locked = false,
  note,
}: {
  title: string;
  rows: [string, string][];
  locked?: boolean;
  note?: string;
}) {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <Panel title={title} status={locked ? "locked" : "stub"}>
      {locked && !unlocked ? (
        <div className="flex flex-col items-start gap-2 text-[11px]">
          <span className="text-dim">sensitive — manual unlock</span>
          <button
            onClick={() => setUnlocked(true)}
            className="border border-edge rounded px-2 py-1 text-[10px] tracking-widest text-dim hover:text-amber hover:border-amber"
          >
            ⊘ UNLOCK
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-[11px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-dim">{k}</span>
              <span className="opacity-60">{v}</span>
            </div>
          ))}
          {note && <p className="text-[10px] text-amber mt-1">{note}</p>}
        </div>
      )}
    </Panel>
  );
}

export function CommandConsole() {
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<string[]>(["ATLAS command console ready."]);

  const submit = async () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput("");
    setLines((l) => [...l.slice(-8), `> ${cmd}`, "…"]);
    const { reply, note } = await askJarvis(cmd);
    setLines((l) => [...l.filter((x) => x !== "…").slice(-8), reply, ...(note ? [`(${note})`] : [])]);
    speak(reply);
  };

  return (
    <Panel title="Command Console" className="md:col-span-2">
      <div className="flex flex-col gap-2 h-full">
        <div className="flex-1 flex flex-col gap-0.5 text-[11px] min-h-20">
          {lines.map((line, i) => (
            <div key={i} className={line.startsWith(">") ? "text-amber" : "text-fg"}>
              {line}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="text-cyan">❯</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="ask ATLAS anything — calendar, inbox, buddy check, vitals…"
            className="flex-1 bg-transparent outline-none text-[11px] placeholder:text-dim"
          />
        </div>
      </div>
    </Panel>
  );
}

const AGENTS = [
  { name: "brief-runner", desc: "morning brief compiler", state: "idle" },
  { name: "inbox-triage", desc: "Gmail classifier", state: "idle" },
  { name: "buddy-watch", desc: "Buddy Check red-status monitor", state: "slot open" },
  { name: "content-sync", desc: "Porter → weekly report", state: "slot open" },
];

export function AgentsPanel() {
  return (
    <Panel title="Agents" status="stub">
      <div className="flex flex-col gap-1.5 text-[11px]">
        {AGENTS.map((agent) => (
          <div key={agent.name} className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                agent.state === "idle" ? "bg-amber" : "bg-dim"
              }`}
            />
            <span className="text-cyan">{agent.name}</span>
            <span className="text-dim truncate">{agent.desc}</span>
            <span className="ml-auto text-[9px] uppercase tracking-widest text-dim">
              {agent.state}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function TaskQueue() {
  const tasks = [
    ["queued", "Wire Porter MCP credentials"],
    ["queued", "Connect Microsoft 365 connector"],
    ["blocked", "Credit Karma snapshot (manual unlock policy)"],
  ];
  return (
    <Panel title="Task Automation Queue" status="stub">
      <div className="flex flex-col gap-1 text-[11px]">
        {tasks.map(([state, task], i) => (
          <div key={i} className="flex gap-2">
            <span className={`text-[9px] uppercase tracking-widest w-14 shrink-0 ${state === "blocked" ? "text-red" : "text-amber"}`}>
              {state}
            </span>
            <span className="truncate">{task}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function NotificationsFeed() {
  const items = [
    ["now", "Dashboard online — vitals nominal"],
    ["—", "Connector alerts will stream here once wired"],
  ];
  return (
    <Panel title="Notifications" status="stub">
      <div className="flex flex-col gap-1 text-[11px]">
        {items.map(([t, msg], i) => (
          <div key={i} className="flex gap-2">
            <span className="text-dim w-8 shrink-0">{t}</span>
            <span className="truncate">{msg}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function QuickActions({ onBrief }: { onBrief: () => void }) {
  const actions: [string, (() => void) | null][] = [
    ["⚡ New brief", onBrief],
    ["🩺 Run case drill", null],
    ["📊 Swinson numbers", null],
    ["📣 Post status", null],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(([label, fn]) => (
        <button
          key={label}
          onClick={fn ?? (() => speak("That action is still on the bench, sir."))}
          className={`border rounded px-3 py-1.5 text-[10px] uppercase tracking-widest ${
            fn ? "border-cyan text-cyan hover:bg-cyan/10" : "border-edge text-dim hover:text-amber hover:border-amber"
          }`}
        >
          {label}
          {!fn && <span className="ml-1 text-[8px]">stub</span>}
        </button>
      ))}
    </div>
  );
}
