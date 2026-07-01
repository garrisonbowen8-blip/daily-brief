"use client";

import { dispatchIntent } from "./intents";

// One shared JARVIS conversation for the whole dashboard — voice and the
// command console feed the same history, so context carries across both.
// Uses the real agent (/api/agent) when an Anthropic key is configured,
// otherwise falls back to the canned /api/command intents.

type Turn = { role: "user" | "assistant"; content: string };

const history: Turn[] = [];

export type JarvisReply = {
  reply: string;
  engine: "agent" | "fallback";
  note?: string;
};

export async function askJarvis(text: string): Promise<JarvisReply> {
  history.push({ role: "user", content: text });

  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-12) }),
    });
    if (res.ok) {
      const { reply } = await res.json();
      history.push({ role: "assistant", content: reply });
      return { reply, engine: "agent" };
    }
  } catch {
    // fall through to command stub
  }

  // Agent unavailable — canned intent handler keeps the console alive
  const res = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: text }),
  });
  const { reply, intent } = await res.json();
  dispatchIntent(intent);
  history.push({ role: "assistant", content: reply });
  return {
    reply,
    engine: "fallback",
    note: "add ANTHROPIC_API_KEY for the full ATLAS brain",
  };
}
