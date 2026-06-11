"use client";

import * as THREE from "three";
import { getLevel, getVoiceState, VoiceState } from "./voiceState";

// WebGL arc-reactor: plasma core with noise-displaced surface and fresnel rim,
// wireframe containment shell, three gyroscope rings, particle halo.
// Reads voiceState every frame: color and turbulence follow what JARVIS is doing.

const STATE_COLORS: Record<VoiceState, number> = {
  idle: 0x2de2e6,
  listening: 0xff4f5e,
  thinking: 0xffb347,
  speaking: 0x4df0ff,
};

// Ashima/IQ 3D simplex noise (standard public-domain GLSL implementation)
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const CORE_VERT = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uLevel;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
void main() {
  float n = snoise(position * 1.8 + vec3(0.0, uTime * 0.35, uTime * 0.2));
  float n2 = snoise(position * 4.5 - vec3(uTime * 0.5));
  float disp = n * (0.08 + uLevel * 0.30) + n2 * (0.02 + uLevel * 0.10);
  vec3 p = position + normal * disp;
  vNoise = n * 0.5 + n2 * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const CORE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uLevel;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
void main() {
  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
  vec3 hot = mix(uColor, vec3(1.0), 0.75);
  vec3 col = mix(uColor * 0.55, hot, fres);
  col += uColor * vNoise * (0.25 + uLevel * 0.6);
  float alpha = 0.55 + fres * 0.45;
  gl_FragColor = vec4(col, alpha);
}
`;

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.25, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function initOrb(canvas: HTMLCanvasElement, size = 320): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.4, 7.2);
  camera.lookAt(0, 0, 0);

  const color = new THREE.Color(STATE_COLORS.idle);

  // ── plasma core ──
  const coreUniforms = {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uColor: { value: color.clone() },
  };
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 128, 128),
    new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: coreUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(core);

  // ── inner white-hot kernel ──
  const kernel = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(kernel);

  // ── back-glow sprite ──
  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: color.clone(),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(7.5);
  scene.add(glow);

  // ── wireframe containment shell ──
  const shellMat = new THREE.MeshBasicMaterial({
    color: color.clone(),
    wireframe: true,
    transparent: true,
    opacity: 0.10,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.85, 2), shellMat);
  scene.add(shell);

  // ── gyroscope rings ──
  const ringGroup = new THREE.Group();
  const ringMats: THREE.MeshBasicMaterial[] = [];
  const ringSpecs: { r: number; tilt: [number, number, number]; op: number }[] = [
    { r: 2.25, tilt: [Math.PI / 2.6, 0.3, 0], op: 0.55 },
    { r: 2.55, tilt: [Math.PI / 2.1, -0.5, 0.4], op: 0.35 },
    { r: 2.9, tilt: [Math.PI / 3.4, 0.9, -0.2], op: 0.22 },
  ];
  const rings: THREE.Mesh[] = [];
  for (const spec of ringSpecs) {
    const mat = new THREE.MeshBasicMaterial({
      color: color.clone(),
      transparent: true,
      opacity: spec.op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    ringMats.push(mat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(spec.r, 0.012, 8, 200), mat);
    ring.rotation.set(...spec.tilt);
    rings.push(ring);
    ringGroup.add(ring);

    // a brighter arc segment riding each ring, instrument-style
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(spec.r, 0.03, 8, 60, Math.PI * 0.35),
      mat
    );
    arc.rotation.set(...spec.tilt);
    rings.push(arc);
    ringGroup.add(arc);
  }
  scene.add(ringGroup);

  // ── particle halo ──
  const COUNT = 900;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.0 + Math.random() * 1.6;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.9;
    positions[i * 3 + 2] = Math.sin(a) * r;
    seeds[i] = Math.random();
  }
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const ptsMat = new THREE.PointsMaterial({
    color: color.clone(),
    size: 0.035,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    map: glowTexture(),
  });
  const particles = new THREE.Points(ptsGeo, ptsMat);
  scene.add(particles);

  // ── frame loop ──
  const clock = new THREE.Clock();
  let raf = 0;
  let smooth = 0;
  const target = new THREE.Color(STATE_COLORS.idle);

  const frame = () => {
    const t = clock.getElapsedTime();
    const s = getVoiceState();

    // synthetic baseline per state, overridden by real audio level when present
    const synth =
      s === "speaking"
        ? 0.3 + 0.15 * Math.sin(t * 9) + 0.08 * Math.sin(t * 23)
        : s === "listening"
          ? 0.14 + 0.05 * Math.sin(t * 6)
          : s === "thinking"
            ? 0.22 + 0.07 * Math.sin(t * 3.5)
            : 0.07 + 0.04 * Math.sin(t * 1.2);
    const raw = Math.max(getLevel(), synth);
    smooth += (raw - smooth) * 0.12;

    target.set(STATE_COLORS[s]);
    color.lerp(target, 0.06);
    (coreUniforms.uColor.value as THREE.Color).copy(color);
    glowMat.color.copy(color);
    shellMat.color.copy(color);
    ptsMat.color.copy(color);
    for (const m of ringMats) m.color.copy(color);

    coreUniforms.uTime.value = t;
    coreUniforms.uLevel.value = smooth;

    kernel.scale.setScalar(1 + smooth * 0.9);
    (kernel.material as THREE.MeshBasicMaterial).opacity = 0.55 + smooth * 0.45;
    glow.scale.setScalar(6.5 + smooth * 4.5);
    glowMat.opacity = 0.35 + smooth * 0.45;

    const spin = s === "thinking" ? 4.0 : 1.0;
    core.rotation.y = t * 0.15;
    shell.rotation.y = -t * 0.12 * spin;
    shell.rotation.x = Math.sin(t * 0.2) * 0.15;
    ringGroup.rotation.y = t * 0.25 * spin;
    rings.forEach((ring, i) => {
      ring.rotation.z += 0.0012 * spin * (i % 2 === 0 ? 1 : -1.4);
    });
    particles.rotation.y = t * 0.05 * spin;
    const pos = ptsGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i += 7) {
      // animate a subset per frame to stay cheap
      const y = pos.getY(i);
      pos.setY(i, y + Math.sin(t * 1.5 + seeds[i] * 20) * 0.0015);
    }
    pos.needsUpdate = true;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const m = obj.material as THREE.Material;
        m.dispose();
      }
    });
  };
}
