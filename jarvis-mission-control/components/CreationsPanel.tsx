"use client";

import { useState } from "react";
import Panel from "./Panel";
import { useConnector } from "@/lib/useConnector";

type Creation = {
  id: string;
  kind: "image" | "video";
  url: string;
  poster?: string;
  prompt: string;
  at: number;
};

export default function CreationsPanel() {
  // poll the shared store so voice-generated media shows up here too
  const { data } = useConnector<{ creations: Creation[] }>("/api/creations", 8000);
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<"image" | "video">("image");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/higgsfield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt: prompt.trim() }),
      });
      const json = await res.json();
      if (!json.ok && json.connected === false) setError(json.reason);
      else if (!json.ok) setError(json.error ?? "generation failed");
      else setPrompt("");
    } catch {
      setError("request failed");
    } finally {
      setBusy(false);
    }
  };

  const creations = data?.creations ?? [];

  return (
    <Panel title="Creations — Higgsfield" status="online" className="md:col-span-2">
      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5 items-center">
          <div className="flex border border-edge rounded overflow-hidden text-[9px] uppercase tracking-widest">
            {(["image", "video"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-2 py-1 ${kind === k ? "bg-cyan/15 text-cyan" : "text-dim"}`}
              >
                {k}
              </button>
            ))}
          </div>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
            placeholder={`describe a ${kind} for ATLAS to render…`}
            className="flex-1 bg-transparent border border-edge rounded px-2 py-1 text-[11px] outline-none placeholder:text-dim focus:border-cyan"
          />
          <button
            onClick={generate}
            disabled={busy}
            className={`text-[9px] tracking-widest border rounded px-2 py-1 ${
              busy ? "border-amber text-amber blink" : "border-cyan text-cyan hover:bg-cyan/10"
            }`}
          >
            {busy ? "RENDERING…" : "▶ GENERATE"}
          </button>
        </div>
        {busy && (
          <p className="text-[10px] text-amber">
            Higgsfield is rendering your {kind} — {kind === "video" ? "a few minutes" : "~30–60s"}.
            It appears below when ready.
          </p>
        )}
        {error && <p className="text-[10px] text-red">{error}</p>}

        {creations.length === 0 ? (
          <p className="text-[11px] text-dim">
            Nothing yet. Type a prompt, or say “ATLAS, make me an image of…”.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {creations.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                title={c.prompt}
                className="group relative aspect-square overflow-hidden rounded border border-edge"
              >
                {c.kind === "video" ? (
                  <video
                    src={c.url}
                    poster={c.poster}
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.url} alt={c.prompt} className="h-full w-full object-cover" />
                )}
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-[8px] text-fg opacity-0 group-hover:opacity-100">
                  {c.kind === "video" ? "▶ " : ""}
                  {c.prompt}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
