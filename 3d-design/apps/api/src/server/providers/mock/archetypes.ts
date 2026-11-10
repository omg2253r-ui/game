import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Archetype } from './interpret';
import { at, displace, mat, sphere, warp, type BuildCtx, type Part } from './parts';

const GEM_GLOW = [0x5fb7ff, 0xb070ff, 0x48e0b0];

function box(ctx: BuildCtx, w: number, h: number, d: number, radius = 0) {
  if (radius > 0 && !ctx.lowPoly) return new RoundedBoxGeometry(w, h, d, ctx.seg(2, 1), radius);
  return new THREE.BoxGeometry(w, h, d);
}

function sword(ctx: BuildCtx): Part[] {
  const { i } = ctx;
  const bladeColor = i.material === 'wood' ? 0x9a7048 : ctx.color(1, i.magic ? 0xbcd3ea : 0xc9cdd2);
  const accent = ctx.color(0, i.magic ? 0x3a3f8f : 0x6b4a2b);
  const bladeLen = ctx.range(0.68, 0.82);
  const bladeW = ctx.range(0.042, 0.06) * (i.style === 'stylized' || i.style === 'anime' ? 1.3 : 1);

  // Diamond cross-section blade with a pointed tip.
  const blade = new THREE.CylinderGeometry(1, 1, bladeLen, 4, ctx.seg(10, 4));
  warp(blade, (v) => {
    const t = (v.y + bladeLen / 2) / bladeLen; // 0 at guard, 1 at tip
    const taper = t < 0.82 ? 1 - t * 0.18 : ((1 - t) / 0.18) * 0.85;
    v.x *= bladeW * taper;
    v.z *= 0.011 * Math.max(taper, 0.3);
    if (t >= 0.999) v.x = v.z = 0;
  });
  at(blade, 0, 0.235 + bladeLen / 2, 0);

  // Cross-guard; curves upward for fantasy/magic styles.
  const guardW = ctx.range(0.22, 0.3);
  const guard = new THREE.BoxGeometry(guardW, 0.032, 0.05, ctx.seg(10, 2), 1, 1);
  const curl = i.fantasy || i.magic ? 0.9 : 0.25;
  warp(guard, (v) => {
    v.y += curl * (v.x * v.x);
  });
  at(guard, 0, 0.215, 0);

  const grip = new THREE.CylinderGeometry(0.017, 0.019, 0.2, ctx.seg(10), ctx.seg(12, 2));
  warp(grip, (v) => {
    const ridge = 1 + 0.08 * Math.sin((v.y + 0.1) * 95);
    v.x *= ridge;
    v.z *= ridge;
  });
  at(grip, 0, 0.1, 0);

  const pommel = ctx.lowPoly ? new THREE.OctahedronGeometry(0.032) : sphere(ctx, 0.03, 2);
  at(pommel, 0, -0.012, 0);

  const metal = i.material === 'wood' ? 'wood' : 'metal';
  const parts: Part[] = [
    { geometry: blade, material: mat('blade', bladeColor, metal, { roughness: 0.22 }), flat: true },
    {
      geometry: guard,
      material: mat('guard', i.colors.includes(0xd4a93a) ? 0xd4a93a : 0x9d8a5a, 'metal'),
    },
    { geometry: grip, material: mat('grip', accent, 'default', { roughness: 0.85 }) },
    { geometry: pommel, material: mat('pommel', 0x9d8a5a, 'metal') },
  ];
  if (i.magic || i.fantasy) {
    const glow = GEM_GLOW[Math.floor(ctx.rand() * GEM_GLOW.length)]!;
    const gem = new THREE.OctahedronGeometry(0.022, 0);
    gem.scale(1, 1.3, 0.6);
    for (const z of [0.026, -0.026]) {
      parts.push({
        geometry: at(gem.clone(), 0, 0.215, z),
        material: mat('gem', glow, 'glass', { emissive: glow }),
        flat: true,
      });
    }
  }
  return parts;
}

