"use client";

// speak(): ElevenLabs via the server-side /api/tts proxy; falls back to the
// browser's SpeechSynthesis when the key isn't configured.
// Returns which engine spoke, so the UI can show the "add ElevenLabs key" note.

let currentAudio: HTMLAudioElement | null = null;

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
      await currentAudio.play();
      return "elevenlabs";
    }
  } catch {
    // fall through to browser TTS
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  speechSynthesis.speak(utterance);
  return "browser";
}

export function stopSpeaking() {
  currentAudio?.pause();
  currentAudio = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
