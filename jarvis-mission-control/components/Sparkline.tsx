"use client";

export default function Sparkline({
  data,
  width = 120,
  height = 28,
  max,
  color = "var(--color-cyan)",
}: {
  data: number[];
  width?: number;
  height?: number;
  max?: number; // fixed ceiling; defaults to max of data
  color?: string;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} className="opacity-30 text-[9px]">…</div>;
  }
  const ceil = Math.max(max ?? Math.max(...data), 1e-9);
  const step = width / (data.length - 1);
  const pts = data
    .map((v, i) => `${i * step},${height - (Math.min(v, ceil) / ceil) * (height - 2) - 1}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="block">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}
