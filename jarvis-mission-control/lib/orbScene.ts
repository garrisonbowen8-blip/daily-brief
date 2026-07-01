"use client";

import * as THREE from "three";
import { getLevel, getVoiceState, VoiceState } from "./voiceState";

const STATE_COLORS: Record<VoiceState, number> = {
  idle:      0x2de2e6,
  listening: 0xff4f5e,
  thinking:  0xffb347,
  speaking:  0x2de2e6,
};

function makeCircleSprite(): THREE.Texture {
  const sz = 32;
  const cv = document.createElement("canvas");
  cv.width = cv.height = sz;
  const ctx = cv.getContext("2d")!;
  const r = sz / 2;
  const grd = ctx.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0,    "rgba(255,255,255,1.0)");
  grd.addColorStop(0.55, "rgba(255,255,255,1.0)");
  grd.addColorStop(0.82, "rgba(255,255,255,0.5)");
  grd.addColorStop(1.0,  "rgba(255,255,255,0.0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, sz, sz);
  return new THREE.CanvasTexture(cv);
}

function sphereShell(count: number, radius: number, spread: number): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / count);
    const phi   = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = radius + (Math.random() - 0.5) * spread;
    pos[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
    pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
    pos[i * 3 + 2] = r * Math.cos(theta);
  }
  return pos;
}

export function initOrb(canvas: HTMLCanvasElement, size = 400): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const sprite = makeCircleSprite();
  const color  = new THREE.Color(STATE_COLORS.idle);

  function makeLayer(count: number, radius: number, spread: number, ptSize: number, opacity: number) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(sphereShell(count, radius, spread), 3));
    const mat = new THREE.PointsMaterial({
      map: sprite,
      alphaTest: 0.08,
      color,
      size: ptSize,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return { pts, geo, mat };
  }

  const outer = makeLayer(9000, 2.0,  0.14, 0.038, 0.80);
  const inner = makeLayer(4000, 1.35, 0.12, 0.028, 0.90);
  const stars = makeLayer(800,  1.85, 0.08, 0.065, 0.95);

  // Soft central glow — no rings, just bloom
  const glowCvs = document.createElement("canvas");
  glowCvs.width = glowCvs.height = 128;
  const gctx = glowCvs.getContext("2d")!;
  const grd = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0,    "rgba(255,255,255,1)");
  grd.addColorStop(0.20, "rgba(255,255,255,0.6)");
  grd.addColorStop(0.55, "rgba(255,255,255,0.12)");
  grd.addColorStop(1,    "rgba(255,255,255,0)");
  gctx.fillStyle = grd;
  gctx.fillRect(0, 0, 128, 128);
  const glowMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCvs),
    color, transparent: true, opacity: 0.50,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(1.6);
  scene.add(glow);

  const clock = new THREE.Clock();
  let raf = 0;
  let smooth = 0;
  const target = new THREE.Color(STATE_COLORS.idle);

  const frame = () => {
    const t = clock.getElapsedTime();
    const s = getVoiceState();

    // Breathing parameters per state
    const breatheSpeed  = s === "speaking" ? 2.8 : s === "listening" ? 1.6 : s === "thinking" ? 3.5 : 0.6;
    const breatheDepth  = s === "speaking" ? 0.09 : s === "listening" ? 0.05 : s === "thinking" ? 0.07 : 0.035;
    const breathe       = Math.sin(t * breatheSpeed) * breatheDepth;

    // Audio level smoothing
    const synth =
      s === "speaking"  ? 0.25 + 0.18 * Math.sin(t * 7) + 0.08 * Math.sin(t * 17)
      : s === "listening" ? 0.10 + 0.05 * Math.sin(t * 4)
      : s === "thinking"  ? 0.18 + 0.06 * Math.sin(t * 3)
      : 0.0;
    smooth += (Math.max(getLevel(), synth) - smooth) * 0.08;

    target.set(STATE_COLORS[s]);
    color.lerp(target, 0.06);

    // Outer shell: breathes on its own sine, slow drift rotation
    const outerScale = 1.0 + breathe + smooth * 0.06;
    outer.pts.scale.setScalar(outerScale);
    outer.pts.rotation.y = t * 0.04;
    outer.pts.rotation.x = Math.sin(t * 0.07) * 0.06;
    outer.mat.color.copy(color);
    outer.mat.opacity = 0.72 + smooth * 0.20;

    // Inner core: breathes slightly out of phase for organic depth
    const innerScale = 1.0 + Math.sin(t * breatheSpeed + 0.8) * breatheDepth * 0.7 + smooth * 0.05;
    inner.pts.scale.setScalar(innerScale);
    inner.pts.rotation.y = -t * 0.07;
    inner.pts.rotation.z = Math.sin(t * 0.09) * 0.05;
    inner.mat.color.copy(color);
    inner.mat.opacity = 0.88 + smooth * 0.12;

    // Stars: very slow tumble, brighten with audio
    stars.pts.scale.setScalar(1.0 + breathe * 0.5 + smooth * 0.12);
    stars.pts.rotation.x = t * 0.03;
    stars.mat.color.copy(color);
    stars.mat.opacity = 0.80 + smooth * 0.20;

    // Glow pulses with the breath
    glowMat.color.copy(color);
    glowMat.opacity = 0.40 + breathe * 3 + smooth * 0.45;
    glow.scale.setScalar(1.5 + breathe * 8 + smooth * 1.8);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
    outer.geo.dispose(); outer.mat.dispose();
    inner.geo.dispose(); inner.mat.dispose();
    stars.geo.dispose(); stars.mat.dispose();
    sprite.dispose();    glowMat.dispose();
  };
}
