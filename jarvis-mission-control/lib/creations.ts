import fs from "fs";
import path from "path";

// Recent Higgsfield creations — a small local log so the Creations gallery
// shows everything generated, whether triggered by voice or the panel.
// Gitignored; keeps the most recent 30.

const FILE = path.join(process.cwd(), ".creations.json");

export type Creation = {
  id: string;
  kind: "image" | "video";
  url: string;
  poster?: string;
  prompt: string;
  at: number;
};

export function loadCreations(): Creation[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Creation[];
  } catch {
    return [];
  }
}

export function addCreation(c: Omit<Creation, "id" | "at">) {
  const list = loadCreations();
  list.unshift({ ...c, id: Math.random().toString(36).slice(2), at: Date.now() });
  fs.writeFileSync(FILE, JSON.stringify(list.slice(0, 30)));
}
