// Our cast for the Na Yai Am short as lit flat sprites in the 3D world (machinery from the bridge template: canvas
// pool, lit cards, contact blobs, blinks). The crowd functions at the bottom say who stands where in each shot.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, fxPuff, fxDoc, fxStamp, fxLoad, fxWind, fxBang, fxSweat,
  Outfit, Expr, FrontOpts, SideOpts, Prop, student, villager, TEACHER,
} from "./toon";
import { FPS, SHOTS, V3, smooth, clamp01, WAT, PLOT, OFFICE, DESK, KIDROAD, CAMPUS, GATE, T_APPROVE, T_DISTRICT, T_WAIT, wordAt, LINES } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const L = LEAD;
const add = (a: V3, x: number, y: number, z: number): V3 => [a[0] + x, a[1] + y, a[2] + z];
const STU = [0, 1, 2, 3, 4, 5].map((v) => student(v));
const VIL = Array.from({ length: 12 }, (_, v) => villager(v));
const KIDS = [0, 1, 2, 3].map((v) => student(v));
const stu = (i: number): Who => ({ i, o: STU[i % 6], okey: `st${i % 6}` });
const vil = (i: number): Who => ({ i: i + 300, o: VIL[i % 12], okey: `v${i % 12}` });
const front = { side: false, mirror: false };

/** one figure, front-on, standing (or strolling with phase), with its contact shadow */
const stand = (out: Stage, cam: CamInfo, t: number, who: Who, p: V3, fo: FrontOpts, scale = 1) => {
  out.places.push(person(cam, who, p[0], p[1], p[2], front, { blink: lidAt(t, who.i), ...fo }, {}, scale));
  blob(out, p[0], p[1], p[2], scale);
};
/** walker from a to b over [t0, t1] at a stroll, then standing; side view when the lens sees the walk from the side */
const walker = (out: Stage, cam: CamInfo, t: number, who: Who, a: V3, b: V3, t0: number, t1: number, fo: FrontOpts, scale = 1) => {
  const u = clamp01((t - t0) / (t1 - t0)), moving = u > 0 && u < 1;
  const x = a[0] + (b[0] - a[0]) * u, z = a[2] + (b[2] - a[2]) * u, len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
  const dx = (b[0] - a[0]) / len, dz = (b[2] - a[2]) / len;
  const dist = len * u, phase = q(((dist / 1.4) + hh(who.i, 5)) % 1, 120);
  const view = moving ? viewOf(cam, x, z, dx, dz) : { side: false, mirror: false, fs: 1 };
  const f2: FrontOpts = { blink: lidAt(t, who.i), ...fo, mode: moving ? "stroll" : "stand", phase: moving ? phase : 0 };
  const s2: SideOpts = { mode: moving ? "march" : "stand", phase, expr: fo.expr, stomp: 0.55, stride: 0.875 * view.fs, blink: lidAt(t, who.i) };
  out.places.push(person(cam, who, x, 0, z, view, f2, s2, scale));
  blob(out, x, 0, z, scale);
  return [x, z] as [number, number];
};
const burst = (out: Stage, t: number, t0: number, at: V3, size = 1.2, len = 0.4) => {
  if (t < t0 || t >= t0 + len) return;
  const u = q((t - t0) / len, 30);
  out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: at[0], y: at[1], z: at[2], w: size, h: size });
};

// shots 1 and 12: two students by the school's name sign at the gate
const gatePair = (out: Stage, cam: CamInfo, t: number, id: number) => {
  const spots: V3[] = [add(GATE, -0.75, 0, -1.6), add(GATE, 0.35, 0, -2.0)];
  spots.forEach((p, k) => {
    let expr: Expr = k ? "grin" : "smile";
    let look = 0;
    if (id === 12) {
      if (t < T_DISTRICT - L) { expr = k ? "whistle" : "neutral"; look = 1; }
      else if (t < T_DISTRICT + 0.9) { expr = "shock"; look = 1; }
      else if (t < T_WAIT - L) { expr = k ? "smile" : "smile_closed"; look = 1; }
      else { expr = k ? "grin" : "smile_closed"; look = 0; }
    }
    stand(out, cam, t, stu(k), p, { mode: "stand", expr, look, prop: k ? "book" : null, facing: k ? -1 : 1 });
  });
  // a few more students further in, walking to class
  for (let i = 0; i < 6; i++) {
    const z0 = GATE[2] + 5 + i * 2.2, x0 = GATE[0] + 3 + ((i * 3.7) % 6);
    walker(out, cam, t, stu(i + 2), [x0, 0, z0], [x0 + 2, 0, z0 + 14], 0, 70, { expr: "smile" });
  }
};

