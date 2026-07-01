"use client";

import { useEffect, useRef, useState } from "react";
import { speak, stopSpeaking } from "@/lib/speech";
import { initOrb } from "@/lib/orbScene";
import { getVoiceState, onVoiceState, setLevel, setVoiceState, VoiceState } from "@/lib/voiceState";

type Turn = { role: "user" | "assistant"; content: string };
const history: Turn[] = [];

async function askAtlas(text: string, signal?: AbortSignal) {
  history.push({ role: "user", content: text });
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history.slice(-12) }),
    signal,
  });
  const data = await res.json();
  const reply: string = data.reply ?? "Something went wrong on my end, sir.";
  history.push({ role: "assistant", content: reply });
  return { reply, playAfter: data.playAfter ?? null };
}

const COLORS: Record<VoiceState, string> = {
  idle:      "#2de2e6",
  listening: "#ff4f5e",
  thinking:  "#ffb347",
  speaking:  "#2de2e6",
};

const STATUS: Record<VoiceState, string> = {
  idle:      "click the core to speak",
  listening: "listening…",
  thinking:  "thinking…",
  speaking:  "speaking…",
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function getSpeechRec(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function JarvisCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [exchange, setExchange] = useState<{ you?: string; atlas?: string }>({});
  const [micError, setMicError] = useState<string | null>(null);
  const [wakeWord, setWakeWord] = useState(false);
  const [supported, setSupported] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const [orbError, setOrbError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef(0);

  useEffect(() => {
    const hasSpeech = getSpeechRec() !== null;
    setSupported(hasSpeech);
    if (!hasSpeech) setShowInput(true);
    return onVoiceState(setState);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dispose: (() => void) | undefined;
    try {
      dispose = initOrb(canvas, 400);
    } catch {
      setOrbError(true);
    }
    return () => { dispose?.(); };
  }, []);

  const startMicLevel = (stream: MediaStream) => {
    try {
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
    } catch { /* level metering is cosmetic */ }
  };

  const stopMicLevel = () => {
    cancelAnimationFrame(micRafRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setLevel(0);
  };

  const cancelThinking = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    setVoiceState("idle");
  };

  const handleUtterance = async (text: string) => {
    setExchange({ you: text });
    setVoiceState("thinking");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { reply, playAfter } = await askAtlas(text, controller.signal);
      if (controller.signal.aborted) return;
      setExchange({ you: text, atlas: reply });
      setVoiceState("speaking");
      await speak(reply);
      if (playAfter && !controller.signal.aborted) {
        await fetch("/api/music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(playAfter),
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setExchange((prev) => ({ ...prev, atlas: "Something broke on my end, sir." }));
    } finally {
      if (!controller.signal.aborted) setVoiceState("idle");
    }
  };

  const startListening = async () => {
    const rec = getSpeechRec();
    if (!rec) { setShowInput(true); return; }

    setMicError(null);
    recRef.current?.abort();
    recRef.current = rec;
    rec.continuous = wakeRef.current;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (!text) return;
      if (wakeRef.current) {
        const m = text.toLowerCase().match(/(?:hey |a )?atlas[,.]?\s*(.*)/i);
        if (!m) return;
        handleUtterance(m[1].trim() || "yes?");
      } else {
        stopMicLevel();
        handleUtterance(text);
      }
    };

    rec.onend = () => {
      if (wakeRef.current && getVoiceState() === "listening") {
        try { rec.start(); } catch { /* already running */ }
      } else {
        stopMicLevel();
        if (getVoiceState() === "listening") setVoiceState("idle");
      }
    };

    rec.onerror = (e) => {
      stopMicLevel();
      const code = e.error ?? "unknown";
      if (code === "not-allowed" || code === "service-not-allowed") {
        setMicError("Mic blocked. In Chrome: click the lock icon left of the address bar → Microphone → Allow → reload.");
        setShowInput(true);
      } else if (code === "network") {
        setMicError("Chrome speech service unreachable — check your internet connection.");
      } else if (code !== "no-speech" && code !== "aborted") {
        setMicError(`Speech error: ${code}`);
      }
      if (getVoiceState() === "listening") setVoiceState("idle");
    };

    try {
      rec.start();
      setVoiceState("listening");
      // Kick off mic level meter using getUserMedia separately — cosmetic only
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => startMicLevel(stream))
        .catch(() => { /* visualizer is optional */ });
    } catch (e) {
      setMicError(`Could not start recognition: ${e instanceof Error ? e.message : e}`);
    }
  };

  const stopListening = () => {
    wakeRef.current = false;
    recRef.current?.stop();
    stopMicLevel();
    setVoiceState("idle");
  };

  const onCoreClick = () => {
    if (state === "listening") { stopListening(); return; }
    if (state === "thinking" || state === "speaking") { cancelThinking(); return; }
    startListening();
  };

  const toggleWake = () => {
    const next = !wakeWord;
    setWakeWord(next);
    wakeRef.current = next;
    if (next) startListening();
    else stopListening();
  };

  const onTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = inputText.trim();
    if (!t) return;
    setInputText("");
    handleUtterance(t);
  };

  const ring = COLORS[state];

  return (
    <div className="flex flex-col items-center justify-start">

      {/* ── Orb canvas ──────────────────────────────────────────────── */}
      {orbError ? (
        <div
          onClick={onCoreClick}
          className="flex items-center justify-center cursor-pointer"
          style={{ width: 400, height: 400 }}
          title="Click to speak"
        >
          <div className="rounded-full blink" style={{
            width: 180, height: 180,
            background: `radial-gradient(circle, #eafcfd 0%, ${ring} 35%, transparent 70%)`,
            boxShadow: `0 0 80px ${ring}88`,
          }} />
        </div>
      ) : (
        <div style={{ width: 400, height: 400 }}>
          <canvas
            ref={canvasRef}
            onClick={onCoreClick}
            style={{ width: 400, height: 400, cursor: "pointer", display: "block" }}
            title="Click to speak to ATLAS"
          />
        </div>
      )}

      {/* ── Status + controls ───────────────────────────────────────── */}
      <div className="-mt-4 flex flex-col items-center gap-1.5 text-center max-w-sm">
        <div className="text-[10px] uppercase tracking-[0.3em] transition-colors duration-500" style={{ color: ring }}>
          {state === "idle" ? "A.T.L.A.S online" : state}
        </div>

        {STATUS[state] && (
          <div className="text-[11px] text-dim">{STATUS[state]}</div>
        )}

        {state === "thinking" && (
          <button onClick={cancelThinking}
            className="text-[9px] tracking-widest border border-amber text-amber rounded px-2 py-0.5 hover:bg-amber hover:text-black transition-colors">
            CANCEL
          </button>
        )}

        {!supported && (
          <div className="text-[11px] text-amber">voice needs Chrome — type below</div>
        )}

        {exchange.you && (
          <div className="text-[11px] text-amber italic mt-1">"{exchange.you}"</div>
        )}
        {exchange.atlas && (
          <div className="text-xs text-fg leading-relaxed">{exchange.atlas}</div>
        )}

        {micError && (
          <div className="text-[10px] text-red leading-relaxed">{micError}</div>
        )}

        {/* Text input fallback */}
        {showInput ? (
          <form onSubmit={onTextSubmit} className="flex gap-1 mt-1">
            <input
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="type a command…"
              className="bg-transparent border border-edge rounded px-2 py-1 text-[11px] text-fg placeholder:text-dim focus:outline-none focus:border-cyan w-44"
            />
            <button type="submit"
              className="text-[10px] border border-edge rounded px-2 py-1 text-dim hover:text-cyan hover:border-cyan transition-colors">
              send
            </button>
          </form>
        ) : (
          <button onClick={() => setShowInput(true)}
            className="text-[9px] tracking-widest text-dim hover:text-cyan transition-colors">
            type instead
          </button>
        )}

        <button onClick={toggleWake}
          className={`text-[9px] tracking-widest border rounded px-2 py-0.5 transition-colors ${
            wakeWord ? "border-cyan text-cyan" : "border-edge text-dim hover:text-cyan"
          }`}>
          "HEY ATLAS" {wakeWord ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
