import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { MY_DATA_PATH } from "@/lib/connectors";
import { anthropicClient, hasAnthropicAuth } from "@/lib/anthropic";

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

// ── Spoken-brief text synthesis ────────────────────────────────────────────
// Keep the read-aloud brief tight: strip section codes/term tags, group class
// events under one course name, and round big numbers.

// "Developmental Psychology (Summer 2026) [PSYCH N140-LEC-001]" → "Developmental Psychology"
function cleanTitle(title: string): string {
  return title
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\((?:summer|fall|spring|winter)\s*\d{4}\)/gi, "")
    .replace(/\s*[-–—:]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Course code ("PSYCH N140", "ENGIN 170E", "COLWRIT 11") from a prefix or a
// [section] tag, so events can be grouped by class.
function courseCode(title: string): string | null {
  const m = title.match(/\b([A-Z]{3,})\s+(N?\d{1,3}[A-Z]?)\b/);
  return m ? `${m[1]} ${m[2]}` : null;
}

// Compact spoken label for a class event.
function itemType(title: string): string {
  const t = title.toLowerCase();
  if (/\bfinal\b/.test(t)) return "final";
  if (/\bmidterm\b/.test(t)) return "midterm";
  if (/\bexam\b|\btest\b/.test(t)) return "exam";
  if (/\bquiz\b/.test(t)) return "quiz";
  if (/\bdiscussion\b|\bdisc\b/.test(t)) return "discussion";
  if (/\bcheckpoint\b|\bproject\b|\bdeploy\b|\bmilestone\b|\bdeliverable\b/.test(t)) return "project";
  if (/\bpaper\b|\bessay\b/.test(t)) return "paper";
  if (/\bhomework\b|\bassignment\b|\bproblem set\b|\bpset\b|\bdue\b/.test(t)) return "assignment";
  // lectures and generic class sessions read the same — merge to avoid
  // "class Thursday, lecture Thursday" redundancy for the same course.
  return "class";
}

const plural = (w: string) =>
  w === "quiz" ? "quizzes" : /(?:s|x|z|ch|sh)$/.test(w) ? `${w}es` : `${w}s`;

// Weekday name within the coming week; short date beyond that.
function spokenDay(iso: string | null, now: Date): string {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  return days >= 0 && days <= 6
    ? d.toLocaleDateString("en-US", { weekday: "long" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// "a" · "a and b" · "a, b and c"
function joinNatural(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

// 91119 → "about 91 thousand"; small counts read as-is.
function spokenCount(n: number): string {
  return n >= 1000 ? `about ${Math.round(n / 1000)} thousand` : String(n);
}

// Drop a leading "Good morning, …" so an appended sub-brief doesn't greet twice.
function stripGreeting(s: string): string {
  return s.replace(/^\s*good\s+(morning|afternoon|evening|day)\b[^.!?]*[.!?]\s*/i, "").trim();
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

  const [calendar, gmail, marketBrief] = await Promise.all([
    get<CalendarData>("calendar"),
    get<GmailData>("gmail"),
    get<{ script?: string }>("market-brief"),
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
    priorities.push(`Prep for ${cleanTitle(timed[0].title)} at ${fmtTime(timed[0].start)}`);
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

  // Spoken script for the voice module. The template below is the reliable
  // fallback; when the brain is available we rewrite it as a natural, personable
  // brief covering the day, week, and month.
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const lines: string[] = [`${greeting}, sir.`];
  if (calendar?.connected) {
    lines.push(
      timed.length
        ? `You have ${timed.length} event${timed.length > 1 ? "s" : ""} today, first up ${cleanTitle(timed[0].title)} at ${fmtTime(timed[0].start)}.`
        : "Your calendar is clear today."
    );
    if (calendar.freeUntil) lines.push(`You're free until ${fmtTime(calendar.freeUntil)}.`);
  } else {
    lines.push("Calendar is offline.");
  }
  if (gmail?.connected) {
    lines.push(`${spokenCount(gmail.unread ?? 0)} unread in the inbox, ${replies.length} need a reply.`);
    if (gmail.urgent?.length) lines.push(`${gmail.urgent.length} flagged urgent.`);
  } else {
    lines.push("Inbox is offline.");
  }
  lines.push(`Today's training: ${training}.`);
  const upcoming = calendar?.upcoming ?? [];
  let upcomingSummary = "";
  if (upcoming.length) {
    // Group the next several events by class: name each course once, then list
    // its items — instead of re-reading the course code for every entry.
    const byCourse = new Map<string, { type: string; day: string }[]>();
    const loose: string[] = [];
    for (const e of upcoming.slice(0, 8)) {
      const day = spokenDay(e.start, now);
      const code = courseCode(e.title);
      if (code) {
        const arr = byCourse.get(code) ?? [];
        arr.push({ type: itemType(e.title), day });
        byCourse.set(code, arr);
      } else {
        loose.push(`${cleanTitle(e.title)} ${day}`);
      }
    }
    // Merge inconsistent course names for the same class (e.g. "PSYC N140" and
    // "PSYCH N140" → the longer, more complete form).
    for (const a of [...byCourse.keys()]) {
      for (const b of [...byCourse.keys()]) {
        if (a === b || !byCourse.has(a) || !byCourse.has(b)) continue;
        const [da, na] = a.split(" ");
        const [db, nb] = b.split(" ");
        if (na === nb && (da.startsWith(db) || db.startsWith(da))) {
          const keep = da.length >= db.length ? a : b;
          const drop = keep === a ? b : a;
          byCourse.set(keep, [...byCourse.get(keep)!, ...byCourse.get(drop)!]);
          byCourse.delete(drop);
        }
      }
    }
    const chunks: string[] = [];
    for (const [code, items] of byCourse) {
      // one phrase per item type, collecting all of that type's days
      const days = new Map<string, string[]>();
      for (const it of items) {
        const arr = days.get(it.type) ?? [];
        if (!arr.includes(it.day)) arr.push(it.day);
        days.set(it.type, arr);
      }
      const parts = [...days].map(
        ([type, ds]) => `${ds.length > 1 ? plural(type) : type} ${joinNatural(ds)}`
      );
      chunks.push(`${code}: ${parts.join(", ")}`);
    }
    chunks.push(...loose);
    upcomingSummary = chunks.join(". ");
    if (upcomingSummary) lines.push(`Coming up — ${upcomingSummary}.`);
  }
  if (marketBrief?.script) {
    lines.push(stripGreeting(marketBrief.script));
  }
  lines.push(`Top priority: ${ranked[0]}.`);

  // Reliable template fallback.
  let script = lines.join(" ");

  // When the brain is available, rewrite the facts as a natural, personable
  // spoken brief. Falls back to the template on any error.
  if (hasAnthropicAuth()) {
    try {
      const facts = [
        `Time: ${now.toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" })}. Open with "${greeting}".`,
        calendar?.connected
          ? timed.length
            ? `Today: ${timed.length} event(s); first is ${cleanTitle(timed[0].title)} at ${fmtTime(timed[0].start)}.${calendar.freeUntil ? ` Free until ${fmtTime(calendar.freeUntil)}.` : ""}`
            : "Today: calendar is clear."
          : "Today: calendar offline.",
        gmail?.connected
          ? `Inbox: ${spokenCount(gmail.unread ?? 0)} unread, ${replies.length} need replies${
              gmail.urgent?.length
                ? `, ${gmail.urgent.length} urgent (${gmail.urgent.slice(0, 3).map((u) => u.subject).join("; ")})`
                : ""
            }.`
          : "Inbox: offline.",
        `Training today: ${training}.`,
        upcomingSummary ? `Week & month ahead (already grouped by class): ${upcomingSummary}.` : "",
        ranked.length ? `Top priorities in order: ${ranked.join("; ")}.` : "",
        marketBrief?.script
          ? `Market & portfolio color (weave in briefly, in your own voice, no second greeting): ${stripGreeting(marketBrief.script)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const client = anthropicClient();
      const msg = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 700,
        output_config: { effort: "low" },
        system:
          "You are JARVIS, Garrison's personal assistant — sharp, well-educated, dry wit, a touch of modern slang, never sycophantic or corny. Turn the facts into his SPOKEN brief for text-to-speech: one flowing piece of natural prose — no markdown, no lists, no headings, no emoji. Greet him exactly once (use the greeting given) and call him \"sir\" or by name once or twice. Move through the day, then the week ahead, then the month ahead, weaving the facts into a cohesive narrative; keep a class's items grouped together, and never read raw course codes, IDs, or long exact numbers. Land one light joke or aside where it fits, but stay useful and grounded — you're briefing him, not doing standup. Roughly 130-200 words. Close on the single most important thing to handle.",
        messages: [{ role: "user", content: `Today's facts:\n\n${facts}` }],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      if (text) script = text;
    } catch {
      // keep the template script
    }
  }

  return Response.json({
    generatedAt: now.toISOString(),
    day: DAYS[now.getDay()],
    calendar: calendar ?? { connected: false },
    gmail: gmail ?? { connected: false },
    training,
    upcoming: upcoming.slice(0, 8),
    priorities: ranked,
    script,
  });
}
