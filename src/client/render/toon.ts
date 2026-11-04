/**
 * Anime cel-shading toolkit: shared toon gradient ramp, cached materials and
 * inverted-hull outlines.
 */
import * as THREE from 'three';

let ramp: THREE.DataTexture | null = null;
export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  ramp.userData.shared = true;
  return ramp;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
export function toon(color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation, emissiveIntensity = 1): THREE.MeshToonMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${emissive !== undefined ? new THREE.Color(emissive).getHexString() : ''}|${emissiveIntensity}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp() });
    if (emissive !== undefined) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = emissiveIntensity;
    }
    m.userData.shared = true;
    toonCache.set(key, m);
  }
  return m;
}

const glowCache = new Map<string, THREE.MeshBasicMaterial>();
/** unlit neon material (bloom-friendly) */
export function glow(color: THREE.ColorRepresentation, opacity = 1, additive = false): THREE.MeshBasicMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${opacity}|${additive}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || additive, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive && opacity >= 1, toneMapped: false });
    m.userData.shared = true;
    glowCache.set(key, m);
  }
  return m;
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0a0a14, side: THREE.BackSide });
outlineMat.userData.shared = true;

/** add an inverted-hull outline as a child (works for parts centred on their origin) */
export function outline<T extends THREE.Mesh>(mesh: T, thickness = 0.035): T {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.name = 'outline';
  // thickness relative to mesh size
  mesh.geometry.computeBoundingSphere();
  const r = mesh.geometry.boundingSphere?.radius ?? 1;
  const s = 1 + thickness / Math.max(0.05, r);
  o.scale.setScalar(s);
  o.castShadow = false;
  o.receiveShadow = false;
  mesh.add(o);
  return mesh;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
export function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return g;
}

export function part(geometry: THREE.BufferGeometry, material: THREE.Material, opts: { outline?: number | false; shadow?: boolean } = {}): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = opts.shadow ?? true;
  m.receiveShadow = false;
  if (opts.outline !== false) outline(m, opts.outline ?? 0.03);
  return m;
}

export const box = (w: number, h: number, d: number) => geo(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const sphere = (r: number, ws = 16, hs = 12) => geo(`sph${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const capsule = (r: number, len: number) => geo(`cap${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));
export const cyl = (rt: number, rb: number, h: number, seg = 12) => geo(`cyl${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const cone = (r: number, h: number, seg = 8) => geo(`cone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const torus = (r: number, t: number, seg = 24) => geo(`tor${r},${t},${seg}`, () => new THREE.TorusGeometry(r, t, 6, seg));
