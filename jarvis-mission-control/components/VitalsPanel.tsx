"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "./Panel";
import Gauge from "./Gauge";
import Sparkline from "./Sparkline";

type SystemSnapshot = {
  ok: boolean;
  ts: number;
  hostname: string;
  platform: string;
  cpu: { load: number; cores: number; perCore: number[] };
  mem: { used: number; total: number };
  disk: { used: number; total: number; mount: string } | null;
  uptime: number;
  net: { iface: string; rxSec: number; txSec: number } | null;
};

const HISTORY = 60; // 2 minutes at 2s polling

function fmtBytes(b: number, perSec = false) {
  const units = perSec ? ["B/s", "KB/s", "MB/s", "GB/s"] : ["B", "KB", "MB", "GB", "TB"];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

export default function VitalsPanel() {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null);
  const [error, setError] = useState(false);
  const cpuHist = useRef<number[]>([]);
  const rxHist = useRef<number[]>([]);
  const txHist = useRef<number[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/system", { cache: "no-store" });
        const data: SystemSnapshot = await res.json();
        if (!alive) return;
        if (!data.ok) throw new Error();
        setSnap(data);
        setError(false);
        const push = (arr: number[], v: number) => {
          arr.push(v);
          if (arr.length > HISTORY) arr.shift();
        };
        push(cpuHist.current, data.cpu.load);
        if (data.net && data.net.rxSec >= 0) {
          push(rxHist.current, data.net.rxSec);
          push(txHist.current, data.net.txSec);
        }
        force((n) => n + 1);
      } catch {
        if (alive) setError(true);
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Panel title="System Vitals" status={error ? "offline" : snap ? "online" : undefined}>
      {!snap ? (
        <div className="text-xs text-dim blink">acquiring telemetry…</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-around">
            <Gauge
              value={snap.cpu.load}
              label="CPU"
              detail={`${snap.cpu.cores} cores`}
            />
            <Gauge
              value={(snap.mem.used / snap.mem.total) * 100}
              label="RAM"
              detail={`${fmtBytes(snap.mem.used)} / ${fmtBytes(snap.mem.total)}`}
            />
            {snap.disk && (
              <Gauge
                value={(snap.disk.used / snap.disk.total) * 100}
                label="Disk"
                detail={`${fmtBytes(snap.disk.used)} / ${fmtBytes(snap.disk.total)}`}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="border border-edge rounded p-2">
              <div className="text-dim uppercase tracking-widest mb-1">CPU load</div>
              <Sparkline data={cpuHist.current} max={100} />
            </div>
            <div className="border border-edge rounded p-2">
              <div className="flex justify-between text-dim uppercase tracking-widest mb-1">
                <span>Net {snap.net?.iface ?? ""}</span>
                <span className="text-cyan normal-case tracking-normal">
                  ↓{snap.net && snap.net.rxSec >= 0 ? fmtBytes(snap.net.rxSec, true) : "—"}{" "}
                  ↑{snap.net && snap.net.txSec >= 0 ? fmtBytes(snap.net.txSec, true) : "—"}
                </span>
              </div>
              <div className="flex gap-1">
                <Sparkline data={rxHist.current} width={56} />
                <Sparkline data={txHist.current} width={56} color="var(--color-amber)" />
              </div>
            </div>
          </div>

          <div className="flex justify-between text-[10px] text-dim">
            <span>{snap.hostname} · {snap.platform}</span>
            <span>up {fmtUptime(snap.uptime)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
