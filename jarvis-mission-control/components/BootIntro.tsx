"use client";

import { useEffect, useState } from "react";

// Cinematic "JARVIS coming online" sequence on load. Plays a Higgsfield-rendered
// clip from /public/jarvis-intro.mp4 if it exists; otherwise a CSS boot sweep so
// there's still an intro with zero assets. Shows once per browser session.

export default function BootIntro() {
  const [show, setShow] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("jarvis-booted")) return;
    sessionStorage.setItem("jarvis-booted", "1");
    setShow(true);
    // probe for an intro asset
    fetch("/jarvis-intro.mp4", { method: "HEAD" })
      .then((r) => setHasVideo(r.ok))
      .catch(() => setHasVideo(false));
    // CSS-only intro auto-dismisses; video dismisses on ended/skip
    const t = setTimeout(() => setShow(false), hasVideo ? 12000 : 2600);
    return () => clearTimeout(t);
  }, [hasVideo]);

  if (!show) return null;

  return (
    <div
      onClick={() => setShow(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg cursor-pointer"
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
        <div className="flex flex-col items-center gap-4">
          <div className="boot-ring" />
          <div className="text-cyan tracking-[0.5em] text-sm uppercase glow-text boot-text">
            J.A.R.V.I.S
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-dim boot-text2">
            initializing systems
          </div>
        </div>
      )}
      <span className="absolute bottom-6 right-8 text-[10px] uppercase tracking-widest text-dim">
        click to skip
      </span>
    </div>
  );
}
