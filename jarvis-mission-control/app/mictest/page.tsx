"use client";

import { useEffect, useRef, useState } from "react";

// Standalone microphone diagnostic + guided fixer. Visit /mictest to see
// exactly what the browser and OS report — device list, permission state,
// secure-context status, the precise getUserMedia error, a live level meter —
// plus a step-by-step fix checklist matched to the specific failure.
// The page re-scans automatically, so leave it open while flipping settings:
// it flips to "device detected" the moment Chrome can see a mic.

type Dev = { label: string; deviceId: string };

export default function MicTest() {
  const [secure, setSecure] = useState<boolean | null>(null);
  const [host, setHost] = useState("");
  const [devices, setDevices] = useState<Dev[]>([]);
  const [permState, setPermState] = useState<string>("…");
  const [status, setStatus] = useState("idle");
  const [errName, setErrName] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [level, setLevel] = useState(0);
  const [lastScan, setLastScan] = useState("");
  // Everything on this page depends on browser-only APIs (devices, permission,
  // secure context) that don't exist during SSR. Render a stable placeholder
  // until mounted so the server and first client render match — no hydration
  // mismatch.
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
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
      setLastScan(new Date().toLocaleTimeString());
    } catch (e) {
      setErrMsg("enumerateDevices failed: " + (e as Error).message);
    }
  };

  const readPermission = async () => {
    try {
      const p = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setPermState(p.state);
      p.onchange = () => setPermState(p.state);
    } catch {
      setPermState("unknown");
    }
  };

  useEffect(() => {
    setMounted(true);
    setSecure(window.isSecureContext);
    setHost(location.host);
    enumerate();
    readPermission();
    // Live updates: Chrome fires devicechange when a mic (dis)appears, and we
    // poll as a fallback so the page reacts while the user flips OS settings.
    navigator.mediaDevices?.addEventListener?.("devicechange", enumerate);
    const poll = setInterval(enumerate, 3000);
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      navigator.mediaDevices?.removeEventListener?.("devicechange", enumerate);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const test = async (deviceId?: string) => {
    setStatus("requesting…");
    setErrName("");
    setErrMsg("");
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      streamRef.current = stream;
      const label = stream.getAudioTracks()[0]?.label;
      setStatus(`✅ MIC WORKS${label ? ` (${label})` : ""} — speak and watch the bar`);
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

  const cmd = (c: string) => (
    <code style={{ display: "block", margin: "6px 0", padding: "6px 10px", background: "#0a1118", border: "1px solid #1b3542", color: "#2de2e6", fontSize: 12, userSelect: "all" }}>{c}</code>
  );

  const noDevices = devices.length === 0;
  const denied = permState === "denied" || errName === "NotAllowedError";
  const notFound = errName === "NotFoundError" || (noDevices && lastScan !== "");

  if (!mounted) {
    return (
      <main style={{ fontFamily: "monospace", color: "#b8d4dc", background: "#04080c", minHeight: "100vh", padding: 32, maxWidth: 720 }}>
        <h1 style={{ color: "#2de2e6", letterSpacing: 6, textTransform: "uppercase", fontSize: 16 }}>Microphone Diagnostic</h1>
        <div style={{ marginTop: 20, color: "#5a7884" }}>initializing…</div>
      </main>
    );
  }

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
        {row("chrome permission", permState + (permState === "denied" ? " ❌" : permState === "granted" ? " ✅" : ""), permState === "denied")}
        {row(
          "audio input devices",
          devices.length ? `${devices.length} ✅` : "NONE FOUND ❌",
          devices.length === 0
        )}
        {lastScan && row("re-scans every 3s", `last scan ${lastScan} — leave this page open while you fix settings`)}
      </div>

      {devices.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12 }}>
          {devices.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 0", color: "#5a7884" }}>
              <span>• {d.label}</span>
              {d.deviceId && (
                <button
                  onClick={() => test(d.deviceId)}
                  style={{ padding: "1px 8px", background: "transparent", border: "1px solid #1b3542", color: "#2de2e6", cursor: "pointer", fontSize: 10, letterSpacing: 1 }}
                >
                  test this one
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => test()}
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

      {/* ── Guided fix, matched to what's actually wrong ─────────────────── */}
      {(notFound || denied) && (
        <div style={{ marginTop: 28, padding: 16, border: "1px solid #1b3542", fontSize: 13, lineHeight: 1.7 }}>
          <div style={{ color: "#2de2e6", letterSpacing: 3, textTransform: "uppercase", fontSize: 12, marginBottom: 10 }}>
            {denied && !notFound ? "Fix: Chrome is blocked from the mic" : "Fix: Chrome sees no microphone at all"}
          </div>

          {denied && !notFound ? (
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              <li>Click the icon just left of the address bar → Microphone → <b>Allow</b>, then reload.</li>
              <li>
                If it&apos;s still blocked, it&apos;s the macOS toggle. Paste this in Terminal, turn <b>Google Chrome</b> ON:
                {cmd('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"')}
              </li>
              <li>Fully quit Chrome (⌘Q — not just the window) and reopen. Chrome only re-reads that toggle on launch.</li>
            </ol>
          ) : (
            <>
              <div style={{ color: "#5a7884", marginBottom: 8 }}>
                This means Chrome&apos;s device list is empty — usually macOS, not ATLAS. Run the Mic Doctor in Terminal; it
                checks the Mac&apos;s audio engine directly and tells you exactly which fix you need:
              </div>
              {cmd("cd ~/daily-brief/jarvis-mission-control && npm run micfix")}
              <div style={{ color: "#5a7884", marginTop: 10 }}>Or do it manually, in order:</div>
              <ol style={{ paddingLeft: 18, margin: "6px 0 0" }}>
                <li>
                  System Settings → Sound → <b>Input</b>: does &quot;MacBook Pro Microphone&quot; appear, and does its level
                  meter move when you talk?
                  {cmd('open "x-apple.systempreferences:com.apple.Sound-Settings.extension"')}
                </li>
                <li>
                  If <b>NO devices</b> there → the Mac&apos;s audio engine is stuck. Paste in Terminal (asks for your password),
                  wait 5 seconds, recheck:
                  {cmd("sudo killall coreaudiod")}
                  Still empty? Restart the Mac.
                </li>
                <li>
                  If the mic <b>IS</b> there → it&apos;s Chrome: check the macOS privacy toggle
                  (System Settings → Privacy &amp; Security → Microphone → Chrome ON), then <b>fully quit Chrome (⌘Q)</b> and
                  reopen, then in Chrome open <b>chrome://settings/content/microphone</b> and pick your real mic in the dropdown.
                </li>
                <li>This page rescans every 3 seconds — when &quot;audio input devices&quot; turns green, hit Test again.</li>
              </ol>
            </>
          )}
        </div>
      )}
    </main>
  );
}
