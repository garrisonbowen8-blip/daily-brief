// Command console intent handler.
// TODO: wire real intents (run brief, draft reply, query Buddy Check, etc.).
// For now it recognizes a few verbs and stubs the rest, so the console and
// voice command bar feel alive end-to-end.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { command } = await request.json();
  const c = String(command ?? "").toLowerCase();

  if (/\b(brief|briefing|morning)\b/.test(c)) {
    return Response.json({ intent: "run_brief", reply: "Running your daily brief now." });
  }
  if (/\b(vitals|system|status)\b/.test(c)) {
    return Response.json({ intent: "show_vitals", reply: "System vitals are on screen, sir." });
  }
  if (/\b(buddy|check.?in|pulse)\b/.test(c)) {
    return Response.json({ intent: "buddy_pulse", reply: "Pulling the Buddy Check pulse." });
  }

  // TODO: route unrecognized commands to a real intent model
  return Response.json({
    intent: "unknown",
    reply: `Intent handler stub — I heard: "${command}". Wiring for this command is on the bench.`,
  });
}
