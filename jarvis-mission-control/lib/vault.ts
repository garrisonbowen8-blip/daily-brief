import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import path from "path";

// Server-only helpers for JARVIS to read/search/write Garrison's Obsidian
// vault (his "second brain"). All paths are confined to OBSIDIAN_VAULT_PATH.

const vaultRoot = () => process.env.OBSIDIAN_VAULT_PATH || null;
const IGNORE = new Set([".obsidian", ".trash", ".git", "node_modules"]);

// Recursively collect markdown files, skipping hidden/system folders (bounded).
function listMd(root: string, dir = root, out: string[] = [], limit = 8000): string[] {
  if (out.length >= limit) return out;
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name.startsWith(".") || IGNORE.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) listMd(root, full, out, limit);
    else if (name.toLowerCase().endsWith(".md")) out.push(full);
    if (out.length >= limit) break;
  }
  return out;
}

function sanitizeName(name: string): string {
  return (
    name
      .replace(/[/\\]+/g, " ")
      .replace(/\.\.+/g, "")
      .replace(/[^\w \-().]/g, "")
      .trim()
      .slice(0, 120) || "JARVIS Note"
  );
}

// Guard: the resolved path must stay inside the vault.
function insideVault(root: string, target: string): boolean {
  const r = path.resolve(root);
  const t = path.resolve(target);
  return t === r || t.startsWith(r + path.sep);
}

export type VaultHit = { title: string; path: string; snippet: string };

export function vaultSearch(
  query: string,
  maxResults = 6
): { ok: boolean; results?: VaultHit[]; error?: string } {
  const root = vaultRoot();
  if (!root) return { ok: false, error: "OBSIDIAN_VAULT_PATH not set" };
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return { ok: false, error: "empty query" };

  const scored: (VaultHit & { score: number })[] = [];
  for (const f of listMd(root)) {
    const title = path.basename(f, ".md");
    let content = "";
    try { content = readFileSync(f, "utf-8"); } catch { continue; }
    const tl = title.toLowerCase();
    const bl = content.toLowerCase();
    let score = 0;
    let snippetAt = -1;
    for (const t of terms) {
      if (tl.includes(t)) score += 5;
      const idx = bl.indexOf(t);
      if (idx >= 0) { score += 1; if (snippetAt < 0) snippetAt = idx; }
    }
    if (score === 0) continue;
    const start = snippetAt < 0 ? 0 : Math.max(0, snippetAt - 80);
    const snippet = content.slice(start, start + 220).replace(/\s+/g, " ").trim();
    scored.push({ title, path: path.relative(root, f), snippet, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return {
    ok: true,
    results: scored.slice(0, maxResults).map(({ title, path: p, snippet }) => ({ title, path: p, snippet })),
  };
}

export function vaultRead(
  query: string,
  maxChars = 6000
): { ok: boolean; title?: string; path?: string; content?: string; error?: string } {
  const root = vaultRoot();
  if (!root) return { ok: false, error: "OBSIDIAN_VAULT_PATH not set" };
  const q = query.trim().toLowerCase();
  if (!q) return { ok: false, error: "empty query" };

  let best: { f: string; score: number } | null = null;
  for (const f of listMd(root)) {
    const title = path.basename(f, ".md").toLowerCase();
    const rel = path.relative(root, f).toLowerCase();
    let score = 0;
    if (rel === q || rel === `${q}.md`) score += 100;
    if (title === q) score += 50;
    else if (title.includes(q)) score += 20;
    if (rel.includes(q)) score += 3;
    if (score > 0 && (!best || score > best.score)) best = { f, score };
  }
  if (!best) {
    const s = vaultSearch(query, 1);
    if (s.ok && s.results?.[0]) best = { f: path.join(root, s.results[0].path), score: 1 };
  }
  if (!best) return { ok: false, error: `no note matching "${query}"` };

  let content = "";
  try { content = readFileSync(best.f, "utf-8"); } catch { return { ok: false, error: "read failed" }; }
  return {
    ok: true,
    title: path.basename(best.f, ".md"),
    path: path.relative(root, best.f),
    content: content.length > maxChars ? `${content.slice(0, maxChars)}\n\n[…truncated]` : content,
  };
}

export function vaultWrite(
  title: string,
  content: string,
  mode: "append" | "create" = "append"
): { ok: boolean; path?: string; action?: string; error?: string } {
  const root = vaultRoot();
  if (!root) return { ok: false, error: "OBSIDIAN_VAULT_PATH not set" };
  if (!content?.trim()) return { ok: false, error: "no content to write" };

  // Append targets an existing note with that title; otherwise create a new one.
  let target: string | null = null;
  if (mode === "append") {
    const tl = title.trim().toLowerCase();
    target = listMd(root).find((f) => path.basename(f, ".md").toLowerCase() === tl) ?? null;
  }
  const creating = !target;
  if (creating) target = path.join(root, `${sanitizeName(title)}.md`);

  if (!insideVault(root, target!)) return { ok: false, error: "path escapes vault" };

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  try {
    if (creating || !existsSync(target!)) {
      writeFileSync(
        target!,
        `# ${path.basename(target!, ".md")}\n\n${content.trim()}\n\n*Added ${stamp} via JARVIS*\n`
      );
      return { ok: true, path: path.relative(root, target!), action: "created" };
    }
    appendFileSync(target!, `\n\n## ${stamp} — via JARVIS\n\n${content.trim()}\n`);
    return { ok: true, path: path.relative(root, target!), action: "appended" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "write failed" };
  }
}