// shot 2: a few villagers on the village road (seen small from the air)
const roadFolk = (out: Stage, cam: CamInfo, t: number) => {
  for (let i = 0; i < 8; i++) {
    const x0 = -60 + i * 14, dir = i % 2 ? 1 : -1, z = dir * 2.2;
    walker(out, cam, t, vil(i), [x0, 0, z], [x0 + dir * 20, 0, z], 4, 30, { expr: "smile" });
  }
};

// shot 3: the kid at the roadside; the long road runs to a school far away
const roadKid = (out: Stage, cam: CamInfo, t: number) => {
  const cu = t >= wordAt("problem", "ต้องเดินทาง") - L - 4 / FPS;
  const expr: Expr = cu ? (t > wordAt("problem", "ไกลมาก") - L ? "nervous" : "neutral") : "neutral";
  const view = cu ? front : viewOf(cam, KIDROAD[0], KIDROAD[2], 1, 0);
  const who: Who = { i: 21, o: KIDS[0], okey: "kid0" };
  out.places.push(person(cam, who, KIDROAD[0], 0, KIDROAD[2], view, { mode: "stand", expr, blink: lidAt(t, 21), prop: "book", look: cu ? 1 : 0 },
    { mode: "stand", expr, blink: lidAt(t, 21) }));
  blob(out, KIDROAD[0], 0, KIDROAD[2]);
  if (cu && t > wordAt("problem", "ไกลมาก") - L) {
    const u = clamp01((t - wordAt("problem", "ไกลมาก")) / 0.25);
    out.fx.push({ key: "sweat", cw: 120, ch: 160, draw: fxSweat, x: KIDROAD[0] + 0.05, y: 1.62 + 0.04 * u, z: KIDROAD[2] + 0.22, w: 0.11 * u, h: 0.15 * u });
  }
};

// shot 4: villagers from Na Yai Am, Chang Kham and nearby walk in and gather in front of the temple
const gather = (out: Stage, cam: CamInfo, t: number) => {
  const t0 = SHOTS[3].a / FPS;
  for (let i = 0; i < 18; i++) {
    const row = Math.floor(i / 6), k = i % 6;
    const end = add(WAT, -4.2 + k * 1.55 + (row % 2) * 0.6, 0, 11.5 + row * 1.3);
    const from = add(end, (k < 3 ? -1 : 1) * (6 + hh(i) * 5), 0, 7 + hh(i, 2) * 4);
    const arrive = t0 + 0.6 + hh(i, 3) * 1.6 + row * 0.5;
    const talk = t > wordAt("gather", "จึงรวมตัวกัน") - L;
    walker(out, cam, t, vil(i), from, end, arrive - 2.6, arrive, { expr: talk ? (i % 3 ? "grin" : "smile_closed") : i % 2 ? "smile" : "neutral", wave: talk && i % 4 === 1 ? q(Math.sin(t * 8 + i), 20) : undefined });
  }
};

// shot 5: the petition at the Tha Mai district education office; the leader hands it over on "ยื่นขอ"
const petition = (out: Stage, cam: CamInfo, t: number) => {
  const give = wordAt("petition", "ยื่นขอ") + 0.35;
  for (let i = 0; i < 7; i++) {
    const p = add(OFFICE, -2.6 + i * 0.95 + (i % 2) * 0.1, 0, 8.2 + (i % 2) * 0.9);
    const lead = i === 3;
    stand(out, cam, t, vil(i + 3), lead ? add(OFFICE, 0.55, 0, 6.6) : p, { mode: "stand", expr: lead ? (t > give ? "grin" : "smile") : i % 2 ? "smile" : "neutral", prop: lead && t < give ? "paper" : null, facing: lead ? -1 : 0 });
  }
  // the clerk at the door receives it
  stand(out, cam, t, { i: 90, o: { ...TEACHER, jacket: "#d9c7a0" }, okey: "clerk" }, add(OFFICE, -0.55, 0.45, 5.3),
    { mode: "stand", expr: t > give ? "smile" : "neutral", prop: t > give ? "paper" : null, facing: 1 });
};

