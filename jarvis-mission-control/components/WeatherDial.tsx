"use client";

import Panel from "./Panel";
import { useConnector } from "@/lib/useConnector";

type WeatherData = {
  place: string;
  temp: number;
  condition: string;
  wind: number;
  humidity: number;
  hi: number;
  lo: number;
};

// Reactor-ring temperature dial, Stark-style.
export default function WeatherDial() {
  const { data, loading } = useConnector<WeatherData>("/api/weather", 900_000); // 15 min

  const SIZE = 120;
  const C = SIZE / 2;
  // map temp 20–110°F onto the 270° sweep
  const t = Math.max(20, Math.min(110, data?.temp ?? 60));
  const frac = (t - 20) / 90;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const filled = arc * frac;
  const color = t >= 85 ? "var(--color-red)" : t <= 40 ? "var(--color-cyan)" : "var(--color-amber)";

  const ticks = Array.from({ length: 28 }, (_, i) => {
    const a = (135 + (i / 27) * 270) * (Math.PI / 180);
    const on = i / 27 <= frac;
    const r2 = i % 4 === 0 ? 57 : 55;
    return {
      x1: C + Math.cos(a) * 52, y1: C + Math.sin(a) * 52,
      x2: C + Math.cos(a) * r2, y2: C + Math.sin(a) * r2, on,
    };
  });

  return (
    <Panel title="Weather" status={loading ? undefined : data?.connected ? "online" : "offline"}>
      {loading ? (
        <div className="text-[11px] text-dim blink">reading skies…</div>
      ) : !data?.connected ? (
        <div className="text-[11px] text-dim">
          <span className="text-red">not connected</span>
          <p className="mt-1 opacity-80">{(data as { reason?: string })?.reason}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
            <g style={{ transformOrigin: "center", animation: "gauge-spin 22s linear infinite" }}>
              <circle cx={C} cy={C} r={56} fill="none" stroke="var(--color-edge)" strokeWidth="0.6" strokeDasharray="2 7" />
            </g>
            {ticks.map((k, i) => (
              <line key={i} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2}
                stroke={k.on ? color : "var(--color-edge)"} strokeWidth={i % 4 === 0 ? 1.3 : 0.7}
                style={{ transition: "stroke 0.5s" }} />
            ))}
            <g transform={`rotate(135 ${C} ${C})`}>
              <circle cx={C} cy={C} r={r} fill="none" stroke="var(--color-edge)" strokeWidth="4"
                strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
              <circle cx={C} cy={C} r={r} fill="none" stroke={color} strokeWidth="4"
                strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s ease", filter: `drop-shadow(0 0 4px ${color})` }} />
            </g>
            <text x={C} y={C - 2} textAnchor="middle" dominantBaseline="middle"
              fill="var(--color-fg)" fontSize="26" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
              {data.temp}°
            </text>
            <text x={C} y={C + 16} textAnchor="middle" fill="var(--color-dim)" fontSize="7.5" letterSpacing="1">
              {data.condition.toUpperCase()}
            </text>
          </svg>
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="text-cyan glow-text">{data.place}</div>
            <div className="text-dim">H {data.hi}° · L {data.lo}°</div>
            <div className="text-dim">wind {data.wind} mph</div>
            <div className="text-dim">humidity {data.humidity}%</div>
          </div>
        </div>
      )}
    </Panel>
  );
}
