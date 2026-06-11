"use client";

import { useEffect, useRef, useState } from "react";
import { askJarvis } from "@/lib/agentClient";
import { speak } from "@/lib/speech";
import { getLevel, getVoiceState, onVoiceState, setLevel, setVoiceState, VoiceState } from "@/lib/voiceState";

// The JARVIS entity: an arc-reactor core at the center of the dashboard.
// Click it to talk. It idles with a slow pulse, ripples red with your voice
// while listening, spins amber while the agent thinks, and pulses cyan to
// the live waveform while it speaks.

const COLORS: Record<VoiceState, string> = {
  idle: "#2de2e6",
  listening: "#ff4f5e",
  thinking: "#ffb347",
  speaking: "#2de2e6",
};

const STATUS: Record<VoiceState, string> = {
  idle: "click the core to speak",
  listening: "listening…",
  thinking: "working on it…",
  speaking: "",
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function JarvisCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [exchange, setExchange] = useState<{ you?: string; jarvis?: string }>({});
  const [micError, setMicError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wakeWord, setWakeWord] = useState(false);
  const [supported, setSupported] = useState(true);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef(0);

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return onVoiceState(setState);
  }, []);

  // ── Core animation ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = 280;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const c = size / 2;
    let t = 0;
    let raf = 0;
    let smooth = 0;

    const draw = () => {
      t += 1;
      const s = getVoiceState();
      const color = COLORS[s];
      // live level, or a synthetic pulse when speaking without an analyser
      const raw =
        s === "speaking"
          ? Math.max(getLevel(), 0.25 + 0.15 * Math.sin(t * 0.25) + 0.08 * Math.sin(t * 0.61))
          : s === "listening"
            ? Math.max(getLevel(), 0.12 + 0.05 * Math.sin(t * 0.18))
            : s === "thinking"
              ? 0.18 + 0.06 * Math.sin(t * 0.1)
              : 0.06 + 0.04 * Math.sin(t * 0.045);
      smooth += (raw - smooth) * 0.18;

      ctx.clearRect(0, 0, size, size);

      // outer glow
      const glow = ctx.createRadialGradient(c, c, 20, c, c, c);
      glow.addColorStop(0, `${color}55`);
      glow.addColorStop(0.5, `${color}11`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // rotating segmented rings
      const speed = s === "thinking" ? 0.05 : 0.012;
      for (let ring = 0; ring < 3; ring++) {
        const r = 66 + ring * 18 + smooth * 14 * (ring + 1) * 0.4;
        const segs = 3 + ring * 2;
        const dir = ring % 2 === 0 ? 1 : -1;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.55 - ring * 0.14;
        ctx.lineWidth = 2.5 - ring * 0.6;
        for (let i = 0; i < segs; i++) {
          const a0 = dir * t * speed + (i / segs) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(c, c, r, a0, a0 + (Math.PI * 2) / segs * 0.62);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // waveform ring
      ctx.beginPath();
      for (let i = 0; i <= 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        const wobble =
          Math.sin(a * 7 + t * 0.12) * 4 * smooth + Math.sin(a * 13 - t * 0.07) * 3 * smooth;
        const r = 52 + smooth * 16 + wobble;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.9;
      ctx.stroke();

      // inner core
      const coreR = 30 + smooth * 22;
      const core = ctx.createRadialGradient(c, c, 2, c, c, coreR);
      core.addColorStop(0, "#eafcfd");
      core.addColorStop(0.35, color);
      core.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(c, c, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Mic level while listening ───────────────────────────────────────────
  const startMicLevel = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(Math.min(1, (sum / data.length / 255) * 3));
        micRafRef.current = requestAnimationFrame(loop);
      };
      micRafRef.current = requestAnimationFrame(loop);
    } catch {
      // level metering is cosmetic — recognition still works without it
    }
  };

  const stopMicLevel = () => {
    cancelAnimationFrame(micRafRef.current);
    micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    micStreamRef.current = null;
    setLevel(0);
  };

  // ── Conversation ────────────────────────────────────────────────────────
  const handleUtterance = async (text: string) => {
    setExchange({ you: text });
    setVoiceState("thinking");
    try {
      const { reply, note: n } = await askJarvis(text);
      setNote(n ?? null);
      setExchange({ you: text, jarvis: reply });
      await speak(reply);
    } catch {
      setVoiceState("idle");
      setExchange({ you: text, jarvis: "Something broke on my end, sir. Check the server log." });
    }
  };

  const listen = () => {
    const rec = getRecognition();
    if (!rec) return;
    setMicError(null);
    recRef.current?.stop();
    recRef.current = rec;
    rec.continuous = wakeRef.current;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (wakeRef.current) {
        const m = text.toLowerCase().match(/(?:hey |hej |a )?jarvis[,.]?\s*(.*)/);
        if (!m) return;
        handleUtterance(m[1] || "yes?");
      } else {
        stopMicLevel();
        handleUtterance(text);
      }
    };
    rec.onend = () => {
      if (wakeRef.current) rec.start();
      else {
        stopMicLevel();
        if (getVoiceState() === "listening") setVoiceState("idle");
      }
    };
    rec.onerror = (e) => {
      stopMicLevel();
      setVoiceState("idle");
      const code = e.error ?? "unknown";
      setMicError(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone blocked — click the icon left of the address bar → Microphone → Allow, then reload"
          : code === "no-speech"
            ? "Didn't catch that — click the core and speak"
            : code === "network"
              ? "Speech service unreachable — Chrome's recognizer needs internet"
              : `mic error: ${code}`
      );
    };
    rec.start();
    setVoiceState("listening");
    startMicLevel();
  };

  const stopListening = () => {
    wakeRef.current = false;
    recRef.current?.stop();
    stopMicLevel();
    setVoiceState("idle");
  };

  const onCoreClick = () => {
    if (state === "listening") stopListening();
    else if (state === "idle") listen();
    // ignore clicks while thinking/speaking
  };

  const toggleWake = () => {
    const next = !wakeWord;
    setWakeWord(next);
    wakeRef.current = next;
    if (next) listen();
    else stopListening();
  };

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <canvas
        ref={canvasRef}
        onClick={onCoreClick}
        style={{ width: 280, height: 280, cursor: "pointer" }}
        title="Click to talk to JARVIS"
      />
      <div className="-mt-3 flex flex-col items-center gap-1.5 text-center max-w-xl">
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: COLORS[state] }}>
          {state === "idle" ? "J.A.R.V.I.S online" : state}
        </div>
        {STATUS[state] && <div className="text-[11px] text-dim">{STATUS[state]}</div>}
        {!supported && (
          <div className="text-[11px] text-red">voice needs Chrome or Edge — console below still works</div>
        )}
        {exchange.you && (
          <div className="text-[11px] text-amber">“{exchange.you}”</div>
        )}
        {exchange.jarvis && (
          <div className="text-xs text-fg leading-relaxed">{exchange.jarvis}</div>
        )}
        {micError && <div className="text-[10px] text-red">{micError}</div>}
        {note && <div className="text-[10px] text-amber">{note}</div>}
        <button
          onClick={toggleWake}
          className={`mt-1 text-[9px] tracking-widest border rounded px-2 py-0.5 ${
            wakeWord ? "border-cyan text-cyan" : "border-edge text-dim hover:text-cyan"
          }`}
        >
          “HEY JARVIS” ALWAYS-ON {wakeWord ? "ENABLED" : "OFF"}
        </button>
      </div>
    </div>
  );
}