// shot 6: the desk insert: the request flat on the desk, the stamp comes down on "อนุญาต"
const desk = (out: Stage, t: number) => {
  const k = t - T_APPROVE, top = DESK[1] + 0.8;
  const stamped = k >= 0 ? 1 : 0;
  out.fx.push({ key: `doc${stamped}`, cw: 400, ch: 520, draw: (p) => fxDoc(p, stamped), x: DESK[0], y: top + 0.004, z: DESK[2], w: 0.4, h: 0.52, flat: true });
  // stamp height: hovers, drops in 4 frames onto the paper, holds 6, lifts away
  const yS = k < -4 / FPS ? 0.16 + 0.02 * Math.sin(t * 5) : k < 0 ? 0.16 * (1 - smooth((k + 4 / FPS) / (4 / FPS))) : k < 6 / FPS ? 0 : 0.42 * smooth((k - 6 / FPS) / 0.4);
  out.fx.push({ key: "stamp", cw: 240, ch: 320, draw: fxStamp, x: DESK[0] + 0.06, y: top + 0.115 + yS, z: DESK[2] + 0.03, w: 0.17, h: 0.226 });
  burst(out, t, T_APPROVE, [DESK[0] + 0.06, top + 0.05, DESK[2] + 0.04], 0.55, 0.35);
};

