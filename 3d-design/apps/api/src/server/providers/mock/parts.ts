import * as THREE from 'three';
import type { Interpretation, MaterialKind } from './interpret';
import { fbm, makeNoise3, mulberry32 } from './random';

export interface MatSpec {
  name: string;
  color: number;
  roughness: number;
  metalness: number;
  emissive?: number;
}

export interface Part {
  geometry: THREE.BufferGeometry;
  material: MatSpec;
  /** Faceted normals regardless of style (blades, crystals). */
  flat?: boolean;
}

export interface BuildCtx {
  i: Interpretation;
  rand: () => number;
  noise: ReturnType<typeof makeNoise3>;
  lowPoly: boolean;
  /** Segment count scaled by quality, clamped for low-poly. */
  seg: (base: number, min?: number) => number;
  /** Prompt colour #n, else the fallback. */
  color: (n: number, fallback: number) => number;
  /** Last colour named in the prompt ("…with yellow fruit"), for accents. */
  lastColor: (fallback: number) => number;
  range: (a: number, b: number) => number;
}

export function makeCtx(i: Interpretation, seed: number): BuildCtx {
  const rand = mulberry32(seed);
  const lowPoly = i.style === 'low-poly';
  return {
    i,
    rand,
    noise: makeNoise3(seed),
    lowPoly,
    seg: (base, min = 3) =>
      Math.max(min, Math.round(lowPoly ? Math.min(base * 0.5, 8) : base * i.detail)),
    color: (n, fallback) => i.colors[n] ?? fallback,
    lastColor: (fallback) => (i.colors.length > 1 ? i.colors[i.colors.length - 1]! : fallback),
    range: (a, b) => a + (b - a) * rand(),
  };
}

const MATERIAL_PRESETS: Record<MaterialKind, Omit<MatSpec, 'name' | 'color'>> = {
  metal: { roughness: 0.32, metalness: 1 },
  wood: { roughness: 0.82, metalness: 0 },
  stone: { roughness: 0.95, metalness: 0 },
  glass: { roughness: 0.06, metalness: 0 },
  ceramic: { roughness: 0.38, metalness: 0 },
  default: { roughness: 0.6, metalness: 0 },
};

export function mat(
  name: string,
  color: number,
  kind: MaterialKind,
  extra: Partial<MatSpec> = {},
): MatSpec {
  return { name, color, ...MATERIAL_PRESETS[kind], ...extra };
}

/** Displace every vertex along its normal by `amount * fbm(p * freq)`. */
export function displace(
  g: THREE.BufferGeometry,
  ctx: BuildCtx,
  amount: number,
  freq: number,
  octaves = 3,
) {
  g.computeVertexNormals();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  // Weld-aware: identical positions get identical offsets so seams stay closed.
  const cache = new Map<string, number>();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k),
      y = pos.getY(k),
      z = pos.getZ(k);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let d = cache.get(key);
    if (d === undefined) {
      d = fbm(ctx.noise, x * freq, y * freq, z * freq, octaves) * amount;
      cache.set(key, d);
    }
    pos.setXYZ(k, x + nor.getX(k) * d, y + nor.getY(k) * d, z + nor.getZ(k) * d);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) =>
  g.translate(x, y, z);

/** Apply a per-vertex function to positions. */
export function warp(g: THREE.BufferGeometry, fn: (v: THREE.Vector3) => void) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    fn(v);
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export function sphere(ctx: BuildCtx, r: number, detailBase = 2) {
  const detail = ctx.lowPoly ? 1 : Math.min(5, Math.round(detailBase * ctx.i.detail));
  return new THREE.IcosahedronGeometry(r, detail);
}
