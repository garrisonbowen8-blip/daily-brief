import fs from "fs";
import { MY_DATA_PATH } from "@/lib/connectors";

// Daily Brief — composes calendar, inbox triage and the day's training block
// into ranked priorities plus a spoken script for the voice module.
// Each source degrades independently: a dead connector becomes a line in the
// brief ("inbox unavailable"), never a 500.

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type CalendarData = {
  connected: boolean;
  events?: { title: string; start: string | null; allDay: boolean }[];
  upcoming?: { title: string; start: string | null; allDay: boolean }[];
  freeUntil?: string | null;
};

function fmtDay(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
type GmailData = {
  connected: boolean;
  unread?: number;
  threads?: { subject: string; from: string }[];
  urgent?: { subject: string; from: string }[];
};

function trainingBlock(now: Date): string {
  const day = DAYS[now.getDay()];
  // Summer recovery plan: basketball Tue/Fri, otherwise the scheduled block
  // from daily-brief's my-data.json workout map.
  if (day === "Tuesday" || day === "Friday") return "Basketball (summer recovery plan)";
  try {
    const myData = JSON.parse(fs.readFileSync(MY_DATA_PATH, "utf8"));
    const block = myData?.workout?.[day];
    if (block?.day) {
      return block.day === "Rest"
        ? "Rest day — mobility and recovery only"
        : `${block.day}${block.moves?.length ? ` — ${block.moves.join(", ")}` : ""}`;
    }
  } catch {
    // my-data.json not present in this checkout; fall through
  }
  return "No block scheduled — default to recovery work";
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export async function GET(request: Request) {
  const base = new URL(request.url).origin;
  const get = async <T,>(p: string): Promise<T | null> => {
    try {
      const res = await fetch(`${base}/api/${p}`, { cache: "no-store" });
      return (await res.json()) as T;
    } catch {
      return null;
    }
  };

  const [calendar, gmail] = await Promise.all([
    get<CalendarData>("calendar"),
    get<GmailData>("gmail"),
  ]);

  const now = new Date();
  const training = trainingBlock(now);

  // Rank priorities: urgent mail > next timed meeting > replies > training
  const priorities: string[] = [];
  for (const u of gmail?.urgent ?? []) {
    priorities.push(`Reply to ${u.from}: "${u.subject}" — flagged urgent`);
  }
  const timed = (calendar?.events ?? []).filter((e) => !e.allDay);
  if (timed[0]) {
    priorities.push(`Prep for ${timed[0].title} at ${fmtTime(timed[0].start)}`);
  }
  const replies = (gmail?.threads ?? []).filter(
    (t) => !(gmail?.urgent ?? []).some((u) => u.subject === t.subject)
  );
  if (replies.length) {
    priorities.push(
      `Clear ${Math.min(replies.length, 3)} replies: ${replies
        .slice(0, 3)
        .map((t) => t.from)
        .join(", ")}`
    );
  }
  priorities.push(`Training: ${training}`);
  if (priorities.length < 4 && calendar?.connected && timed.length === 0) {
    priorities.push("Open calendar day — schedule one deep-work block");
  }

  const ranked = priorities.slice(0, 5);

  // Spoken script for the voice module
  const lines: string[] = [
    `Good ${now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, sir.`,
  ];
  if (calendar?.connected) {
    lines.push(
      timed.length
        ? `You have ${timed.length} event${timed.length > 1 ? "s" : ""} today, first up ${timed[0].title} at ${fmtTime(timed[0].start)}.`
        : "Your calendar is clear today."
    );
    if (calendar.freeUntil) lines.push(`You're free until ${fmtTime(calendar.freeUntil)}.`);
  } else {
    lines.push("Calendar is offline.");
  }
  if (gmail?.connected) {
    lines.push(`${gmail.unread} unread in the inbox, ${replies.length} need a reply.`);
    if (gmail.urgent?.length) lines.push(`${gmail.urgent.length} flagged urgent.`);
  } else {
    lines.push("Inbox is offline.");
  }
  lines.push(`Today's training: ${training}.`);
  const upcoming = calendar?.upcoming ?? [];
  if (upcoming.length) {
    const preview = upcoming
      .slice(0, 3)
      .map((e) => `${e.title} on ${fmtDay(e.start)}`)
      .join(", ");
    lines.push(
      `On the horizon over the next thirty days: ${upcoming.length} event${upcoming.length > 1 ? "s" : ""} — nearest: ${preview}.`
    );
  }
  lines.push(`Top priority: ${ranked[0]}.`);

  return Response.json({
    generatedAt: now.toISOString(),
    day: DAYS[now.getDay()],
    calendar: calendar ?? { connected: false },
    gmail: gmail ?? { connected: false },
    training,
    upcoming: upcoming.slice(0, 8),
    priorities: ranked,
    script: lines.join(" "),
  });
}
