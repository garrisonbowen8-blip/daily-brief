"use client";

// 270° arc gauge, value 0–100
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
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75;
  const filled = arc * (clamped / 100);
  const color =
    clamped > 90 ? "var(--color-red)" : clamped > 70 ? "var(--color-amber)" : "var(--color-cyan)";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <g transform="rotate(135 36 36)">
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke="var(--color-edge)" strokeWidth="5"
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease" }}
          />
        </g>
        <text
          x="36" y="38" textAnchor="middle" dominantBaseline="middle"
          fill="var(--color-fg)" fontSize="13" fontFamily="inherit"
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="text-[10px] uppercase tracking-widest text-dim">{label}</span>
      {detail && <span className="text-[10px] text-cyan">{detail}</span>}
    </div>
  );
}
