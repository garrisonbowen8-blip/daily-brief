"use client";

import { useEffect } from "react";

// Registers the service worker so the dashboard is installable as a standalone
// app on desktop and phone. No-op SW (network passthrough) — install only.
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
