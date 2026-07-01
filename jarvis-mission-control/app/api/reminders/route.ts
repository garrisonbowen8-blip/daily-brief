import { exec } from "child_process";
import { promisify } from "util";

const run = promisify(exec);

export const dynamic = "force-dynamic";

type Reminder = {
  list: string;
  name: string;
  due: string | null;
  overdue: boolean;
  dueToday: boolean;
};

async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await run(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
  return stdout.trim();
}

export async function GET() {
  try {
    const script = `
tell application "Reminders"
  set output to {}
  repeat with l in lists
    set listName to name of l
    set incomplete to (reminders of l whose completed is false)
    repeat with r in incomplete
      set rName to name of r
      set rDue to "none"
      try
        set rDue to (due date of r) as string
      end try
      set end of output to listName & "|||" & rName & "|||" & rDue
    end repeat
  end repeat
  return output
end tell`;

    const { stdout } = await run(`osascript << 'APPLESCRIPT'\n${script}\nAPPLESCRIPT`);
    const raw = stdout.trim();
    if (!raw) return Response.json({ connected: true, reminders: [] });

    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const reminders: Reminder[] = raw
      .split(", ")
      .map(item => {
        const parts = item.split("|||");
        if (parts.length < 2) return null;
        const [list, name, dueStr] = parts;
        let due: string | null = null;
        let overdue = false;
        let dueToday = false;
        if (dueStr && dueStr !== "none") {
          try {
            const d = new Date(dueStr);
            due = d.toISOString();
            overdue = d < now;
            dueToday = d <= todayEnd && d >= new Date(now.setHours(0,0,0,0));
          } catch { /* unparseable date */ }
        }
        return { list: list.trim(), name: name.trim(), due, overdue, dueToday };
      })
      .filter((r): r is Reminder => r !== null && r.name.length > 0);

    // Sort: overdue first, then due today, then by due date, then no date
    reminders.sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      if (a.dueToday && !b.dueToday) return -1;
      if (!a.dueToday && b.dueToday) return 1;
      if (a.due && b.due) return new Date(a.due).getTime() - new Date(b.due).getTime();
      if (a.due) return -1;
      if (b.due) return 1;
      return 0;
    });

    return Response.json({ connected: true, reminders });
  } catch (err) {
    return Response.json({
      connected: false,
      reason: err instanceof Error ? err.message : "AppleScript failed",
    });
  }
}

// Mark a reminder complete by list + name
export async function POST(request: Request) {
  try {
    const { list, name } = await request.json() as { list: string; name: string };
    const script = `
tell application "Reminders"
  set targetList to list "${list.replace(/"/g, '\\"')}"
  set matchedReminders to (reminders of targetList whose name is "${name.replace(/"/g, '\\"')}" and completed is false)
  if length of matchedReminders > 0 then
    set completed of item 1 of matchedReminders to true
    return "ok"
  end if
  return "not found"
end tell`;

    const { stdout } = await run(`osascript << 'APPLESCRIPT'\n${script}\nAPPLESCRIPT`);
    const result = stdout.trim();
    return Response.json({ ok: result === "ok" });
  } catch (err) {
    return Response.json({ ok: false, reason: err instanceof Error ? err.message : "failed" });
  }
}
