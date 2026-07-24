import { loadDailyBriefConfig } from "@/lib/connectors";

// Speech-to-text via ElevenLabs Scribe — replaces Chrome's flaky Web Speech
// recognizer. The client records mic audio and posts it here; we proxy to
// ElevenLabs so the key never reaches the browser. GET reports availability
// so the client knows which capture path to use.

export const dynamic = "force-dynamic";

function getKey(): string | undefined {
  const cfg = loadDailyBriefConfig() as { elevenlabs?: { apiKey?: string } } | null;
  return process.env.ELEVENLABS_API_KEY || cfg?.elevenlabs?.apiKey;
}

export async function GET() {
  return Response.json({ available: Boolean(getKey()) });
}

export async function POST(request: Request) {
  const key = getKey();
  if (!key) {
    return Response.json(
      { fallback: true, reason: "ElevenLabs key not configured" },
      { status: 503 }
    );
  }

  const inForm = await request.formData();
  const audio = inForm.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "audio required" }, { status: 400 });
  }

  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("file", audio, "speech.webm");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });

  if (!res.ok) {
    return Response.json(
      { fallback: true, reason: `ElevenLabs STT ${res.status}` },
      { status: 503 }
    );
  }

  const data = (await res.json()) as { text?: string };
  return Response.json({ text: (data.text ?? "").trim() });
}