function tree(ctx: BuildCtx): Part[] {
  const { i } = ctx;
  const height = ctx.range(1.4, 1.9);
  const trunk = new THREE.CylinderGeometry(0.09, 0.17, height, ctx.seg(10), ctx.seg(8, 2));
  const lean = ctx.range(-0.25, 0.25);
  warp(trunk, (v) => {
    const t = (v.y + height / 2) / height;
    const flare = 1 + Math.max(0, 0.25 - t) * 2.4;
    v.x = v.x * flare + lean * t * t + ctx.noise(t * 3, 0.5, 0.1) * 0.06;
    v.z = v.z * flare + ctx.noise(0.2, t * 3, 0.7) * 0.06;
  });
  at(trunk, 0, height / 2, 0);
  const bark = i.fantasy ? 0x5a4a6a : 0x6a4a30;
  const parts: Part[] = [
    { geometry: trunk, material: mat('bark', bark, 'wood', { roughness: 0.95 }) },
  ];

  const leafColor = ctx.color(0, i.fantasy ? 0x55b7a6 : i.magic ? 0x6f8de0 : 0x4f8f3a);
  const leaves = mat('foliage', leafColor, 'default', { roughness: 0.8 });
  const topX = lean;
  if (i.pine) {
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
      const r = 1.0 - k * 0.2;
      const cone = new THREE.ConeGeometry(r, 0.9, ctx.seg(12), 2);
      at(cone, topX, height * 0.55 + k * 0.5, 0);
      parts.push({ geometry: cone, material: leaves });
    }
  } else {
    const clusters = 4 + Math.floor(ctx.rand() * 4);
    for (let k = 0; k < clusters; k++) {
      const a = (k / clusters) * Math.PI * 2 + ctx.rand();
      const r = k === 0 ? 0.85 : ctx.range(0.45, 0.7);
      const dist = k === 0 ? 0 : ctx.range(0.45, 0.75);
      const g = sphere(ctx, r, 2);
      displace(g, ctx, r * 0.22, 2.2 / r);
      g.scale(1, 0.8, 1);
      at(
        g,
        topX + Math.cos(a) * dist,
        height + (k === 0 ? 0.35 : ctx.range(-0.1, 0.4)),
        Math.sin(a) * dist,
      );
      parts.push({ geometry: g, material: leaves });
    }
  }
  if (i.magic || i.fantasy) {
    const glow = ctx.lastColor(0xffd36e);
    for (let k = 0; k < 7; k++) {
      const a = ctx.rand() * Math.PI * 2;
      const g = sphere(ctx, 0.05, 1);
      at(
        g,
        topX + Math.cos(a) * ctx.range(0.6, 1.1),
        height + ctx.range(-0.3, 0.6),
        Math.sin(a) * ctx.range(0.6, 1.1),
      );
      parts.push({ geometry: g, material: mat('glow fruit', glow, 'default', { emissive: glow }) });
    }
  }
  return parts;
}

function car(ctx: BuildCtx): Part[] {
  const { i } = ctx;
  const paint = ctx.color(0, i.cyber ? 0x2a2d3a : 0xb8352b);
  const L = ctx.range(3.9, 4.4),
    W = 1.8;
  const body = box(ctx, L, 0.55, W, 0.12);
  at(body, 0, 0.6, 0);
  const cabin = box(ctx, L * 0.5, 0.5, W * 0.88, 0.1);
  warp(cabin, (v) => {
    if (v.y > 0) v.x *= 0.78;
  });
  at(cabin, -L * 0.06, 1.12, 0);

  const paintMat = mat('paint', paint, 'metal', {
    roughness: 0.28,
    metalness: i.cyber ? 0.6 : 0.4,
  });
  const parts: Part[] = [
    { geometry: body, material: paintMat },
    { geometry: cabin, material: mat('glass', 0x1b2430, 'glass', { metalness: 0.2 }) },
  ];
  const wheelSeg = ctx.seg(18);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const tire = new THREE.CylinderGeometry(0.36, 0.36, 0.28, wheelSeg, 1);
      tire.rotateX(Math.PI / 2);
      at(tire, sx * L * 0.32, 0.36, sz * (W / 2 - 0.08));
      const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.3, wheelSeg, 1);
      hub.rotateX(Math.PI / 2);
      at(hub, sx * L * 0.32, 0.36, sz * (W / 2 - 0.08));
      parts.push({
        geometry: tire,
        material: mat('tire', 0x18181a, 'default', { roughness: 0.92 }),
      });
      parts.push({ geometry: hub, material: mat('hub', 0xc4c8cd, 'metal') });
    }
  }
  const headlight = i.cyber ? ctx.color(1, 0x39e6ff) : 0xfff3c4;
  for (const sz of [1, -1]) {
    const lamp = new THREE.BoxGeometry(0.05, 0.1, 0.36);
    at(lamp, L / 2, 0.68, sz * 0.6);
    parts.push({
      geometry: lamp,
      material: mat('headlight', headlight, 'glass', { emissive: headlight }),
    });
    const tail = new THREE.BoxGeometry(0.05, 0.08, 0.4);
    at(tail, -L / 2, 0.7, sz * 0.58);
    parts.push({
      geometry: tail,
      material: mat('taillight', 0xff2b4a, 'glass', { emissive: 0xff2b4a }),
    });
  }
  if (i.cyber) {
    const neon = ctx.color(2, 0xff3fd2);
    for (const sz of [1, -1]) {
      const strip = new THREE.BoxGeometry(L * 0.86, 0.035, 0.02);
      at(strip, 0, 0.42, sz * (W / 2 + 0.005));
      parts.push({
        geometry: strip,
        material: mat('neon strip', neon, 'default', { emissive: neon }),
      });
    }
    const wing = new THREE.BoxGeometry(0.35, 0.05, W * 0.95);
    at(wing, -L / 2 + 0.2, 1.15, 0);
    const post = new THREE.BoxGeometry(0.08, 0.3, 0.08);
    parts.push({ geometry: wing, material: paintMat });
    parts.push({ geometry: at(post.clone(), -L / 2 + 0.2, 0.98, 0.5), material: paintMat });
    parts.push({ geometry: at(post, -L / 2 + 0.2, 0.98, -0.5), material: paintMat });
  }
  return parts;
}

