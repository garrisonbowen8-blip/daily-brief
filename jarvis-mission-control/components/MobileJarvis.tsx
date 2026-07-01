"use client";

import { useEffect, useRef, useState } from "react";
import { speak } from "@/lib/speech";

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

type State = "idle" | "listening" | "thinking" | "speaking";

const COLOR: Record<State, string> = {
  idle: "#2de2e6",
  listening: "#ff4f5e",
  thinking: "#ffb347",
  speaking: "#2de2e6",
};

const LABEL: Record<State, string> = {
  idle: "tap orb to speak",
  listening: "listening…",
  thinking: "thinking…",
  speaking: "speaking…",
};

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function getRec(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => SpeechRec>;
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export default function MobileJarvis() {
  const [voiceState, setVoiceState] = useState<State>("idle");
  const [you, setYou] = useState("");
  const [atlas, setJarvis] = useState("");
  const [error, setError] = useState("");
  const [textInput, setTextInput] = useState("");
  const [supported, setSupported] = useState(true);

  // Ref mirrors voiceState so async callbacks never read stale closures
  const stateRef = useRef<State>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

  const setState = (s: State) => {
    stateRef.current = s;
    setVoiceState(s);
  };

  useEffect(() => {
    setSupported(getRec() !== null);
  }, []);

  const respond = async (text: string) => {
    setYou(text);
    setJarvis("");
    setError("");
    setState("thinking");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { reply, playAfter } = await askJarvis(text, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setJarvis(reply);
      setState("speaking");
      await speak(reply);
      if (playAfter && !ctrl.signal.aborted) {
        await fetch("/api/music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(playAfter),
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError("Something went wrong. Try again.");
    } finally {
      if (!ctrl.signal.aborted) setState("idle");
    }
  };

  const startListening = () => {
    const rec = getRec();
    if (!rec) {
      setError("Voice not available in this browser.");
      return;
    }
    setError("");

    // Stop any in-progress recognizer first
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = rec;

    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (text) respond(text);
    };

    rec.onend = () => {
      // Only reset if we're still in listening state (use ref, not stale closure)
      if (stateRef.current === "listening") setState("idle");
    };

    rec.onerror = (e) => {
      if (stateRef.current === "listening") setState("idle");
      const code = e.error ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Mic blocked — go to Safari Settings → ATLAS → Microphone → Allow.");
      } else if (code === "no-speech") {
        setError("Didn't catch that — tap and try again.");
      } else if (code === "network") {
        setError("Speech service unreachable — check your connection.");
      } else if (code) {
        setError(`Mic error: ${code}`);
      }
    };

    try {
      rec.start();
      setState("listening");
    } catch (e) {
      setError(`Could not start mic: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setState("idle");
  };

  const onOrbTap = () => {
    const s = stateRef.current;
    if (s === "idle") startListening();
    else if (s === "listening") cancel();
    else if (s === "thinking") cancel();
    // don't interrupt speaking
  };

  const onSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    const t = textInput.trim();
    if (!t || stateRef.current !== "idle") return;
    setTextInput("");
    respond(t);
  };

  const c = COLOR[voiceState];

  return (
    <div
      className="flex flex-col items-center min-h-screen w-full"
      style={{ background: "#04080c", userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Header */}
      <div className="w-full flex flex-col items-center pt-14 pb-2">
        <div className="text-[11px] tracking-[0.5em] uppercase font-mono" style={{ color: c }}>
          A.T.L.A.S
        </div>
      </div>

      {/* Orb */}
      <div className="flex flex-col items-center gap-5 py-10">
        <button
          onPointerDown={onOrbTap}
          aria-label="Talk to ATLAS"
          style={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: "none",
            outline: "none",
            background: `radial-gradient(circle at 38% 35%, #ffffff 0%, ${c} 25%, ${c}44 60%, transparent 80%)`,
            boxShadow: `0 0 60px ${c}cc, 0 0 130px ${c}55, inset 0 0 40px ${c}22`,
            transition: "box-shadow 0.5s ease, background 0.5s ease",
            animation:
              voiceState === "idle" ? "pulse 3s ease-in-out infinite"
              : voiceState === "listening" ? "pulse 0.7s ease-in-out infinite"
              : voiceState === "thinking" ? "spin-glow 1.4s linear infinite"
              : "none",
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="text-sm tracking-widest uppercase font-mono" style={{ color: c }}>
            {LABEL[voiceState]}
          </div>
          {(voiceState === "thinking" || voiceState === "listening") && (
            <button
              onPointerDown={cancel}
              className="text-[10px] tracking-widest border border-gray-600 text-gray-400 rounded px-3 py-1 font-mono"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              CANCEL
            </button>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="w-full max-w-sm flex flex-col gap-3 px-5 flex-1">
        {!supported && (
          <p className="text-center text-xs text-red-400 font-mono">
            Voice needs Safari on iPhone — or type below.
          </p>
        )}
        {error && (
          <p className="text-center text-xs font-mono" style={{ color: "#ff4f5e" }}>
            {error}
          </p>
        )}
        {you && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[82%] text-sm text-white font-mono"
              style={{ background: "#161e2a" }}>
              {you}
            </div>
          </div>
        )}
        {atlas && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[82%] text-sm font-mono leading-relaxed"
              style={{ background: `${c}15`, color: c, border: `1px solid ${c}30` }}>
              {atlas}
            </div>
          </div>
        )}
      </div>

      {/* Text input fallback */}
      <form onSubmit={onSubmitText} className="w-full max-w-sm px-5 pb-10 pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="type to ATLAS…"
            disabled={voiceState !== "idle"}
            className="flex-1 rounded-xl px-4 py-3 text-sm font-mono outline-none"
            style={{
              background: "#0d1117",
              border: `1px solid ${c}33`,
              color: "#e2e8f0",
              WebkitAppearance: "none",
            }}
          />
          <button
            type="submit"
            disabled={voiceState !== "idle" || !textInput.trim()}
            className="rounded-xl px-4 py-3 text-sm font-mono"
            style={{
              background: voiceState === "idle" && textInput.trim() ? c : "#1a2030",
              color: voiceState === "idle" && textInput.trim() ? "#000" : "#555",
              transition: "background 0.2s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            send
          </button>
        </div>
      </form>
    </div>
  );
}
