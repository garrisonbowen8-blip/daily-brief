import fs from "fs";
import os from "os";
import path from "path";
import { notConnected, connectorError } from "@/lib/connectors";

// Claude usage — parsed from Claude Code's local transcript logs
// (~/.claude/projects/**/*.jsonl). Every assistant turn logs its token usage
// and model, so this is real usage data with no API key required.

export const dynamic = "force-dynamic";

type Bucket = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  messages: number;
};

const emptyBucket = (): Bucket => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  messages: 0,
});

export async function GET() {
  const dir =
    process.env.CLAUDE_DATA_DIR ?? path.join(os.homedir(), ".claude", "projects");

  if (!fs.existsSync(dir)) {
    return notConnected(
      `No Claude Code data found at ${dir} — set CLAUDE_DATA_DIR if it lives elsewhere`
    );
  }

  try {
    const cutoff = Date.now() - 30 * 86400e3;
    const files: string[] = [];
    for (const project of fs.readdirSync(dir)) {
      const projectDir = path.join(dir, project);
      if (!fs.statSync(projectDir).isDirectory()) continue;
      for (const f of fs.readdirSync(projectDir)) {
        if (!f.endsWith(".jsonl")) continue;
        const p = path.join(projectDir, f);
        if (fs.statSync(p).mtimeMs >= cutoff) files.push(p);
      }
    }

    const today = new Date().toDateString();
    const weekAgo = Date.now() - 7 * 86400e3;
    const totals = { today: emptyBucket(), week: emptyBucket(), month: emptyBucket() };
    const byModel: Record<string, Bucket> = {};
    let lastActive = 0;

    for (const file of files) {
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        // cheap pre-filter; transcript lines with images can be megabytes
        if (!line.includes('"usage":{') || !line.includes('"model":"')) continue;
        try {
          const entry = JSON.parse(line);
          const usage = entry.message?.usage;
          const model = entry.message?.model;
          const ts = Date.parse(entry.timestamp ?? "");
          if (!usage || !model || Number.isNaN(ts)) continue;

          const add = (b: Bucket) => {
            b.input += usage.input_tokens ?? 0;
            b.output += usage.output_tokens ?? 0;
            b.cacheRead += usage.cache_read_input_tokens ?? 0;
            b.cacheWrite += usage.cache_creation_input_tokens ?? 0;
            b.messages += 1;
          };

          add(totals.month);
          if (ts >= weekAgo) add(totals.week);
          if (new Date(ts).toDateString() === today) add(totals.today);
          add((byModel[model] ??= emptyBucket()));
          if (ts > lastActive) lastActive = ts;
        } catch {
          // partial/corrupt line — skip
        }
      }
    }

    return Response.json({
      connected: true,
      sessions30d: files.length,
      lastActive: lastActive ? new Date(lastActive).toISOString() : null,
      totals,
      byModel,
    });
  } catch (err) {
    return connectorError(err);
  }
}