function house(ctx: BuildCtx): Part[] {
  const { i } = ctx;
  const W = ctx.range(3.4, 4.4),
    D = ctx.range(3.2, 4),
    H = ctx.range(2.3, 2.9);
  const wallKind = i.material === 'stone' ? 'stone' : 'wood';
  const walls = box(ctx, W, H, D);
  at(walls, 0, H / 2, 0);
  const roofH = ctx.range(1.3, 1.9);
  // Triangular prism along z, apex up: after rotateX(-90°) the apex is at y=1, eaves at y=-0.5.
  const roof = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  roof.rotateX(-Math.PI / 2);
  warp(roof, (v) => {
    v.x *= (W / 2 + 0.3) / 0.866;
    v.y = ((v.y + 0.5) / 1.5) * roofH;
    v.z *= D + 0.4;
  });
  at(roof, 0, H, 0);
  const door = new THREE.BoxGeometry(0.9, 1.7, 0.08);
  at(door, W * 0.15, 0.85, D / 2 + 0.02);
  const parts: Part[] = [
    {
      geometry: walls,
      material: mat('walls', ctx.color(1, wallKind === 'stone' ? 0x9a958c : 0xd8c9a8), wallKind),
    },
    {
      geometry: roof,
      material: mat('roof', ctx.color(0, 0x8c3b2e), 'ceramic', { roughness: 0.7 }),
      flat: true,
    },
    { geometry: door, material: mat('door', 0x5a3a22, 'wood') },
  ];
  const glow = i.magic || i.fantasy ? 0xffc46b : undefined;
  for (const [x, z, ry] of [
    [-W * 0.22, D / 2 + 0.03, 0],
    [W / 2 + 0.03, 0, Math.PI / 2],
    [-W / 2 - 0.03, 0, Math.PI / 2],
  ] as const) {
    const win = new THREE.BoxGeometry(0.8, 0.7, 0.06);
    win.rotateY(ry);
    at(win, x, H * 0.58, z);
    parts.push({
      geometry: win,
      material: mat('window', glow ?? 0x23303c, 'glass', glow ? { emissive: glow } : {}),
    });
  }
  const chimney = new THREE.BoxGeometry(0.4, 1.2, 0.4);
  at(chimney, -W * 0.25, H + roofH * 0.55, -D * 0.2);
  parts.push({ geometry: chimney, material: mat('chimney', 0x7a6e66, 'stone') });
  return parts;
}

function vase(ctx: BuildCtx): Part[] {
  const { i } = ctx;
  const h = ctx.range(0.3, 0.42);
  const belly = ctx.range(0.11, 0.15),
    neck = ctx.range(0.035, 0.06),
    lip = neck * ctx.range(1.2, 1.6);
  const steps = ctx.seg(24, 6);
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const r =
      t < 0.6
        ? 0.06 + (belly - 0.06) * Math.sin((t / 0.6) * Math.PI * 0.5 + 0.2)
        : t < 0.88
          ? neck + (belly - neck) * (1 - (t - 0.6) / 0.28) ** 2
          : neck + (lip - neck) * ((t - 0.88) / 0.12);
    pts.push(new THREE.Vector2(r, t * h));
  }
  pts.push(new THREE.Vector2(lip * 0.85, h));
  const g = new THREE.LatheGeometry(pts, ctx.seg(28, 6));
  const parts: Part[] = [
    {
      geometry: g,
      material: mat(
        'glaze',
        ctx.color(0, i.fantasy ? 0x3f7f8c : 0x2f5fa0),
        i.material === 'default' ? 'ceramic' : i.material,
      ),
    },
  ];
  const band = new THREE.TorusGeometry(belly * 0.97, 0.004, 6, ctx.seg(40, 8));
  band.rotateX(Math.PI / 2);
  at(band, 0, h * 0.42, 0);
  parts.push({ geometry: band, material: mat('band', ctx.color(1, 0xd4a93a), 'metal') });
  return parts;
}

