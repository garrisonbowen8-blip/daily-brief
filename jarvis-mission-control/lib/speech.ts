"use client";

// speak(): ElevenLabs via /api/tts proxy; falls back to browser SpeechSynthesis.
// Both paths now return a Promise that resolves only after playback finishes —
// so callers can await speak() before firing post-speech actions (music, state reset).

let currentAudio: HTMLAudioElement | null = null;
let synCancelled = false;

export async function speak(text: string): Promise<"elevenlabs" | "browser"> {
  stopSpeaking();
  synCancelled = false;

  // ── ElevenLabs path ────────────────────────────────────────────────────
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok && res.headers.get("Content-Type")?.includes("audio")) {
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      currentAudio = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      currentAudio = null;
      return "elevenlabs";
    }
  } catch {
    // fall through to browser TTS
  }

  // ── Browser SpeechSynthesis path ───────────────────────────────────────
  await new Promise<void>((resolve) => {
    if (synCancelled) { resolve(); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    // Chrome bug: speech synthesis can stall if called too quickly after cancel()
    setTimeout(() => {
      if (!synCancelled) speechSynthesis.speak(utterance);
      else resolve();
    }, 50);
  });
  return "browser";
}

export function stopSpeaking() {
  synCancelled = true;
  currentAudio?.pause();
  currentAudio = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
