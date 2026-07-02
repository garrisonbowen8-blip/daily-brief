"use client";

import { useEffect, useRef, useState } from "react";

// Standalone microphone diagnostic. Visit /mictest to see exactly what the
// browser and OS report — device list, secure-context status, the precise
// getUserMedia error, and a live level meter when it works.

type Dev = { label: string; deviceId: string };

export default function MicTest() {
  const [secure, setSecure] = useState<boolean | null>(null);
  const [host, setHost] = useState("");
  const [devices, setDevices] = useState<Dev[]>([]);
  const [status, setStatus] = useState("idle");
  const [errName, setErrName] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [level, setLevel] = useState(0);
  const rafRef = useRef(0);
  const hasGUM =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const enumerate = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        list
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ label: d.label || "(label hidden until permission granted)", deviceId: d.deviceId }))
      );
    } catch (e) {
      setErrMsg("enumerateDevices failed: " + (e as Error).message);
    }
  };

  useEffect(() => {
    setSecure(window.isSecureContext);
    setHost(location.host);
    enumerate();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const test = async () => {
    setStatus("requesting…");
    setErrName("");
    setErrMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus("✅ MIC WORKS — speak and watch the bar");
      await enumerate(); // labels populate after permission
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(Math.min(100, (sum / data.length / 255) * 300));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      const err = e as DOMException;
      setStatus("❌ FAILED");
      setErrName(err.name || "unknown");
      setErrMsg(err.message || String(e));
    }
  };

  const row = (k: string, v: string, bad = false) => (
    <div style={{ display: "flex", gap: 12, padding: "4px 0", borderBottom: "1px solid #13242f" }}>
      <span style={{ width: 160, color: "#5a7884", textTransform: "uppercase", fontSize: 11, letterSpacing: 2 }}>{k}</span>
      <span style={{ color: bad ? "#ff4f5e" : "#b8d4dc" }}>{v}</span>
    </div>
  );

  return (
    <main style={{ fontFamily: "monospace", color: "#b8d4dc", background: "#04080c", minHeight: "100vh", padding: 32, maxWidth: 720 }}>
      <h1 style={{ color: "#2de2e6", letterSpacing: 6, textTransform: "uppercase", fontSize: 16 }}>Microphone Diagnostic</h1>

      <div style={{ marginTop: 20 }}>
        {row("address", host)}
        {row(
          "secure context",
          secure === null ? "…" : secure ? "yes ✅" : "NO ❌ (mic disabled on non-localhost http)",
          secure === false
        )}
        {row("getUserMedia API", hasGUM ? "present ✅" : "MISSING ❌", !hasGUM)}
        {row("audio input devices", devices.length ? String(devices.length) : "NONE FOUND ❌", devices.length === 0)}
      </div>

      {devices.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12 }}>
          {devices.map((d, i) => (
            <div key={i} style={{ color: "#5a7884" }}>• {d.label}</div>
          ))}
        </div>
      )}

      <button
        onClick={test}
        style={{ marginTop: 24, padding: "10px 20px", background: "transparent", border: "1px solid #2de2e6", color: "#2de2e6", cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}
      >
        ▶ Test microphone
      </button>

      <div style={{ marginTop: 20, fontSize: 14 }}>{status}</div>

      {errName && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ff4f5e", color: "#ff4f5e", fontSize: 13 }}>
          <div><b>Error:</b> {errName}</div>
          <div style={{ marginTop: 4 }}>{errMsg}</div>
        </div>
      )}

      <div style={{ marginTop: 20, height: 24, background: "#0a1118", border: "1px solid #13242f", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${level}%`, background: level > 2 ? "#3ddc84" : "#15707a", transition: "width 0.06s" }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#5a7884" }}>
        green bar should jump when you talk. flat while you speak = the OS is feeding silence.
      </div>
    </main>
  );
}
