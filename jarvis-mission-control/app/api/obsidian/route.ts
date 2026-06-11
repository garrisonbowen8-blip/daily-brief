import fs from "fs";
import path from "path";
import { notConnected, connectorError } from "@/lib/connectors";

// Obsidian vaults are plain folders of Markdown — point OBSIDIAN_VAULT_PATH
// at the vault and this reads it directly, no plugin required. Surfaces
// recently edited notes, open task count, and recent canvas/image files.

export const dynamic = "force-dynamic";

const SKIP = new Set([".obsidian", ".trash", "node_modules", ".git"]);

function walk(dir: string, out: string[] = [], depth = 0): string[] {
  if (depth > 6) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out, depth + 1);
    else out.push(p);
  }
  return out;
}

export async function GET() {
  const vault = process.env.OBSIDIAN_VAULT_PATH;
  if (!vault) {
    return notConnected("Set OBSIDIAN_VAULT_PATH in .env.local to your vault folder");
  }

  try {
    if (!fs.existsSync(vault)) throw new Error(`Vault not found at ${vault}`);
    const files = walk(vault).map((p) => ({ p, stat: fs.statSync(p) }));

    const notes = files
      .filter((f) => f.p.endsWith(".md"))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    const graphics = files
      .filter((f) => /\.(canvas|excalidraw\.md|png|jpg|jpeg|svg)$/i.test(f.p))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .slice(0, 5)
      .map((f) => ({
        name: path.basename(f.p),
        modified: f.stat.mtime.toISOString(),
      }));

    // Open tasks across the 30 most recent notes (keeps big vaults fast)
    let openTasks = 0;
    for (const f of notes.slice(0, 30)) {
      openTasks += (fs.readFileSync(f.p, "utf8").match(/^\s*[-*] \[ \]/gm) ?? []).length;
    }

    return Response.json({
      connected: true,
      noteCount: notes.length,
      openTasks,
      recentNotes: notes.slice(0, 5).map((f) => ({
        name: path.basename(f.p, ".md"),
        modified: f.stat.mtime.toISOString(),
      })),
      graphics,
    });
  } catch (err) {
    return connectorError(err);
  }
}