// shots 7-8: kids on the empty plot beside the temple: a cheer, then nowhere to learn
const plotKids = (out: Stage, cam: CamInfo, t: number, id: number) => {
  for (let i = 0; i < 6; i++) {
    const p = add(PLOT, -2.6 + i * 1.05, 0, 4.6 + (i % 2) * 0.8);
    const cheer = id === 7;
    const hop = cheer ? Math.max(0, Math.sin(t * 9 + i * 1.3)) * 0.16 : 0;
    const expr: Expr = cheer ? (["laugh", "grin", "relief_open", "laugh", "grin", "relief"] as Expr[])[i] : (["nervous", "neutral", "nervous", "stern", "nervous", "neutral"] as Expr[])[i];
    out.places.push(person(cam, stu(i + 10), p[0], hop, p[2], front, { mode: "stand", expr, blink: lidAt(t, i + 10), look: cheer ? 0 : (i % 2 ? -1 : 1),
      wave: cheer && i % 2 === 0 ? q(Math.sin(t * 10 + i), 20) : undefined }, {}, 0.95));
    blob(out, p[0], 0, p[2], 0.95, hop > 0 ? 0.6 : 1);
    if (!cheer && i % 2 === 0 && t > wordAt("unlucky", "ช่วงแรก") - L) {
      const u = clamp01((t - wordAt("unlucky", "ช่วงแรก") - i * 0.08) / 0.2);
      out.fx.push({ key: "bang", cw: 160, ch: 240, draw: fxBang, x: p[0] + 0.15, y: 1.78, z: p[2], w: 0.16 * u, h: 0.24 * u });
    }
  }
  if (id === 8) { // a gust of wind and dust across the bare ground
    for (let k = 0; k < 3; k++) {
      const u = q(((t * 0.6 + k * 0.33) % 1), 30);
      out.fx.push({ key: `wind${u}`, cw: 400, ch: 160, draw: (p) => fxWind(p, u), x: PLOT[0] - 3 + k * 3, y: 0.8 + k * 0.5, z: PLOT[2] + 2 + k, w: 2.2, h: 0.88, soft: true });
      const v = q(((t * 0.8 + k * 0.4) % 1), 30);
      out.fx.push({ key: `puff${v}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, v), x: PLOT[0] - 4 + k * 4 + v * 2, y: 0.25, z: PLOT[2] + 1 + k * 1.5, w: 1.4, h: 1.4, soft: true });
    }
  }
};

// shot 9: building day. Hammers on the frame; then a line of villagers each carrying something different
export const HAMMER_AT = (t: number, i: number) => { const ph = (t * 1.6 + i * 0.37) % 1; return ph < 0.6 ? 0 : ph < 0.75 ? smooth((ph - 0.6) / 0.15) : 1 - smooth((ph - 0.75) / 0.25); };
const build = (out: Stage, cam: CamInfo, t: number) => {
  [[-4.2, 3.9], [3.6, 3.9], [0.4, 4.3]].forEach(([dx, dz], i) => {
    const k = HAMMER_AT(t, i);
    const p = add(PLOT, dx, 0, dz);
    stand(out, cam, t, vil(i), p, { mode: "stand", expr: i === 2 ? "grin" : "stern", prop: ["hammer", q(k, 20)], facing: dx < 0 ? 1 : -1 });
    if (k > 0.97) burst(out, t, t, add(p, dx < 0 ? 0.55 : -0.55, 1.1, -0.1), 0.35, 0.1);
  });
  // carriers: walk from screen right to left in front of the site, loads over their heads
  for (let i = 0; i < 7; i++) {
    const x = PLOT[0] + 9 - ((t - 38.4) * 0.9 + i * 1.9) % 16, z = PLOT[2] + 7.4 + (i % 2) * 0.55;
    const who = vil(i + 4), ph = q(((t * 0.9 / 1.4) + hh(i, 5)) % 1, 120);
    const view = viewOf(cam, x, z, -1, 0);
    const expr: Expr = (["grin", "smile_closed", "laugh", "smile", "grin", "relief", "smile"] as Expr[])[i];
    out.places.push(person(cam, who, x, 0, z, view.side ? { side: false, mirror: false } : view, { mode: "stroll", phase: ph, expr, prop: "carry", blink: lidAt(t, who.i) }, {}));
    blob(out, x, 0, z);
    const kind = i % 6, bob = 0.03 * Math.cos(4 * Math.PI * ph);
    out.fx.push({ key: `load${kind}`, cw: 600, ch: 170, draw: (p) => fxLoad(p, kind), x, y: 2.27 + bob, z: z + 0.02, w: kind === 3 || kind === 4 ? 1.1 : 1.6, h: (kind === 3 || kind === 4 ? 1.1 : 1.6) * 170 / 600 });
  }
};

// shot 10: opening day: kids file in with their books, the first headteacher greets them, then teaches at the board
const opening = (out: Stage, cam: CamInfo, t: number) => {
  const t0 = SHOTS[9].a / FPS;
  for (let i = 0; i < 8; i++) {
    const row = i % 2, k = i >> 1;
    const end = add(PLOT, -2.4 + k * 1.6 + row * 0.5, 0, 4.4 + row * 1.0);
    walker(out, cam, t, stu(i + 20), add(end, 4 + k * 0.8, 0, 6), end, t0 + k * 0.35 - 0.4, t0 + 2.6 + k * 0.35, { expr: i % 3 ? "smile" : "grin", prop: "book" }, 0.95);
  }
  const teach = t > wordAt("open", "มีนายเดชา") - L;
  stand(out, cam, t, { i: 95, o: TEACHER, okey: "teacher" }, add(PLOT, 0.6, 0.62, 3.0),
    { mode: "stand", expr: teach ? "smile_closed" : "smile", prop: teach ? "chalk" : null, wave: teach ? undefined : q(Math.sin(t * 7), 20), facing: -1 });
};

// shot 11: today's students crossing the campus (small, from the air)
const campus = (out: Stage, cam: CamInfo, t: number) => {
  for (let i = 0; i < 14; i++) {
    const x0 = CAMPUS[0] - 14 + (i * 5.3) % 26, z0 = CAMPUS[2] - 18 + (i * 3.1) % 10;
    walker(out, cam, t, stu(i), [x0, 0, z0], [x0 + (i % 2 ? 6 : -6), 0, z0 + 8], 53, 58, { expr: "smile" });
  }
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.crowd) {
    case "gate": gatePair(out, cam, t, id); break;
    case "wait": gatePair(out, cam, t, id); break;
    case "aerial": roadFolk(out, cam, t); break;
    case "roadkid": roadKid(out, cam, t); break;
    case "gather": gather(out, cam, t); break;
    case "petition": petition(out, cam, t); break;
    case "desk": desk(out, t); break;
    case "plot": plotKids(out, cam, t, id); break;
    case "build": build(out, cam, t); break;
    case "open": opening(out, cam, t); break;
    case "campus": campus(out, cam, t); break;
  }
  if (id === 12) burst(out, t, T_DISTRICT, [17, 4.2, 14.6], 3.2, 0.45);
  return out;
};
export { FPS, LINES };
