"use client";

// Tiny shared store for the voice pipeline state, so the central orb can
// react to what speech.ts and the agent are doing without prop drilling.

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

let state: VoiceState = "idle";
let level = 0; // 0..1 live audio amplitude (mic or TTS)

const subs = new Set<(s: VoiceState) => void>();

export function setVoiceState(s: VoiceState) {
  state = s;
  subs.forEach((f) => f(s));
}

export function getVoiceState() {
  return state;
}

export function setLevel(v: number) {
  level = v;
}

export function getLevel() {
  return level;
}

export function onVoiceState(f: (s: VoiceState) => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
