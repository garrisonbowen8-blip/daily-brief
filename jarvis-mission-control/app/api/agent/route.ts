import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";

// The JARVIS brain: Claude with tools over every dashboard connector.
// The client sends the conversation (text turns only); each request runs a
// fresh tool-use loop server-side and returns the final spoken reply.
// Requires ANTHROPIC_API_KEY in .env.local — without it the client falls
// back to the canned /api/command intents.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_calendar",
    description:
      "Get today's remaining calendar events across all of the user's calendars, plus how long they are free. Call this when asked about schedule, meetings, events, or availability today.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_inbox",
    description:
      "Get the Gmail inbox state: unread count, threads needing a reply (with sender, subject, snippet), and anything flagged urgent. Call this when asked about email, messages, or who needs a response.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_drive_files",
    description:
      "Get the 5 most recently modified Google Drive files. Call this when asked about recent documents or files.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_buddy_check",
    description:
      "Get the Buddy Check platform pulse from its database: verified veteran count, check-ins in the last 24h, active forum threads, new buddy matches this week. Call this when asked about Buddy Check, the platform, veterans, or check-ins.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_system_vitals",
    description:
      "Get this machine's live vitals: CPU load, RAM, disk, uptime, network throughput. Call this when asked about system status or how the machine is doing.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_claude_usage",
    description:
      "Get the user's Claude/AI token usage stats (today, 7 days, 30 days, by model). Call this when asked about Claude usage, tokens, or AI spend.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_obsidian",
    description:
      "Get the Obsidian vault state: note count, open tasks, recently edited notes, recent canvases. Call this when asked about notes, tasks, or the vault.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "open_on_mac",
    description:
      "Open an application or website on Garrison's Mac. Call this whenever he asks to open, launch, start, or pull up an app ('open Spotify', 'launch Obsidian') or a website ('open YouTube', 'pull up espn.com'). For websites pass the domain; for apps pass the exact macOS app name (e.g. 'Google Chrome', 'Spotify', 'Notes').",
    input_schema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description:
            "App name as installed on the Mac (e.g. 'Spotify') or a URL/domain (e.g. 'youtube.com')",
        },
      },
      required: ["target"],
      additionalProperties: false,
    },
  },
  {
    name: "control_music",
    description:
      "Control Apple Music on Garrison's Mac. Call this when he asks to play, pause, or skip music, play a specific song/artist/album ('play some Drake', 'put on my workout playlist'), or asks what's playing. Actions: play, pause, next, previous, now_playing, play_song (query = song/artist/album), play_playlist (query = playlist name).",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["play", "pause", "next", "previous", "now_playing", "play_song", "play_playlist"],
        },
        query: {
          type: "string",
          description: "Song/artist/album text for play_song, or playlist name for play_playlist",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_media",
    description:
      "Generate an image or short video with Higgsfield AI from a text description. Call this when Garrison asks you to create, generate, make, or render a picture/image or a video/clip ('make me an image of a stark-industries lab', 'generate a video of a sunset over the bay'). Images take ~30–60s, videos a few minutes. The result appears in the Creations panel automatically.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["image", "video"], description: "image or video" },
        prompt: { type: "string", description: "Vivid description of what to generate" },
      },
      required: ["kind", "prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "research",
    description:
      "Deep research on the live web using a search-capable model. Call this for any question that needs current real-world information — news, prices, scores, weather, product facts, anything time-sensitive or outside the dashboard's own data and your knowledge. Returns findings; relay them conversationally.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The research question, self-contained" },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    name: "get_market_brief",
    description:
      "Get a spoken market summary tied to Garrison's actual portfolio — how his positions moved today and relevant news. Call when asked about the market, stocks, his portfolio's day, or 'how are my stocks doing'.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_portfolio",
    description:
      "Get Garrison's Robinhood portfolio: equity value, crypto, total P&L, and individual positions. Call when asked about holdings, positions, or account value.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_daily_brief",
    description:
      "Compile the full daily brief: calendar, inbox triage, training block, and ranked top priorities. Call this when asked for the brief, the morning rundown, today's priorities, or the training plan.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const TOOL_ROUTES: Record<string, string> = {
  get_calendar: "calendar",
  get_inbox: "gmail",
  get_drive_files: "drive",
  get_buddy_check: "supabase",
  get_system_vitals: "system",
  get_claude_usage: "claude-usage",
  get_obsidian: "obsidian",
  get_daily_brief: "brief",
  get_market_brief: "market-brief",
  get_portfolio: "robinhood",
};

