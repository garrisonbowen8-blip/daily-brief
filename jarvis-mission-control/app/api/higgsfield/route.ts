import { notConnected } from "@/lib/connectors";
import { addCreation } from "@/lib/creations";

// Higgsfield generative media — text→image (Soul) and text/image→video (DoP).
// Async + polling, handled by the official SDK. Needs HF_CREDENTIALS
// ("KEY_ID:KEY_SECRET") in .env.local. Degrades to "not connected" without it.

export const dynamic = "force-dynamic";
export const maxDuration = 600; // video renders can take minutes

type Body = {
  kind: "image" | "video";
  prompt: string;
  imageUrl?: string; // optional seed image for video
  size?: string; // e.g. "1536x1536", "1080x1920"
};

export async function POST(request: Request) {
  if (!process.env.HF_CREDENTIALS) {
    return notConnected(
      'Set HF_CREDENTIALS="KEY_ID:KEY_SECRET" in .env.local (from cloud.higgsfield.ai → API keys)'
    );
  }

  const { kind, prompt, imageUrl, size } = (await request.json()) as Body;
  if (!prompt || typeof prompt !== "string") {
    return Response.json({ ok: false, error: "prompt required" }, { status: 400 });
  }

  try {
    const { higgsfield } = await import("@higgsfield/client/v2");

    const makeImage = async (p: string) => {
      const res = await higgsfield.subscribe("/v1/text2image/soul", {
        input: {
          prompt: p,
          width_and_height: size ?? "1536x1536",
          quality: "1080p",
          batch_size: 1,
          enhance_prompt: true,
        },
        withPolling: true,
      });
      const url = res.images?.[0]?.url;
      if (!url) throw new Error(`no image returned (status ${res.status})`);
      return url;
    };

    if (kind === "image") {
      const url = await makeImage(prompt);
      addCreation({ kind: "image", url, prompt });
      return Response.json({ ok: true, kind: "image", url, prompt });
    }

    // video: use the provided seed image, or soul-generate one from the prompt first
    const seed = imageUrl ?? (await makeImage(prompt));
    const res = await higgsfield.subscribe("/v1/image2video/dop", {
      input: {
        model: "dop-turbo",
        prompt,
        input_images: [{ type: "image_url", image_url: seed }],
        enhance_prompt: true,
      },
      withPolling: true,
    });
    const url = res.video?.url;
    if (!url) throw new Error(`no video returned (status ${res.status})`);
    addCreation({ kind: "video", url, poster: seed, prompt });
    return Response.json({ ok: true, kind: "video", url, poster: seed, prompt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generation failed";
    return Response.json({ ok: false, error: msg }, { status: 502 });
  }
}
