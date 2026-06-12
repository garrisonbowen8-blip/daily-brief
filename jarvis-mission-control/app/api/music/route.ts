import { execFile } from "child_process";
import { promisify } from "util";

// Apple Music control via AppleScript — works because this server runs on
// Garrison's Mac. Localhost-only; queries are escaped and passed through
// execFile (no shell).

export const dynamic = "force-dynamic";

const run = promisify(execFile);

const esc = (s: string) => s.replace(/[\\"]/g, "").replace(/[\r\n]/g, " ").slice(0, 120);

export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    return Response.json({ ok: false, error: "local requests only" }, { status: 403 });
  }

  const { action, query } = (await request.json()) as { action: string; query?: string };

  let script: string;
  switch (action) {
    case "play":
      script = `tell application "Music" to play`;
      break;
    case "pause":
      script = `tell application "Music" to pause`;
      break;
    case "next":
      script = `tell application "Music" to next track`;
      break;
    case "previous":
      script = `tell application "Music" to previous track`;
      break;
    case "now_playing":
      script = `tell application "Music" to if player state is playing then return (get name of current track) & " — " & (get artist of current track)`;
      break;
    case "play_song": {
      if (!query) return Response.json({ ok: false, error: "query required" }, { status: 400 });
      const q = esc(query);
      script = `tell application "Music"
        set results to (every track of playlist "Library" whose name contains "${q}" or artist contains "${q}" or album contains "${q}")
        if (count of results) > 0 then
          play item 1 of results
          return (get name of current track) & " — " & (get artist of current track)
        else
          return "NOTFOUND"
        end if
      end tell`;
      break;
    }
    case "play_playlist": {
      if (!query) return Response.json({ ok: false, error: "query required" }, { status: 400 });
      const q = esc(query);
      script = `tell application "Music"
        set pls to (every playlist whose name contains "${q}")
        if (count of pls) > 0 then
          play item 1 of pls
          return "playing playlist " & (get name of item 1 of pls)
        else
          return "NOTFOUND"
        end if
      end tell`;
      break;
    }
    default:
      return Response.json({ ok: false, error: `unknown action ${action}` }, { status: 400 });
  }

  try {
    const { stdout } = await run("osascript", ["-e", script]);
    const out = stdout.trim();
    if (out === "NOTFOUND") {
      return Response.json({ ok: false, error: `Nothing in the library matching "${query}"` });
    }
    return Response.json({ ok: true, action, result: out || "done" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "osascript failed";
    return Response.json({
      ok: false,
      error: msg.includes("not authorized")
        ? "macOS blocked automation — System Settings → Privacy & Security → Automation → allow Terminal/node to control Music"
        : msg,
    });
  }
}