// System prompt assembled per-request: base persona + behaviors, plus the
// Executive Assistant note from the Obsidian vault when available, so ATLAS
// knows Garrison's active projects and goals.
function buildSystem(): string {
  const base = [
    'You are ATLAS, the personal AI of Garrison Bowen, speaking through his Mission Control dashboard. Address him as "sir" occasionally — capable, dry, loyal, never sycophantic.',
    "",
    "Your replies are spoken aloud by text-to-speech, so write for the ear: short sentences, no markdown, no bullet lists, no URLs read out character by character. Lead with the answer. Two to four sentences for most questions; only go longer when reading a full brief.",
    "",
    "Use your tools to answer from live data rather than guessing. If a tool reports it is not connected, say so plainly and name the missing credential.",
    "",
    "Apps & websites: use open_on_mac any time he asks to open, launch, pull up, or navigate to something. After opening, give a one-sentence description of what it is and what to do there — unless he already knows.",
    "",
    "Summarize: if he asks what something is or wants a summary of what he's looking at, describe it concisely — purpose, key features, what to focus on given his context.",
    "",
    "Music: use control_music for play requests. Say one dry witty line about the track first.",
    "",
    "Creating: use generate_media (Higgsfield) for image/video requests; tell him it's rendering and will land in the Creations panel.",
    "",
    "Research: for anything needing current real-world information — news, prices, scores, facts you're unsure of — use the research tool, then relay its findings in your own spoken voice: lead with the answer, keep the numbers, drop the fluff. For his portfolio or market questions, prefer get_portfolio and get_market_brief.",
    "",
    "Context: Garrison runs Buddy Check (a veteran peer-support platform), follows a summer recovery training plan with basketball on Tuesdays and Fridays, and uses this dashboard as his command center.",
  ].join("\n");

  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (vaultPath) {
    try {
      const context = readFileSync(`${vaultPath}/Personal/Executive Assistant.md`, "utf-8");
      return [base, "", "## Executive Assistant context", "", context].join("\n");
    } catch {
      // vault unreadable — base persona still works
    }
  }
  return base;
}

// Research sub-agent: Sonnet with server-side web search digs up the answer;
// ATLAS then turns the findings into a spoken reply.
async function runResearch(question: string): Promise<string> {
  const client = new Anthropic();
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  for (let i = 0; i < 5; i++) {
    const r = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "You are a research assistant behind a voice AI. Search the web and answer the question with concrete, current facts — names, numbers, dates. Be concise (under 200 words), plain prose, no markdown, no URLs. If sources conflict, say which is most credible.",
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages,
    });
    // server-side search loop can pause; resend to let it resume
    if (r.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: r.content }];
      continue;
    }
    const text = r.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return text || "The research came back empty, sir.";
  }
  return "Research ran long and was cut short — ask me again, more specifically.";
}

async function executeTool(
  name: string,
  input: unknown,
  origin: string
): Promise<string> {
  try {
    if (name === "research") {
      const q = (input as { question?: string })?.question ?? "";
      return await runResearch(q);
    }
    if (name === "open_on_mac" || name === "control_music" || name === "generate_media") {
      const route =
        name === "open_on_mac" ? "open" : name === "control_music" ? "music" : "higgsfield";
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
    return JSON.stringify({
      error: err instanceof Error ? err.message : "tool fetch failed",
    });
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { fallback: true, reason: "ANTHROPIC_API_KEY not set in .env.local" },
      { status: 503 }
    );
  }

  const origin = new URL(request.url).origin;
  const { messages } = (await request.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const client = new Anthropic();
  const convo: Anthropic.MessageParam[] = messages.slice(-12);

  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2048,
        output_config: { effort: "low" },
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
        return Response.json({ reply: reply || "At your service, sir." });
      }

      convo.push({ role: "assistant", content: response.content });
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (tu) => ({
          type: "tool_result" as const,
          tool_use_id: tu.id,
          content: await executeTool(tu.name, tu.input, origin),
        }))
      );
      convo.push({ role: "user", content: results });
    }
    return Response.json({
      reply: "I gathered the data but ran out of thinking room, sir. Ask me again more specifically.",
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { fallback: true, reason: "ANTHROPIC_API_KEY is invalid" },
        { status: 503 }
      );
    }
    const reason = err instanceof Error ? err.message : "agent error";
    return Response.json({ fallback: true, reason }, { status: 503 });
  }
}
