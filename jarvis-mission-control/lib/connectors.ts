import fs from "fs";
import path from "path";
import { google } from "googleapis";

// Shared plumbing for connector API routes. Every route degrades to
// { connected: false, reason } instead of throwing, so a dead connector
// never takes the dashboard down.

export type Disconnected = { connected: false; reason: string };

export function notConnected(reason: string) {
  return Response.json({ connected: false, reason } satisfies Disconnected);
}

export function connectorError(err: unknown) {
  const reason = err instanceof Error ? err.message : "connector error";
  return Response.json({ connected: false, reason } satisfies Disconnected);
}

// ── Google (reuses the daily-brief config.json produced by scripts/setup.sh) ──

const CONFIG_PATH =
  process.env.DAILY_BRIEF_CONFIG ?? path.join(process.cwd(), "..", "config.json");

export const MY_DATA_PATH =
  process.env.DAILY_BRIEF_MY_DATA ?? path.join(process.cwd(), "..", "my-data.json");

type DailyBriefConfig = {
  google?: {
    clientId: string;
    clientSecret: string;
    calendarId?: string;
    tokens?: Record<string, unknown>;
  };
};

export function loadDailyBriefConfig(): DailyBriefConfig | null {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

export function getGoogleAuth() {
  const cfg = loadDailyBriefConfig();
  if (!cfg?.google?.tokens) {
    throw new Error(
      `Google not connected — run \`npm run auth\` in daily-brief (looked for ${CONFIG_PATH})`
    );
  }
  const { clientId, clientSecret, tokens } = cfg.google;
  const client = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:3456");
  client.setCredentials(tokens);
  return { client, calendarId: cfg.google.calendarId ?? "primary" };
}
