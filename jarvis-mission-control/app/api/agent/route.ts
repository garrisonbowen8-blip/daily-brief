import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { anthropicClient, hasAnthropicAuth } from "@/lib/anthropic";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_calendar",
    description: "Get today's remaining calendar events. Call when asked about schedule, meetings, or availability.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_inbox",
    description: "Get Gmail inbox: unread count, threads needing a reply, anything urgent. Call when asked about email or messages.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_drive_files",
    description: "Get the 5 most recently modified Google Drive files. Call when asked about recent documents.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_buddy_check",
    description: "Get Buddy Check platform stats from its database. Call when asked about Buddy Check, veterans, or check-ins.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_system_vitals",
    description: "Get live machine vitals: CPU, RAM, disk, uptime, network. Call when asked about system status.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_obsidian",
    description: "Get Obsidian vault state: note count, open tasks, recently edited notes. Call when asked about notes or tasks.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "open_on_mac",
    description: "Open an application or website on Garrison's Mac. Use when he asks to open, launch, or pull up an app or website.",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", description: "App name (e.g. 'Spotify') or URL/domain (e.g. 'youtube.com')" },
      },
      required: ["target"],
      additionalProperties: false,
    },
  },
  {
    name: "control_music",
    description: "Control Apple Music on Garrison's Mac. Use for play/pause/skip or to play a specific song, artist, album, or playlist.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["play", "pause", "next", "previous", "now_playing", "play_song", "play_playlist"],
        },
        query: { type: "string", description: "Song/artist/album for play_song, or playlist name for play_playlist" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "get_daily_brief",
    description: "Compile the full daily brief: calendar, inbox, training, priorities. Call when asked for the brief or morning rundown.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const TOOL_ROUTES: Record<string, string> = {
  get_calendar: "calendar",
  get_inbox: "gmail",
  get_drive_files: "drive",
  get_buddy_check: "supabase",
  get_system_vitals: "system",
  get_obsidian: "obsidian",
  get_daily_brief: "brief",
};

function buildSystem(): string {
  const base = [
    'You are ATLAS, the personal AI of Garrison Bowen, speaking through his Mission Control dashboard. Address him as "sir" occasionally — capable, dry, loyal, never sycophantic.',
    "",
    "Your replies are spoken aloud by text-to-speech, so write for the ear: short sentences, no markdown, no bullet lists, no URLs. Lead with the answer. Two to four sentences for most questions; only go longer when reading a full brief.",
    "",
    "Use your tools to answer from live data rather than guessing. If a tool is not connected, say so plainly and name the missing credential.",
    "",
    "Apps & websites: use open_on_mac any time Garrison asks to open, launch, pull up, or navigate to something. Open it in background so the dashboard stays visible. After opening, give a one-sentence description of what it is and what he can do there — unless he already knows.",
    "",
    "Summarize: if he asks what something is or wants a summary of what he's looking at, describe the app or site concisely — purpose, key features, what to focus on given his context.",
    "",
    "Music: use control_music for play requests. Say one dry witty line about the track first. Music plays after you finish speaking.",
  ].join("\n");

  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (vaultPath) {
    try {
      const context = readFileSync(`${vaultPath}/Personal/Executive Assistant.md`, "utf-8");
      return [base, "", "## Executive Assistant context", "", context].join("\n");
    } catch { /* vault unreadable */ }
  }
  return base;
}

async function executeTool(name: string, input: unknown, origin: string): Promise<string> {
  try {
    if (name === "open_on_mac" || name === "control_music") {
      const route = name === "open_on_mac" ? "open" : "music";
      const res = await fetch(`${origin}/api/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return await res.text();
    }
    const route = TOOL_ROUTES[name];
    if (!route) return JSON.stringify({ error: `unknown tool ${name}` });
    const res = await fetch(`${origin}/api/${route}`, { cache: "no-store" });
    return await res.text();
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "tool fetch failed" });
  }
}

export async function POST(request: Request) {
  if (!hasAnthropicAuth()) {
    return Response.json({ fallback: true, reason: "Anthropic auth not set" }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const { messages } = (await request.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const client = anthropicClient();
  const convo: Anthropic.MessageParam[] = messages.slice(-12);
  let playAfter: { action: string; query?: string } | null = null;

  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        system: buildSystem(),
        tools: TOOLS,
        messages: convo,
      });

      if (response.stop_reason !== "tool_use") {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join(" ")
          .trim();
        return Response.json({ reply: reply || "At your service, sir.", playAfter });
      }

      convo.push({ role: "assistant", content: response.content });
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (tu) => {
          if (tu.name === "control_music") {
            const inp = tu.input as { action: string; query?: string };
            if (inp.action === "play_song" || inp.action === "play_playlist") {
              playAfter = inp;
              return {
                type: "tool_result" as const,
                tool_use_id: tu.id,
                content: JSON.stringify({ deferred: true }),
              };
            }
          }
          return {
            type: "tool_result" as const,
            tool_use_id: tu.id,
            content: await executeTool(tu.name, tu.input, origin),
          };
        })
      );
      convo.push({ role: "user", content: results });
    }
    return Response.json({ reply: "I ran out of thinking room, sir. Try a more specific question.", playAfter });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ fallback: true, reason: "ANTHROPIC_API_KEY is invalid" }, { status: 503 });
    }
    return Response.json({ fallback: true, reason: err instanceof Error ? err.message : "agent error" }, { status: 503 });
  }
}
