"use client";

import * as THREE from "three";
import { getLevel, getVoiceState, VoiceState } from "./voiceState";

// JARVIS data-hologram: a sphere assembled from ~45k glowing data particles
// clustered into circuit-board patches across layered shells, with circuit
// trace lines, orbit arcs and a counter-rotating inner core — the Age of
// Ultron hologram, in blue. Reacts live to voiceState: color morphs, the
// cloud breathes with audio level, rotation whips up while thinking.

const STATE_COLORS: Record<VoiceState, number> = {
  idle: 0x3ec6ff,
  listening: 0xff4f5e,
  thinking: 0xffb347,
  speaking: 0x7ae6ff,
};

const PARTICLE_VERT = /* glsl */ `
attribute float aSize;
attribute float aBright;
attribute float aPhase;
attribute float aSpeed;
uniform float uTime;
uniform float uLevel;
uniform float uScale;
varying float vBright;
void main() {
  float twinkle = 0.65 + 0.35 * sin(uTime * aSpeed + aPhase);
  vBright = aBright * twinkle;
  // particles shiver outward with audio level
  vec3 dir = normalize(position);
  vec3 p = position + dir * sin(uTime * (1.5 + aSpeed) + aPhase * 7.0) * (0.015 + uLevel * 0.12);
  p *= 1.0 + uLevel * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // uScale keeps particle size proportional to the canvas — the 19.0 factor
  // was tuned at 400px; without it a bigger orb renders sparse and grainy
  gl_PointSize = aSize * uScale * (16.5 / -mv.z) * (0.8 + 0.25 * twinkle + uLevel * 0.4);
  gl_Position = projectionMatrix * mv;
}
`;

