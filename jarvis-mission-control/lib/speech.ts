"use client";

import { setVoiceState, setLevel } from "./voiceState";

// speak(): ElevenLabs via the server-side /api/tts proxy; falls back to the
// browser's SpeechSynthesis when the key isn't configured. Feeds live audio
// amplitude into voiceState so the JARVIS core animates with the voice.

let currentAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let levelRaf = 0;

function trackLevel(audio: HTMLAudioElement) {
  try {
    audioCtx ??= new AudioContext();
    const src = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      setLevel(Math.min(1, (sum / data.length / 255) * 2.5));
      if (!audio.paused && !audio.ended) levelRaf = requestAnimationFrame(loop);
    };
    levelRaf = requestAnimationFrame(loop);
  } catch {
    // analyser is best-effort; the orb falls back to a synthetic pulse
  }
}

export async function speak(text: string): Promise<"elevenlabs" | "browser"> {
  stopSpeaking();
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok && res.headers.get("Content-Type")?.includes("audio")) {
      const blob = await res.blob();
      currentAudio = new Audio(URL.createObjectURL(blob));
      currentAudio.crossOrigin = "anonymous";
      setVoiceState("speaking");
      trackLevel(currentAudio);
      currentAudio.onended = () => {
        setVoiceState("idle");
        setLevel(0);
      };
      await currentAudio.play();
      return "elevenlabs";
    }
  } catch {
    // fall through to browser TTS
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  setVoiceState("speaking");
  utterance.onend = () => {
    setVoiceState("idle");
    setLevel(0);
  };
  speechSynthesis.speak(utterance);
  return "browser";
}

export function stopSpeaking() {
  cancelAnimationFrame(levelRaf);
  currentAudio?.pause();
  currentAudio = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  setVoiceState("idle");
  setLevel(0);
}
