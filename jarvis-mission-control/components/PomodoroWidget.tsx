"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Panel from "./Panel";

type Mode = "focus" | "break";
const DURATIONS: Record<Mode, number> = { focus: 25 * 60, break: 5 * 60 };
const LABELS:    Record<Mode, string>  = { focus: "FOCUS",  break: "BREAK"  };
const COLORS:    Record<Mode, string>  = { focus: "#2de2e6", break: "#3ddc84" };

export default function PomodoroWidget() {
  const [mode, setMode]       = useState<Mode>("focus");
  const [remaining, setLeft]  = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback((m: Mode) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setMode(m);
    setLeft(DURATIONS[m]);
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setRunning(false);
          if (mode === "focus") setSessions(s => s + 1);
          const next: Mode = mode === "focus" ? "break" : "focus";
          setMode(next);
          setLeft(DURATIONS[next]);
          return DURATIONS[next];
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  const total    = DURATIONS[mode];
  const progress = 1 - remaining / total;
  const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
  const secs = (remaining % 60).toString().padStart(2, "0");
  const color = COLORS[mode];

  // SVG ring
  const R = 28, C = 32, circ = 2 * Math.PI * R;
  const dash = circ * (1 - progress);

  return (
    <Panel title="Focus Timer">
      <div className="flex items-center gap-4">
        {/* Ring */}
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }}>
            <circle cx={C} cy={C} r={R} fill="none" stroke="#ffffff0f" strokeWidth="3" />
            <circle
              cx={C} cy={C} r={R} fill="none"
              stroke={color} strokeWidth="3"
              strokeDasharray={`${circ}`}
              strokeDashoffset={dash}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.8s linear", filter: `drop-shadow(0 0 4px ${color}88)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-[11px]" style={{ color }}>{mins}:{secs}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color }}>
              {LABELS[mode]}
            </span>
            {sessions > 0 && (
              <span className="text-[9px] text-dim">
                {sessions} {sessions === 1 ? "session" : "sessions"}
              </span>
            )}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setRunning(r => !r)}
              className="flex-1 text-[9px] uppercase tracking-widest border rounded px-2 py-1 transition-colors"
              style={{ borderColor: color, color, background: running ? `${color}18` : "transparent" }}
            >
              {running ? "pause" : "start"}
            </button>
            <button
              onClick={() => reset(mode)}
              className="text-[9px] uppercase tracking-widest border border-edge text-dim rounded px-2 py-1 hover:border-cyan hover:text-cyan transition-colors"
            >
              reset
            </button>
          </div>

          <div className="flex gap-1.5">
            {(["focus", "break"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => reset(m)}
                className="flex-1 text-[9px] uppercase tracking-widest rounded px-1 py-0.5 transition-colors"
                style={{
                  border: `1px solid ${mode === m ? COLORS[m] : "#ffffff18"}`,
                  color:  mode === m ? COLORS[m] : "#ffffff44",
                }}
              >
                {m === "focus" ? "25m" : "5m"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