const PARTICLE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vBright;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  // crisp pinpoint: near-solid core, hard edge, only a hairline of softness
  float dot = smoothstep(0.5, 0.44, d);
  float spark = smoothstep(0.26, 0.0, d) * pow(vBright, 1.5); // tiny white center on bright ones
  vec3 col = mix(uColor * 0.5, mix(uColor, vec3(1.0), 0.9), pow(vBright, 2.0));
  col += vec3(1.0) * spark * 0.6;
  gl_FragColor = vec4(col, dot * (0.28 + vBright * 0.62));
}
`;

// random unit vector
function randDir(): THREE.Vector3 {
  const v = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1
  );
  return v.lengthSq() < 1e-6 ? randDir() : v.normalize();
}

type CloudSpec = {
  count: number;
  patches: number;
  rMin: number;
  rMax: number;
  patchSpread: number; // angular size of each circuit patch
  baseSize: number;
};

function buildCloud(spec: CloudSpec, color: THREE.Color) {
  const { count, patches, rMin, rMax, patchSpread, baseSize } = spec;
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const bright = new Float32Array(count);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);

  // circuit patch centers, each with its own shell radius and local axes
  const centers: { dir: THREE.Vector3; r: number; u: THREE.Vector3; v: THREE.Vector3 }[] = [];
  for (let i = 0; i < patches; i++) {
    const dir = randDir();
    const u = new THREE.Vector3().crossVectors(dir, randDir()).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u).normalize();
    centers.push({ dir, r: rMin + Math.random() * (rMax - rMin), u, v });
  }

  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const scatter = Math.random() < 0.12;
    if (scatter) {
      // sparse free-floating data motes between shells
      p.copy(randDir()).multiplyScalar(rMin * 0.9 + Math.random() * (rMax - rMin) * 1.25);
    } else {
      const c = centers[(Math.random() * patches) | 0];
      // grid-ish offsets inside the patch read as circuitry, not fuzz
      const gx = (Math.round((Math.random() * 2 - 1) * 6) / 6) * patchSpread;
      const gy = (Math.round((Math.random() * 2 - 1) * 6) / 6) * patchSpread;
      const jitter = (Math.random() - 0.5) * patchSpread * 0.18;
      p.copy(c.dir)
        .multiplyScalar(c.r + (Math.random() - 0.5) * 0.05)
        .addScaledVector(c.u, gx + jitter)
        .addScaledVector(c.v, gy + jitter);
    }
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;
    const hot = Math.random();
    size[i] = baseSize * (0.6 + Math.random() * 0.7);
    bright[i] = hot < 0.08 ? 1.0 : 0.15 + Math.random() * 0.45; // brighter sparks, dimmer filler = more contrast
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.4 + Math.random() * 2.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));

  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uColor: { value: color },
    uScale: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return { points: new THREE.Points(geo, mat), uniforms, geo, mat };
}

// short circuit-trace polylines hugging the sphere surface
function buildTraces(count: number, rMin: number, rMax: number, color: THREE.Color) {
  const verts: number[] = [];
  const a = new THREE.Vector3();
  const step = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    a.copy(randDir());
    const tangent = new THREE.Vector3().crossVectors(a, randDir()).normalize();
    const segs = 3 + ((Math.random() * 5) | 0);
    let prev = a.clone().multiplyScalar(r);
    for (let sIdx = 0; sIdx < segs; sIdx++) {
      // manhattan-style turns: rotate tangent 90° around the normal sometimes
      if (Math.random() < 0.5) tangent.applyAxisAngle(a, Math.PI / 2);
      step.copy(tangent).multiplyScalar(0.06 + Math.random() * 0.18);
      const next = prev.clone().add(step).normalize().multiplyScalar(r);
      verts.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
      prev = next;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return { lines: new THREE.LineSegments(geo, mat), geo, mat };
}

export function initOrb(canvas: HTMLCanvasElement, size = 340): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
  renderer.setSize(size, size, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.3, 7.6);
  camera.lookAt(0, 0, 0);

  const color = new THREE.Color(STATE_COLORS.idle);

  // particle sizes were tuned when the orb rendered at 400px — scale them
  // with the canvas so density looks identical at any size
  const sizeScale = size / 400;

  // outer hologram shell — the big patchy data sphere
  const outer = buildCloud(
    { count: 24000, patches: 170, rMin: 1.78, rMax: 2.4, patchSpread: 0.4, baseSize: 2.3 },
    color
  );
  outer.uniforms.uScale.value = sizeScale;
  scene.add(outer.points);

  // inner counter-rotating core cloud
  const inner = buildCloud(
    { count: 8000, patches: 70, rMin: 0.7, rMax: 1.3, patchSpread: 0.28, baseSize: 2.0 },
    color
  );
  inner.uniforms.uScale.value = sizeScale;
  scene.add(inner.points);

  // circuit traces on both shells
  const traceA = buildTraces(220, 1.8, 2.4, color);
  const traceB = buildTraces(90, 0.75, 1.25, color);
  outer.points.add(traceA.lines);
  inner.points.add(traceB.lines);

  // a few thin orbit arcs for structure
  const arcs: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: color.clone(),
      transparent: true,
      opacity: 0.18 + Math.random() * 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(2.05 + i * 0.22, 0.008, 6, 180, Math.PI * (0.5 + Math.random())),
      mat
    );
    arc.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    arcs.push({ mesh: arc, mat });
    scene.add(arc);
  }

  // faint center glow
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext("2d")!;
  const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.7)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.15)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  const glowMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas),
    color: color.clone(),
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(1.5);
  glowMat.opacity = 0.05;
  scene.add(glow);

  // ── frame loop ──
  const clock = new THREE.Clock();
  let raf = 0;
  let smooth = 0;
  const target = new THREE.Color(STATE_COLORS.idle);

  const frame = () => {
    const t = clock.getElapsedTime();
    const s = getVoiceState();

    const synth =
      s === "speaking"
        ? 0.3 + 0.15 * Math.sin(t * 9) + 0.08 * Math.sin(t * 23)
        : s === "listening"
          ? 0.14 + 0.05 * Math.sin(t * 6)
          : s === "thinking"
            ? 0.22 + 0.07 * Math.sin(t * 3.5)
            : 0.06 + 0.035 * Math.sin(t * 1.1);
    const raw = Math.max(getLevel(), synth);
    smooth += (raw - smooth) * 0.12;

    target.set(STATE_COLORS[s]);
    color.lerp(target, 0.05);
    traceA.mat.color.copy(color);
    traceB.mat.color.copy(color);
    glowMat.color.copy(color);
    for (const a of arcs) a.mat.color.copy(color);

    for (const cloud of [outer, inner]) {
      cloud.uniforms.uTime.value = t;
      cloud.uniforms.uLevel.value = smooth;
    }

    const spin = s === "thinking" ? 3.2 : 1.0;
    outer.points.rotation.y = t * 0.1 * spin;
    outer.points.rotation.x = Math.sin(t * 0.13) * 0.12;
    inner.points.rotation.y = -t * 0.22 * spin;
    inner.points.rotation.z = Math.sin(t * 0.17) * 0.2;
    arcs.forEach((a, i) => {
      a.mesh.rotation.y += 0.001 * spin * (i % 2 ? 1.6 : -1);
      a.mesh.rotation.x += 0.0006 * spin;
    });

    glow.scale.setScalar(1.8 + smooth * 1.6);
    glowMat.opacity = 0.07 + smooth * 0.18;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
    outer.geo.dispose();
    outer.mat.dispose();
    inner.geo.dispose();
    inner.mat.dispose();
    traceA.geo.dispose();
    traceA.mat.dispose();
    traceB.geo.dispose();
    traceB.mat.dispose();
    for (const a of arcs) {
      a.mesh.geometry.dispose();
      a.mat.dispose();
    }
    glowMat.dispose();
  };
}
