import { execFile } from "child_process";
import { promisify } from "util";

// Opens an application or URL on the machine running this server (Garrison's
// Mac) via macOS `open`. execFile (no shell) + localhost-only guard: this
// must never be reachable from another machine.

export const dynamic = "force-dynamic";

const run = promisify(execFile);

export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    return Response.json({ ok: false, error: "local requests only" }, { status: 403 });
  }

  const { target } = await request.json();
  if (typeof target !== "string" || !target.trim() || target.length > 200) {
    return Response.json({ ok: false, error: "target required" }, { status: 400 });
  }
  const t = target.trim();

  const isUrl =
    /^https?:\/\//i.test(t) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t);

  try {
    if (isUrl) {
      const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
      await run("open", [url]);
      return Response.json({ ok: true, opened: url, kind: "url" });
    }
    await run("open", ["-a", t]);
    return Response.json({ ok: true, opened: t, kind: "app" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "open failed";
    return Response.json({
      ok: false,
      error: msg.includes("Unable to find application")
        ? `No app named "${t}" on this Mac — the exact name matters (e.g. "Google Chrome", not "Chrome browser")`
        : msg,
    });
  }
}
