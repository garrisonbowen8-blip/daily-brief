"use client";

// Faint animated connector traces radiating from the center — the "circuit"
// tying the console together. Purely decorative, fixed behind all content,
// pointer-events off. Kept subtle so it reads as atmosphere, not clutter.
export default function HudConnectors() {
  const cx = 50;
  const cy = 42;
  // endpoints roughly under the flanking panel columns
  const targets = [
    [6, 12], [4, 40], [7, 72], [20, 90],
    [94, 12], [96, 40], [93, 72], [80, 90],
  ];

  return (
    <svg
      className="fixed inset-0 -z-10 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      aria-hidden
    >
      <defs>
        <radialGradient id="hub" cx="50%" cy="42%" r="8%">
          <stop offset="0%" stopColor="rgba(45,226,230,0.5)" />
          <stop offset="100%" stopColor="rgba(45,226,230,0)" />
        </radialGradient>
      </defs>
      {targets.map(([x, y], i) => {
        // elbowed (manhattan) path for a circuit feel
        const midX = (cx + x) / 2;
        const d = `M ${cx} ${cy} L ${midX} ${cy} L ${midX} ${y} L ${x} ${y}`;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="rgba(45,226,230,0.16)"
            strokeWidth="0.15"
            strokeDasharray="1.5 2.5"
            style={{ animation: `dash-flow ${8 + i}s linear infinite` }}
          />
        );
      })}
      <circle cx={cx} cy={cy} r="9" fill="url(#hub)" />
    </svg>
  );
}
