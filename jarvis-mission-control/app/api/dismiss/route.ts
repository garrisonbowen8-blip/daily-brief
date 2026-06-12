import { loadDismissed, saveDismissed } from "@/lib/dismissed";

// Mark/unmark email threads as "doesn't need me" so the Gmail route stops
// surfacing them — to the tile, the brief, and the voice agent alike.

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ dismissed: Object.keys(loadDismissed()) });
}

export async function POST(request: Request) {
  const { threadId } = await request.json();
  if (typeof threadId !== "string" || !threadId) {
    return Response.json({ ok: false, error: "threadId required" }, { status: 400 });
  }
  const data = loadDismissed();
  data[threadId] = Date.now();
  saveDismissed(data);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { threadId } = await request.json();
  const data = loadDismissed();
  delete data[threadId];
  saveDismissed(data);
  return Response.json({ ok: true });
}
