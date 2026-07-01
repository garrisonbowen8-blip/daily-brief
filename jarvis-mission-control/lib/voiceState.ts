"use client";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

let current: VoiceState = "idle";
let level = 0;
const listeners = new Set<(s: VoiceState) => void>();

export function getVoiceState() { return current; }
export function getLevel() { return level; }

export function setVoiceState(s: VoiceState) {
  current = s;
  listeners.forEach((fn) => fn(s));
}

export function setLevel(l: number) { level = l; }

export function onVoiceState(fn: (s: VoiceState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
