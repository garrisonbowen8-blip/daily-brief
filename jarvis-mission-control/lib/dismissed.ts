import fs from "fs";
import path from "path";

// Dismissed email threads — "this doesn't need me / flagged for the wrong
// reason". Local gitignored JSON; entries expire after 30 days.

const FILE = path.join(process.cwd(), ".dismissed-threads.json");

export function loadDismissed(): Record<string, number> {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, number>;
    const cutoff = Date.now() - 30 * 86400e3;
    let changed = false;
    for (const [id, ts] of Object.entries(data)) {
      if (ts < cutoff) {
        delete data[id];
        changed = true;
      }
    }
    if (changed) saveDismissed(data);
    return data;
  } catch {
    return {};
  }
}

export function saveDismissed(data: Record<string, number>) {
  fs.writeFileSync(FILE, JSON.stringify(data));
}
