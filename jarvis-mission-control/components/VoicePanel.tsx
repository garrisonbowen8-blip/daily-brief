"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "./Panel";
import { speak } from "@/lib/speech";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function VoicePanel() {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [wakeWord, setWakeWord] = useState(false);
  const [engine, setEngine] = useState<"elevenlabs" | "browser" | null>(null);
  const [log, setLog] = useState<{ who: "you" | "atlas"; text: string }[]>([]);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeRef = useRef(false);

  useEffect(() => {
    setSupported(getRecognition() !== null);
  }, []);

  const handleUtterance = async (text: string) => {
    setLog((l) => [...l.slice(-6), { who: "you", text }]);
    const res = await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: text }),
    });
    const { reply } = await res.json();
    setLog((l) => [...l.slice(-6), { who: "atlas", text: reply }]);
    setEngine(await speak(reply));
  };

  const listenOnce = () => {
    const rec = getRecognition();
    if (!rec) return;
    recRef.current?.stop();
    recRef.current = rec;
    rec.continuous = wakeRef.current;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      if (wakeRef.current) {
        // Wake-word mode: only act when addressed
        const m = text.toLowerCase().match(/hey atlas[,.]?\s*(.*)/);
        if (!m) return;
        handleUtterance(m[1] || "yes?");
      } else {
        handleUtterance(text);
      }
    };
    rec.onend = () => {
      // keep the mic hot while wake-word mode is on
      if (wakeRef.current) rec.start();
      else setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const stopListening = () => {
    wakeRef.current = false;
    recRef.current?.stop();
    setListening(false);
  };

  const toggleWake = () => {
    const next = !wakeWord;
    setWakeWord(next);
    wakeRef.current = next;
    if (next) listenOnce();
    else stopListening();
  };

  return (
    <Panel
      title="Voice"
      status={supported ? (listening ? "online" : undefined) : "offline"}
      actions={
        <button
          onClick={toggleWake}
          className={`text-[9px] tracking-widest border rounded px-1.5 py-0.5 ${
            wakeWord ? "border-cyan text-cyan" : "border-edge text-dim"
          }`}
        >
          “HEY ATLAS” {wakeWord ? "ON" : "OFF"}
        </button>
      }
    >
      {!supported ? (
        <p className="text-xs text-dim">
          SpeechRecognition not available in this browser — use Chrome/Edge.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onMouseDown={listenOnce}
            onMouseUp={() => !wakeWord && recRef.current?.stop()}
            className={`self-start border rounded px-3 py-1.5 text-xs tracking-widest uppercase ${
              listening ? "border-red text-red recording" : "border-cyan text-cyan"
            }`}
          >
            {listening ? "● Listening" : "◉ Push to talk"}
          </button>
          <div className="flex flex-col gap-1 text-[11px] min-h-16">
            {log.length === 0 && (
              <span className="text-dim">Say “Hey ATLAS, run my brief”…</span>
            )}
            {log.map((entry, i) => (
              <div key={i}>
                <span className={entry.who === "you" ? "text-amber" : "text-cyan"}>
                  {entry.who === "you" ? "YOU" : "ATLAS"}
                </span>{" "}
                <span className="text-fg">{entry.text}</span>
              </div>
            ))}
          </div>
          {engine === "browser" && (
            <p className="text-[10px] text-amber">
              add ElevenLabs key for premium voice (using browser TTS)
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
