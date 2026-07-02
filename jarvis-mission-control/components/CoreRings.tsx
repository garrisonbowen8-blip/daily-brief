"use client";

import { useEffect, useState } from "react";
import { onVoiceState, VoiceState } from "@/lib/voiceState";

// Mark II reactor rings — concentric segmented data arcs radiating from the
// hologram. Pure SVG, counter-rotating at different speeds; the accent ring
// tracks the voice state color. Decorative: pointer-events off.

const STATE_COLORS: Record<VoiceState, string> = {
  idle: "#2de2e6",
  listening: "#ff4f5e",
  thinking: "#ffb347",
  speaking: "#7ae6ff",
};

const SIZE = 680;
const C = SIZE / 2;

// arc path helper: circle segment from a0..a1 degrees at radius r
function arc(r: number, a0: number, a1: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x0 = C + r * Math.cos(rad(a0));
  const y0 = C + r * Math.sin(rad(a0));
  const x1 = C + r * Math.cos(rad(a1));
  const y1 = C + r * Math.sin(rad(a1));
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

// ring spec: radius, arc segments [start,end], width, speed(s), direction
const RINGS: {
  r: number;
  segs: [number, number][];
  w: number;
  dur: number;
  rev?: boolean;
  o: number;
  accent?: boolean;
}[] = [
  { r: 216, segs: [[0, 70], [95, 130], [150, 245], [265, 330]], w: 2, dur: 46, o: 0.4 },
  { r: 236, segs: [[30, 34], [40, 44], [50, 54], [180, 184], [190, 194]], w: 5, dur: 34, rev: true, o: 0.5 },
  { r: 256, segs: [[0, 150], [170, 200], [230, 350]], w: 1, dur: 70, o: 0.3 },
  { r: 278, segs: [[10, 95], [200, 260]], w: 3, dur: 55, rev: true, o: 0.35, accent: true },
  { r: 300, segs: [[0, 20], [30, 50], [60, 80], [90, 110], [120, 140], [150, 170], [180, 200], [210, 230], [240, 260], [270, 290], [300, 320], [330, 350]], w: 1, dur: 90, o: 0.25 },
  { r: 322, segs: [[45, 180], [225, 300]], w: 0.75, dur: 120, rev: true, o: 0.22 },
];

export default function CoreRings() {
  const [state, setState] = useState<VoiceState>("idle");
  useEffect(() => onVoiceState(setState), []);
  const accent = STATE_COLORS[state];

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    >
      {RINGS.map((ring, i) => (
        <g
          key={i}
          style={{
            transformOrigin: "center",
            animation: `${ring.rev ? "ring-spin-rev" : "ring-spin"} ${ring.dur}s linear infinite`,
          }}
        >
          {ring.segs.map((s, j) => (
            <path
              key={j}
              d={arc(ring.r, s[0], s[1])}
              fill="none"
              stroke={ring.accent ? accent : "#2de2e6"}
              strokeWidth={ring.w}
              strokeLinecap="round"
              opacity={ring.o}
              style={
                ring.accent
                  ? { transition: "stroke 0.6s ease", filter: `drop-shadow(0 0 4px ${accent})` }
                  : undefined
              }
            />
          ))}
        </g>
      ))}
      {/* orbit dots */}
      <g style={{ transformOrigin: "center", animation: "ring-spin 28s linear infinite" }}>
        {[0, 120, 240].map((a) => (
          <circle
            key={a}
            cx={C + 246 * Math.cos((a * Math.PI) / 180)}
            cy={C + 246 * Math.sin((a * Math.PI) / 180)}
            r={2.4}
            fill={accent}
            opacity={0.8}
            style={{ transition: "fill 0.6s ease", filter: `drop-shadow(0 0 5px ${accent})` }}
          />
        ))}
      </g>
    </svg>
  );
}
