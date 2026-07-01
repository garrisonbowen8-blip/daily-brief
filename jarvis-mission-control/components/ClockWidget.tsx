"use client";

import { useEffect, useState } from "react";

export default function ClockWidget() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  const day = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col items-center gap-0.5 py-3 select-none">
      <div className="text-[9px] uppercase tracking-[0.4em] text-dim">{day}</div>
      <div
        className="font-mono text-cyan glow-text leading-none"
        style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", letterSpacing: "0.08em" }}
      >
        {hh}<span className="opacity-50 animate-pulse">:</span>{mm}
        <span className="text-[0.55em] opacity-40 ml-1">{ss}</span>
      </div>
      <div className="text-[10px] text-dim tracking-widest">{date}</div>
    </div>
  );
}
