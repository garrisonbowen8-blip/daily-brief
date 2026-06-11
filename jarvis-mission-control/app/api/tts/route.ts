// ElevenLabs proxy. The API key lives in .env.local and never reaches the
// client bundle. If the key is missing, return 503 — the client falls back
// to the browser's SpeechSynthesis API.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return Response.json(
      { fallback: true, reason: "ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID not set" },
      { status: 503 }
    );
  }

  const { text } = await request.json();
  if (!text || typeof text !== "string") {
    return Response.json({ error: "text required" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_turbo_v2_5",
        voice_settings: { stability: 0.45, style: 0.35 },
      }),
    }
  );

  if (!res.ok) {
    return Response.json(
      { fallback: true, reason: `ElevenLabs ${res.status}` },
      { status: 503 }
    );
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
