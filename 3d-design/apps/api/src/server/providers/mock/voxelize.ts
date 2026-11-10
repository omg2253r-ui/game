import * as THREE from 'three';
import type { MatSpec, Part } from './parts';

const DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

/**
 * Surface-sample every triangle into a grid, flood-fill the outside, then emit
 * only the cube faces that touch the outside. Thin parts (a sword blade) still
 * show up because sampling marks any cell a triangle passes through.
 */
export function voxelize(parts: Part[], resolution: number): Part[] {
  const bounds = new THREE.Box3();
  for (const p of parts) {
    p.geometry.computeBoundingBox();
    bounds.union(p.geometry.boundingBox!);
  }
  const size = bounds.getSize(new THREE.Vector3());
  const h = Math.max(size.x, size.y, size.z) / resolution;
  const origin = bounds.min.clone().subScalar(h);
  const nx = Math.ceil(size.x / h) + 3;
  const ny = Math.ceil(size.y / h) + 3;
  const nz = Math.ceil(size.z / h) + 3;
  const idx = (x: number, y: number, z: number) => x + nx * (y + ny * z);
  const grid = new Int16Array(nx * ny * nz).fill(-1);

  const mats: MatSpec[] = [];
  const matIndex = new Map<string, number>();
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    p = new THREE.Vector3();

  for (const part of parts) {
    const key = JSON.stringify(part.material);
    if (!matIndex.has(key)) {
      matIndex.set(key, mats.length);
      mats.push(part.material);
    }
    const m = matIndex.get(key)!;
    const pos = part.geometry.getAttribute('position') as THREE.BufferAttribute;
    const index = part.geometry.getIndex();
    const triCount = (index ? index.count : pos.count) / 3;
    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      const edge = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
      const n = Math.min(200, Math.max(1, Math.ceil(edge / (h * 0.5))));
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n - i; j++) {
          p.copy(a)
            .addScaledVector(b.clone().sub(a), i / n)
            .addScaledVector(c.clone().sub(a), j / n);
          const x = Math.floor((p.x - origin.x) / h);
          const y = Math.floor((p.y - origin.y) / h);
          const z = Math.floor((p.z - origin.z) / h);
          grid[idx(x, y, z)] = m; // later parts (gems, lights) win shared cells
        }
      }
    }
  }

  // Flood-fill empty space from the padded corner: that is "outside".
  const outside = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0,
    tail = 0;
  queue[tail++] = 0;
  outside[0] = 1;
  while (head < tail) {
    const cell = queue[head++]!;
    const x = cell % nx,
      y = Math.floor(cell / nx) % ny,
      z = Math.floor(cell / (nx * ny));
    for (const [dx, dy, dz] of DIRS) {
      const X = x + dx,
        Y = y + dy,
        Z = z + dz;
      if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
      const k = idx(X, Y, Z);
      if (outside[k] || grid[k]! >= 0) continue;
      outside[k] = 1;
      queue[tail++] = k;
    }
  }

  const out = mats.map(() => ({ pos: [] as number[], nor: [] as number[], ind: [] as number[] }));
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const m = grid[idx(x, y, z)]!;
        if (m < 0) continue;
        for (const [dx, dy, dz] of DIRS) {
          const X = x + dx,
            Y = y + dy,
            Z = z + dz;
          const open =
            X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz || outside[idx(X, Y, Z)];
          if (!open) continue;
          emitFace(out[m]!, origin, h, x, y, z, dx, dy, dz);
        }
      }
    }
  }

  return out
    .map((o, m) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3));
      g.setIndex(o.ind);
      return { geometry: g, material: mats[m]!, flat: true };
    })
    .filter((p) => p.geometry.getIndex()!.count > 0);
}

function emitFace(
  o: { pos: number[]; nor: number[]; ind: number[] },
  origin: THREE.Vector3,
  h: number,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
) {
  // Face centre and two in-plane axes chosen so winding faces outward.
  const cx = origin.x + (x + 0.5 + dx * 0.5) * h;
  const cy = origin.y + (y + 0.5 + dy * 0.5) * h;
  const cz = origin.z + (z + 0.5 + dz * 0.5) * h;
  const n = new THREE.Vector3(dx, dy, dz);
  const u = Math.abs(dy) === 1 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3().crossVectors(n, u);
  u.multiplyScalar(h / 2);
  v.multiplyScalar(h / 2);
  const base = o.pos.length / 3;
  for (const [su, sv] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    o.pos.push(cx + u.x * su + v.x * sv, cy + u.y * su + v.y * sv, cz + u.z * su + v.z * sv);
    o.nor.push(dx, dy, dz);
  }
  // u × v = n·(h²/4) so (0,1,2) is counter-clockwise seen from outside.
  o.ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
