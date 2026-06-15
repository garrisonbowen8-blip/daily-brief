import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { getGoogleAuth } from "@/lib/connectors";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

export async function GET() {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  let execContext = "";
  if (vaultPath) {
    try { execContext = readFileSync(`${vaultPath}/Personal/Executive Assistant.md`, "utf-8"); } catch { /* skip */ }
  }

  // Pull today's calendar events for context
  let calendarSummary = "";
  try {
    const { client } = getGoogleAuth();
    const cal = google.calendar({ version: "v3", auth: client });
    const now = new Date();
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const res = await cal.events.list({
      calendarId: "primary", timeMin: now.toISOString(), timeMax: end.toISOString(),
      singleEvents: true, orderBy: "startTime", maxResults: 10,
    });
    const events = (res.data.items ?? []).map(e => e.summary ?? "").filter(Boolean);
    if (events.length) calendarSummary = `Today's calendar: ${events.join(", ")}`;
  } catch { /* no calendar context */ }

  if (!process.env.ANTHROPIC_API_KEY || !execContext) {
    return Response.json({ connected: false, reason: "ANTHROPIC_API_KEY or Obsidian vault not set" });
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 600,
    system: "You generate concise, specific daily focus items for a personal AI dashboard. Return only a JSON array of objects with keys: priority (1-5), category (string like 'McKinsey', 'Buddy Check', 'Academics', 'Trading', 'Health'), task (specific actionable string, max 12 words), and detail (one sentence of context, max 20 words). No markdown, no explanation — just the JSON array.",
    messages: [{
      role: "user",
      content: `Today is ${today}. ${calendarSummary}\n\nContext:\n${execContext}\n\nGenerate 5 specific, goal-oriented focus items for today based on active projects and upcoming deadlines. Be concrete — not "work on McKinsey" but "draft McKinsey resume bullet for leadership section". Order by urgency.`,
    }],
  });

  const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  try {
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const items = JSON.parse(clean);
    return Response.json({ connected: true, items, date: today });
  } catch {
    return Response.json({ connected: false, reason: "Failed to parse focus items", raw: text });
  }
}
