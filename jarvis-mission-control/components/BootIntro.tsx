"use client";

import { useEffect, useState } from "react";

// Cinematic "JARVIS coming online" sequence on load. Plays a Higgsfield-rendered
// clip from /public/jarvis-intro.mp4 if it exists; otherwise a boot sequence
// with typed status lines. Shows once per browser session; click to skip.

const LINES = [
  "initializing arc reactor core…",
  "loading neural interface…",
  "syncing mission control systems…",
  "connecting live data feeds…",
  "J.A.R.V.I.S. online.",
];

export default function BootIntro() {
  const [show, setShow] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("jarvis-booted")) return;
    sessionStorage.setItem("jarvis-booted", "1");
    setShow(true);
    fetch("/jarvis-intro.mp4", { method: "HEAD" })
      .then((r) => setHasVideo(r.ok))
      .catch(() => setHasVideo(false));
  }, []);

  // typed boot lines, then fade out
  useEffect(() => {
    if (!show || hasVideo) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setVisibleLines(i);
      if (i < LINES.length) {
        timer = setTimeout(tick, i === LINES.length - 1 ? 500 : 320);
      } else {
        timer = setTimeout(() => setExiting(true), 600);
        setTimeout(() => setShow(false), 1200);
      }
    };
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [show, hasVideo]);

  if (!show) return null;

  return (
    <div
      onClick={() => setShow(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg cursor-pointer"
      style={{ animation: exiting ? "boot-exit 0.5s ease forwards" : undefined }}
    >
      {hasVideo ? (
        <video
          src="/jarvis-intro.mp4"
          autoPlay
          muted
          playsInline
          onEnded={() => setShow(false)}
          className="max-h-full max-w-full"
        />
      ) : (
        <div className="flex flex-col items-center gap-8">
          <div className="boot-ring" />
          <div className="text-cyan tracking-[0.5em] text-sm uppercase glow-text boot-text">
            J.A.R.V.I.S
          </div>
          <div className="flex flex-col gap-1.5 min-h-[110px] w-64">
            {LINES.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className={`text-[10px] tracking-widest ${
                  i === LINES.length - 1 ? "text-cyan glow-text" : "text-dim"
                }`}
                style={{ animation: "boot-line 0.3s ease both" }}
              >
                {i === LINES.length - 1 ? "▸ " : "· "}
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
      <span className="absolute bottom-6 right-8 text-[10px] uppercase tracking-widest text-dim">
        click to skip
      </span>
    </div>
  );
}
