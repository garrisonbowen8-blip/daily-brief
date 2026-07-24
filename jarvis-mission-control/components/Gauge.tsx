"use client";

// Stark reactor dial — 270° arc gauge with a tick ring, sweeping value arc,
// counter-rotating outer ring, and a glowing numeral. value 0–100.
export default function Gauge({
  value,
  label,
  detail,
}: {
  value: number;
  label: string;
  detail?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const SIZE = 96;
  const C = SIZE / 2;
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75; // 270°
  const filled = arc * (clamped / 100);
  const color =
    clamped > 90 ? "var(--color-red)" : clamped > 70 ? "var(--color-amber)" : "var(--color-cyan)";

  // tick marks around the 270° sweep
  const ticks = Array.from({ length: 28 }, (_, i) => {
    const a = (135 + (i / 27) * 270) * (Math.PI / 180);
    const on = i / 27 <= clamped / 100;
    const r1 = 40;
    const r2 = i % 4 === 0 ? 45 : 43;
    return {
      x1: C + Math.cos(a) * r1,
      y1: C + Math.sin(a) * r1,
      x2: C + Math.cos(a) * r2,
      y2: C + Math.sin(a) * r2,
      on,
    };
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* slow-rotating outer decorative ring */}
          <g
            style={{ transformOrigin: "center", animation: "gauge-spin 18s linear infinite" }}
          >
            <circle
              cx={C} cy={C} r={44} fill="none"
              stroke="var(--color-edge)" strokeWidth="0.75"
              strokeDasharray="2 6"
            />
          </g>

          {/* tick ring */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.on ? color : "var(--color-edge)"}
              strokeWidth={i % 4 === 0 ? 1.4 : 0.8}
              style={{ transition: "stroke 0.5s ease" }}
            />
          ))}

          {/* track + value arc */}
          <g transform={`rotate(135 ${C} ${C})`}>
            <circle
              cx={C} cy={C} r={r} fill="none"
              stroke="var(--color-edge)" strokeWidth="4"
              strokeDasharray={`${arc} ${circumference}`}
              strokeLinecap="round"
            />
            <circle
              cx={C} cy={C} r={r} fill="none"
              stroke={color} strokeWidth="4"
              strokeDasharray={`${filled} ${circumference}`}
              strokeLinecap="round"
              style={{
                transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease",
                filter: `drop-shadow(0 0 4px ${color})`,
              }}
            />
          </g>

          {/* inner hairline circle */}
          <circle cx={C} cy={C} r={24} fill="none" stroke="var(--color-edge)" strokeWidth="0.5" opacity="0.6" />

          <text
            x={C} y={C - 1} textAnchor="middle" dominantBaseline="middle"
            fill="var(--color-fg)" fontSize="17" fontFamily="inherit"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          >
            {Math.round(clamped)}
          </text>
          <text
            x={C} y={C + 13} textAnchor="middle" dominantBaseline="middle"
            fill="var(--color-dim)" fontSize="7" fontFamily="inherit"
            letterSpacing="1"
          >
            %
          </text>
        </svg>
      </div>
      <span className="text-[10px] uppercase tracking-[0.2em] text-dim">{label}</span>
      {detail && <span className="text-[10px] text-cyan glow-text">{detail}</span>}
    </div>
  );
}
