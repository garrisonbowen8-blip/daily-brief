"use client";

import { useEffect, useState } from "react";
import Panel from "./Panel";

// Big date numeral inside a progress ring showing how far through the month
// we are — the "30 / March" calendar dial from the Stark HUD.
export default function DateDial() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <Panel title="Date">
        <div className="text-[11px] text-dim blink">…</div>
      </Panel>
    );
  }

  const day = now.getDate();
  const month = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const frac = day / daysInMonth;

  const SIZE = 120;
  const C = SIZE / 2;
  const r = 46;
  const circ = 2 * Math.PI * r;
  const filled = circ * frac;

  return (
    <Panel title="Date" status="online">
      <div className="flex items-center gap-3">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
          {/* full progress ring (starts at top) */}
          <g transform={`rotate(-90 ${C} ${C})`}>
            <circle cx={C} cy={C} r={r} fill="none" stroke="var(--color-edge)" strokeWidth="3" />
            <circle
              cx={C} cy={C} r={r} fill="none" stroke="var(--color-cyan)" strokeWidth="3"
              strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.8s ease", filter: "drop-shadow(0 0 4px var(--color-cyan))" }}
            />
          </g>
          <g style={{ transformOrigin: "center", animation: "gauge-spin 30s linear infinite" }}>
            <circle cx={C} cy={C} r={54} fill="none" stroke="var(--color-edge)" strokeWidth="0.6" strokeDasharray="1.5 8" />
          </g>
          <text x={C} y={C - 2} textAnchor="middle" dominantBaseline="middle"
            fill="var(--color-fg)" fontSize="34" className="glow-text"
            style={{ filter: "drop-shadow(0 0 8px var(--color-cyan))" }}>
            {day}
          </text>
          <text x={C} y={C + 18} textAnchor="middle" fill="var(--color-cyan)" fontSize="9" letterSpacing="3">
            {month}
          </text>
        </svg>
        <div className="flex flex-col gap-1 text-[11px]">
          <div className="text-cyan glow-text tracking-widest">{weekday}</div>
          <div className="text-dim">day {day} of {daysInMonth}</div>
          <div className="text-dim">{Math.round(frac * 100)}% through {month}</div>
        </div>
      </div>
    </Panel>
  );
}
