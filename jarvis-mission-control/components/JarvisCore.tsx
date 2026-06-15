"use client";

import { useEffect, useRef, useState } from "react";
import { speak } from "@/lib/speech";
import { initOrb } from "@/lib/orbScene";
import { getVoiceState, onVoiceState, setLevel, setVoiceState, VoiceState } from "@/lib/voiceState";

type Turn = { role: "user" | "assistant"; content: string };
const history: Turn[] = [];

async function askJarvis(text: string, signal?: AbortSignal) {
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
  idle: "#2de2e6",
  listening: "#ff4f5e",
  thinking: "#ffb347",
  speaking: "#2de2e6",
};

const STATUS: Record<VoiceState, string> = {
  idle: "click the core to speak",
  listening: "listening…",
  thinking: "",
  speaking: "",
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null;
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
  const [exchange, setExchange] = useState<{ you?: string; atlas?: string }>({});
  const [micError, setMicError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [wakeWord, setWakeWord] = useState(false);
  const [supported, setSupported] = useState(true);
  const [orbError, setOrbError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef(0);

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return onVoiceState(setState);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dispose: (() => void) | undefined;
    try {
      dispose = initOrb(canvas, 400);
    } catch (e) {
      setOrbError(e instanceof Error ? e.message : "WebGL init failed");
    }
    return () => { dispose?.(); };
  }, []);

  const startMicLevel = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;
    try {
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
    micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    micStreamRef.current = null;
    setLevel(0);
  };

  const cancelThinking = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setVoiceState("idle");
  };

  const handleUtterance = async (text: string) => {
    setExchange({ you: text });
    setVoiceState("thinking");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { reply, playAfter } = await askJarvis(text, controller.signal);
      if (controller.signal.aborted) return;
      setNote(null);
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
      setVoiceState("idle");
      setExchange({ you: text, atlas: "Something broke on my end, sir. Check the server log." });
    } finally {
      if (!controller.signal.aborted) setVoiceState("idle");
    }
  };

  const listen = async () => {
    const rec = getRecognition();
    if (!rec) return;
    setMicError(null);
    try {
      await startMicLevel();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setMicError(
        name === "NotAllowedError"
          ? "Microphone blocked — click the icon left of address bar → Microphone → Allow."
          : name === "NotFoundError"
          ? "No microphone found."
          : `Mic unavailable: ${name || "unknown error"}`
      );
      return;
    }
    recRef.current?.stop();
    recRef.current = rec;
    rec.continuous = wakeRef.current;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (wakeRef.current) {
        const m = text.toLowerCase().match(/(?:hey |hej |a )?atlas[,.]?\s*(.*)/);
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
          ? "Microphone blocked — click the icon left of the address bar → Allow, then reload"
          : code === "no-speech"
          ? "Didn't catch that — click the core and speak"
          : code === "network"
          ? "Speech service unreachable — Chrome's recognizer needs internet"
          : `mic error: ${code}`
      );
    };
    rec.start();
    setVoiceState("listening");
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
      {orbError ? (
        <div onClick={onCoreClick} title="Click to talk to ATLAS"
          className="flex items-center justify-center cursor-pointer"
          style={{ width: 400, height: 400 }}>
          <div className="rounded-full blink" style={{
            width: 180, height: 180,
            background: "radial-gradient(circle, #eafcfd 0%, #2de2e6 35%, transparent 70%)",
            boxShadow: "0 0 80px #2de2e688",
          }} />
        </div>
      ) : (
        <div className="relative" style={{ width: 400, height: 400 }}>
          <canvas ref={canvasRef} onClick={onCoreClick} className="relative"
            style={{ width: 400, height: 400, cursor: "pointer" }}
            title="Click to talk to ATLAS" />
        </div>
      )}

      <div className="-mt-3 flex flex-col items-center gap-1.5 text-center max-w-xl">
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: COLORS[state] }}>
          {state === "idle" ? "A.T.L.A.S online" : state}
        </div>
        {STATUS[state] && <div className="text-[11px] text-dim">{STATUS[state]}</div>}
        {state === "thinking" && (
          <button onClick={cancelThinking}
            className="text-[9px] tracking-widest border border-amber text-amber rounded px-2 py-0.5 hover:bg-amber hover:text-black transition-colors">
            CANCEL
          </button>
        )}
        {!supported && (
          <div className="text-[11px] text-red">voice needs Chrome or Edge</div>
        )}
        {exchange.you && <div className="text-[11px] text-amber">"{exchange.you}"</div>}
        {exchange.atlas && <div className="text-xs text-fg leading-relaxed">{exchange.atlas}</div>}
        {micError && <div className="text-[10px] text-red">{micError}</div>}
        {note && <div className="text-[10px] text-amber">{note}</div>}
        <button onClick={toggleWake}
          className={`mt-1 text-[9px] tracking-widest border rounded px-2 py-0.5 ${
            wakeWord ? "border-cyan text-cyan" : "border-edge text-dim hover:text-cyan"
          }`}>
          "HEY ATLAS" ALWAYS-ON {wakeWord ? "ENABLED" : "OFF"}
        </button>
      </div>
    </div>
  );
}
