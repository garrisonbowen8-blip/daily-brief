"use client";

import { useEffect, useState } from "react";

const LINES = [
  "initializing arc reactor core…",
  "loading neural interface…",
  "syncing mission control systems…",
  "connecting live data feeds…",
  "A.T.L.A.S. online.",
];

export default function BootIntro({ onDone }: { onDone: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      setVisibleLines(i);
      if (i < LINES.length) {
        setTimeout(tick, i === LINES.length - 1 ? 500 : 320);
      } else {
        setTimeout(() => setExiting(true), 600);
        setTimeout(onDone, 1100);
      }
    };
    const t = setTimeout(tick, 300);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10"
      style={{
        background: "#04080c",
        animation: exiting ? "boot-exit 0.5s ease forwards" : undefined,
      }}
    >
      {/* Spinning ring */}
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          border: "2px solid transparent",
          borderTopColor: "#2de2e6",
          borderRightColor: "#2de2e644",
          animation: "boot-spin 1.2s linear infinite",
        }} />
        <div style={{
          position: "absolute", inset: 12,
          borderRadius: "50%",
          border: "1px solid transparent",
          borderBottomColor: "#2de2e699",
          animation: "boot-spin 1.8s linear infinite reverse",
        }} />
        <div style={{
          position: "absolute", inset: "50%",
          transform: "translate(-50%, -50%)",
          width: 16, height: 16,
          borderRadius: "50%",
          background: "radial-gradient(circle, #eafcfd, #2de2e6 40%, transparent 70%)",
          boxShadow: "0 0 20px #2de2e6aa",
        }} />
      </div>

      {/* Title */}
      <div
        className="text-xl uppercase text-cyan glow-text"
        style={{ animation: "boot-fade 0.8s ease forwards", letterSpacing: "0.35em" }}
      >
        A.T.L.A.S.
      </div>

      {/* Boot lines */}
      <div className="flex flex-col gap-1.5 text-[11px] text-dim font-mono w-64">
        {LINES.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            style={{ animation: "boot-line 0.25s ease forwards", color: i === visibleLines - 1 ? "#2de2e6" : undefined }}
          >
            <span className="text-cyan-dim mr-2">›</span>{line}
          </div>
        ))}
      </div>
    </div>
  );
}