function crystal(ctx: BuildCtx): Part[] {
  const { i } = ctx;
  const color = ctx.color(0, i.cyber ? 0x39e6ff : 0x9a7cf0);
  const base = sphere(ctx, 0.22, 2);
  base.scale(1.3, 0.45, 1.1);
  displace(base, ctx, 0.04, 9);
  at(base, 0, 0.06, 0);
  const parts: Part[] = [{ geometry: base, material: mat('rock base', 0x5d5a57, 'stone') }];
  const count = 5 + Math.floor(ctx.rand() * 5);
  for (let k = 0; k < count; k++) {
    const h = k === 0 ? 0.55 : ctx.range(0.18, 0.42);
    const r = h * ctx.range(0.14, 0.2);
    const g = new THREE.CylinderGeometry(r, r * 1.05, h, 6, 1);
    const tip = new THREE.ConeGeometry(r, h * 0.35, 6, 1);
    at(tip, 0, h / 2 + h * 0.175, 0);
    g.translate(0, h / 2, 0);
    tip.translate(0, h / 2, 0);
    const tilt = k === 0 ? 0 : ctx.range(0.25, 0.75);
    const yaw = (k / count) * Math.PI * 2;
    for (const piece of [g, tip]) {
      piece.rotateZ(tilt);
      piece.rotateY(yaw);
      piece.translate(Math.cos(yaw) * 0.05, 0.08, -Math.sin(yaw) * 0.05);
      parts.push({
        geometry: piece,
        material: mat(
          'crystal',
          color,
          'glass',
          i.magic || i.cyber || i.fantasy ? { emissive: color } : {},
        ),
        flat: true,
      });
    }
  }
  return parts;
}

function chest(ctx: BuildCtx): Part[] {
  const { i } = ctx;
  const W = 0.9,
    D = 0.56,
    H = 0.46;
  const wood = mat('wood', ctx.color(0, 0x7a5232), i.material === 'metal' ? 'metal' : 'wood');
  const trim = mat('trim', ctx.color(1, 0xd4a93a), 'metal');
  const base = box(ctx, W, H, D, 0.02);
  at(base, 0, H / 2, 0);
  const lid = new THREE.CylinderGeometry(D / 2, D / 2, W, ctx.seg(16, 4), 1, false, 0, Math.PI);
  lid.rotateZ(Math.PI / 2); // axis along x, the half-round faces up
  at(lid, 0, H, 0);
  const parts: Part[] = [
    { geometry: base, material: wood },
    { geometry: lid, material: wood },
  ];
  for (const x of [-W * 0.36, W * 0.36]) {
    const band = new THREE.BoxGeometry(0.06, H + 0.01, D + 0.02);
    at(band, x, H / 2, 0);
    const arc = new THREE.CylinderGeometry(
      D / 2 + 0.012,
      D / 2 + 0.012,
      0.062,
      ctx.seg(16, 4),
      1,
      false,
      0,
      Math.PI,
    );
    arc.rotateZ(Math.PI / 2);
    at(arc, x, H, 0);
    parts.push({ geometry: band, material: trim }, { geometry: arc, material: trim });
  }
  const lock = new THREE.BoxGeometry(0.1, 0.12, 0.04);
  at(lock, 0, H - 0.02, D / 2 + 0.02);
  parts.push({ geometry: lock, material: trim });
  if (i.magic) {
    const glow = sphere(ctx, 0.035, 1);
    at(glow, 0, H + D / 2 + 0.06, 0);
    parts.push({
      geometry: glow,
      material: mat('glow', 0x8fd0ff, 'glass', { emissive: 0x8fd0ff }),
    });
  }
  return parts;
}

/** Fallback for prompts outside the mock's vocabulary: a seeded clay sculpt. */
function rock(ctx: BuildCtx): Part[] {
  const { i } = ctx;
  const g = sphere(ctx, 0.3, 3);
  g.scale(ctx.range(1, 1.4), ctx.range(0.7, 1.1), ctx.range(0.9, 1.2));
  displace(g, ctx, 0.08, 3.2, 4);
  warp(g, (v) => {
    if (v.y < -0.12) v.y = -0.12 + (v.y + 0.12) * 0.2; // flatten the base so it sits
  });
  g.translate(0, 0.12, 0);
  const kind = i.material === 'default' ? 'ceramic' : i.material;
  return [
    { geometry: g, material: mat('clay', ctx.color(0, 0xb4a79a), kind, { roughness: 0.85 }) },
  ];
}

export const BUILDERS: Record<Archetype, (ctx: BuildCtx) => Part[]> = {
  sword,
  tree,
  car,
  house,
  vase,
  crystal,
  chest,
  rock,
};
