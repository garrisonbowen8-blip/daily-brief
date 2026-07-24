"use client";

// Full-screen fixed WebGL orb. Renders behind all content (z-index 0, pointer-events none).
// The orb is not a widget — it's ambient presence that bleeds freely across the viewport.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getLevel, getVoiceState, onVoiceState, VoiceState } from "@/lib/voiceState";

const STATE_COLORS: Record<VoiceState, number> = {
  idle:      0x2de2e6,
  listening: 0xff4f5e,
  thinking:  0xffb347,
  speaking:  0x2de2e6,
};

export default function OrbBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const aspect = W / H;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 200);
    camera.position.set(0, 0, 9);

    const color = new THREE.Color(STATE_COLORS.idle);

    // ── Outer wireframe shell ───────────────────────────────────────────
    const shellGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.2, 2));
    const shellMat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const shell = new THREE.LineSegments(shellGeo, shellMat);
    scene.add(shell);

    // ── Inner wireframe ─────────────────────────────────────────────────
    const innerGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.3, 1));
    const innerMat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const inner = new THREE.LineSegments(innerGeo, innerMat);
    scene.add(inner);

    // ── Torus rings ─────────────────────────────────────────────────────
    const ringDefs = [
      { r: 2.6, tube: 0.007, rot: [0, 0, 0] as [number,number,number], op: 0.55 },
      { r: 2.3, tube: 0.005, rot: [Math.PI/3, 0, Math.PI/4] as [number,number,number], op: 0.40 },
      { r: 2.1, tube: 0.005, rot: [-Math.PI/4, Math.PI/6, 0] as [number,number,number], op: 0.35 },
      { r: 1.6, tube: 0.004, rot: [Math.PI/2, 0, Math.PI/5] as [number,number,number], op: 0.25 },
    ];
    const rings = ringDefs.map(({ r, tube, rot, op }) => {
      const geo = new THREE.TorusGeometry(r, tube, 4, 96);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      scene.add(mesh);
      return { mesh, mat };
    });

    // ── Great circle arcs ────────────────────────────────────────────────
    function makeArc(radius: number, axisVec: [number,number,number], op: number, initAngle: number) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      const axis = new THREE.Vector3(...axisVec).normalize();
      line.setRotationFromAxisAngle(axis, initAngle);
      scene.add(line);
      return { line, mat };
    }
    const arcs = [
      makeArc(2.35, [1, 0, 0], 0.45, 0.3),
      makeArc(2.15, [0.6, 0.8, 0], 0.3, 1.2),
      makeArc(1.95, [0.3, 0.5, 0.8], 0.22, 2.1),
    ];

    // ── Ambient background particles ─────────────────────────────────────
    // Sparse distant points scattered across the viewport — NOT the orb.
    const ambCount = 280;
    const ambPositions = new Float32Array(ambCount * 3);
    const spread = 14; // wider than orb, fills the viewport edges
    for (let i = 0; i < ambCount; i++) {
      ambPositions[i * 3]     = (Math.random() - 0.5) * spread * aspect * 2;
      ambPositions[i * 3 + 1] = (Math.random() - 0.5) * spread;
      ambPositions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 3; // behind orb
    }
    const ambGeo = new THREE.BufferGeometry();
    ambGeo.setAttribute("position", new THREE.BufferAttribute(ambPositions, 3));
    const ambMat = new THREE.PointsMaterial({
      color, transparent: true, opacity: 0.18, size: 0.04,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const amb = new THREE.Points(ambGeo, ambMat);
    scene.add(amb);

    // ── Center glow sprite ───────────────────────────────────────────────
    const glowCvs = document.createElement("canvas");
    glowCvs.width = glowCvs.height = 128;
    const gctx = glowCvs.getContext("2d")!;
    const grd = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0,   "rgba(255,255,255,1)");
    grd.addColorStop(0.15,"rgba(255,255,255,0.6)");
    grd.addColorStop(1,   "rgba(255,255,255,0)");
    gctx.fillStyle = grd;
    gctx.fillRect(0, 0, 128, 128);
    const glowMat = new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCvs),
      color, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(1.8);
    scene.add(glow);

    // ── Resize handler ───────────────────────────────────────────────────
    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Frame loop ───────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    let smooth = 0;
    const target = new THREE.Color(STATE_COLORS.idle);
    // Breathing drift: orb moves slightly based on sin waves
    const drift = new THREE.Vector3();

    const frame = () => {
      const t = clock.getElapsedTime();
      const s = getVoiceState();

      const synth =
        s === "speaking"  ? 0.4 + 0.22 * Math.sin(t * 8) + 0.1 * Math.sin(t * 19)
        : s === "listening" ? 0.18 + 0.07 * Math.sin(t * 5)
        : s === "thinking"  ? 0.28 + 0.09 * Math.sin(t * 3.5)
        : 0.03 + 0.015 * Math.sin(t * 1.1);
      smooth += (Math.max(getLevel(), synth) - smooth) * 0.08;

      target.set(STATE_COLORS[s]);
      color.lerp(target, 0.05);

      const spin = s === "thinking" ? 2.5 : 1.0;
      const pulse = 1 + smooth * 0.1;

      // Gentle orb drift — breathes through the layout
      drift.set(
        Math.sin(t * 0.13) * 0.08,
        Math.sin(t * 0.19) * 0.06,
        0
      );
      shell.position.copy(drift);
      inner.position.copy(drift);
      glow.position.copy(drift);
      rings.forEach(({ mesh }) => mesh.position.copy(drift));
      arcs.forEach(({ line }) => line.position.copy(drift));

      shell.rotation.y = t * 0.07 * spin;
      shell.rotation.x = Math.sin(t * 0.1) * 0.14;
      shell.scale.setScalar(pulse);
      shellMat.color.copy(color);
      shellMat.opacity = 0.22 + smooth * 0.28;

      inner.rotation.y = -t * 0.16 * spin;
      inner.rotation.z = Math.sin(t * 0.13) * 0.18;
      innerMat.color.copy(color);
      innerMat.opacity = 0.42 + smooth * 0.32;

      rings[0].mesh.rotation.z = t * 0.11 * spin;
      rings[1].mesh.rotation.x = t * 0.08 * spin + Math.PI / 3;
      rings[2].mesh.rotation.y = t * 0.13 * spin - Math.PI / 4;
      rings[3].mesh.rotation.z = -t * 0.19 * spin + Math.PI / 5;
      rings.forEach(({ mat }) => { mat.color.copy(color); });

      arcs[0].line.rotation.y = t * 0.055;
      arcs[1].line.rotation.x = t * 0.09;
      arcs[2].line.rotation.z = -t * 0.075;
      arcs.forEach(({ mat }) => { mat.color.copy(color); });

      ambMat.color.copy(color);
      ambMat.opacity = 0.1 + smooth * 0.12;
      amb.rotation.y = t * 0.005;

      glowMat.color.copy(color);
      glowMat.opacity = 0.3 + smooth * 0.45;
      glow.scale.setScalar(1.4 + smooth * 1.4);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const unsub = onVoiceState(() => {});

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      unsub();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
