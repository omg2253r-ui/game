// The whole place as one three.js scene: Sukhumvit Road through 1983 Na Yai Am (village houses on stilts, orchards,
// Wat Pho Nak, the villagers' wooden school that is built during shot 9, the Tha Mai education office), a desk
// insert set, and today's campus with its gate sign, flag and the district sign. update(id, f, camera) poses
// everything for shot `id` at frame f (a pure function of id + f). Lighting, ink and post come from the template.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, Ray, prop, setSight, quad, tri } from "./build";
import { ctex, rep, grassHD, stoneHD, beamHD, roofHD, cloudHD, rng } from "./paint";
import { Pen, thai } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, ShotDef, V3, camAt, camKeys, smooth, clamp01, buildK, WAT, PLOT, OFFICE, DESK, KIDROAD, CAMPUS, GATE, DSIGN, T_DISTRICT,
} from "./story";

/** no external models: every prop is built here; the promise also waits for the Thai sign font */
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) kitP = Promise.all([document.fonts.load("600 40px Kanit"), document.fonts.load("700 40px Kanit"), document.fonts.load("500 40px Kanit")])
    .catch(() => null).then(() => ({} as Kit));
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});

// ---------------- painted textures for this place ----------------
const asphaltTex = () => ctex("asphalt", 1024, 256, (g, r) => {
  g.fillStyle = "#7d7a78"; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"; g.fillRect(r() * 1024, r() * 256, 2 + r() * 5, 2 + r() * 4); }
  g.fillStyle = "#e9e3cf"; g.fillRect(0, 12, 1024, 7); g.fillRect(0, 237, 1024, 7);          // edge lines
  for (let x = 0; x < 1024; x += 128) { g.fillStyle = "#e8c45a"; g.fillRect(x + 20, 122, 70, 10); } // centre dashes
});
const dirtTex = () => ctex("dirt", 512, 512, (g, r) => {
  g.fillStyle = "#cfa878"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,240,210,0.12)" : "rgba(110,70,40,0.1)"; g.beginPath(); g.arc(r() * 512, r() * 512, 2 + r() * 8, 0, 7); g.fill(); }
});
const woodWallTex = (key: string, col: string) => ctex("woodwall" + key, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = `rgba(${r() < 0.5 ? "255,230,200,0.08" : "60,30,10,0.1"})`; g.fillRect(x, 0, 32, 512);
    g.fillStyle = "rgba(40,22,10,0.55)"; g.fillRect(x, 0, 3, 512);
  }
});
const plasterTex = (key: string, col: string) => ctex("plaster" + key, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(120,100,80,0.05)"; g.beginPath(); g.arc(r() * 512, r() * 512, 20 + r() * 60, 0, 7); g.fill(); }
});
/** today's school block: cream walls, corridor railings, rows of blue-framed windows, an orange band per floor */
const schoolFacade = (key: string, wm: number, floors: number) => ctex("schoolFac" + key, 1536, Math.round(1536 * (floors * 3.4) / wm), (g) => {
  const W = 1536, H = Math.round(1536 * (floors * 3.4) / wm), m = W / wm, fh = 3.4 * m;
  g.fillStyle = "#efe2c4"; g.fillRect(0, 0, W, H);
  for (let fl = 0; fl < floors; fl++) {
    const y0 = H - (fl + 1) * fh;
    g.fillStyle = "#d9774a"; g.fillRect(0, y0 + fh - 0.35 * m, W, 0.35 * m);            // floor slab band
    for (let x = 0.8 * m; x < W - 1.4 * m; x += 2.6 * m) {
      g.fillStyle = "#3a5a8c"; g.fillRect(x, y0 + 0.75 * m, 1.6 * m, 1.5 * m);           // window
      g.fillStyle = "rgba(170,205,240,0.45)"; g.fillRect(x + 0.1 * m, y0 + 0.85 * m, 0.5 * m, 1.3 * m);
      g.strokeStyle = "#f5f1e6"; g.lineWidth = 0.1 * m; g.strokeRect(x, y0 + 0.75 * m, 1.6 * m, 1.5 * m);
      g.beginPath(); g.moveTo(x + 0.8 * m, y0 + 0.75 * m); g.lineTo(x + 0.8 * m, y0 + 2.25 * m); g.stroke();
    }
    g.fillStyle = "#f7f1e1"; g.fillRect(0, y0 + fh - 1.35 * m, W, 0.12 * m);               // railing
    for (let x = 0; x < W; x += 0.5 * m) g.fillRect(x, y0 + fh - 1.35 * m, 0.06 * m, 1.0 * m);
  }
});
const flagThai = () => ctex("flagTH", 300, 200, (g) => {
  const s = [["#a51931", 0, 1], ["#f4f5f8", 1, 1], ["#2d2a4a", 2, 2], ["#f4f5f8", 4, 1], ["#a51931", 5, 1]] as const; // 1:1:2:1:1
  for (const [c, a, n] of s) { g.fillStyle = c; g.fillRect(0, (a * 200) / 6, 300, (n * 200) / 6 + 1); }
});
/** sign board faces (unlit materials: a side sun turned painted signs grey-blue in the template) */
const signTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => ctex("sign" + key, w, h, draw);
const schoolSign = () => signTex("school", 1600, 520, (g) => {
  g.fillStyle = "#f5ecd6"; g.fillRect(0, 0, 1600, 520);
  g.strokeStyle = "#c79a3c"; g.lineWidth = 26; g.strokeRect(20, 20, 1560, 480);
  g.strokeStyle = "#2b3a67"; g.lineWidth = 6; g.strokeRect(48, 48, 1504, 424);
  thai(g, "โรงเรียนนายายอามพิทยาคม", 800, 210, 132, "#2b3a67", 700);
  thai(g, "อำเภอนายายอาม  จังหวัดจันทบุรี", 800, 365, 64, "#6a4a2a", 500);
});
const districtSign = () => signTex("district", 1500, 560, (g) => {
  g.fillStyle = "#1f7a4d"; g.fillRect(0, 0, 1500, 560);
  g.strokeStyle = "#f4f4ee"; g.lineWidth = 16; g.strokeRect(26, 26, 1448, 508);
  thai(g, "อำเภอนายายอาม", 750, 250, 200, "#f8f8f2", 700);
  thai(g, "ยินดีต้อนรับ", 750, 430, 84, "#f8f8f2", 500);
});
const officeSign = () => signTex("office", 1400, 300, (g) => {
  g.fillStyle = "#f6f1e2"; g.fillRect(0, 0, 1400, 300);
  g.strokeStyle = "#3a2a1a"; g.lineWidth = 12; g.strokeRect(10, 10, 1380, 280);
  thai(g, "แผนกศึกษาธิการอำเภอท่าใหม่", 700, 150, 96, "#2a2a4a", 600);
});
const arrowSign = () => signTex("arrow", 800, 260, (g) => {
  g.fillStyle = "#f4f0e2"; g.beginPath(); g.moveTo(10, 10); g.lineTo(640, 10); g.lineTo(790, 130); g.lineTo(640, 250); g.lineTo(10, 250); g.closePath(); g.fill();
  g.strokeStyle = "#2a2a2a"; g.lineWidth = 10; g.stroke();
  thai(g, "โรงเรียนมัธยม", 340, 130, 92, "#2a2a4a", 600);
});
const boardTex = () => ctex("blackboard", 800, 360, (g) => {
  g.fillStyle = "#2f4a3a"; g.fillRect(0, 0, 800, 360);
  g.strokeStyle = "#8a5a34"; g.lineWidth = 24; g.strokeRect(0, 0, 800, 360);
  thai(g, "๑๖ พ.ค. ๒๕๒๖", 400, 120, 72, "#f2f2ea", 500);
  thai(g, "ยินดีต้อนรับ", 400, 230, 84, "#f2f2ea", 500);
});
const watGable = () => ctex("watGable", 512, 256, (g) => {
  g.fillStyle = "#b8452f"; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "#e0b448"; g.lineWidth = 10;
  for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(40 + k * 30, 250); g.lineTo(256, 30 + k * 32); g.lineTo(472 - k * 30, 250); g.stroke(); }
  g.fillStyle = "#e0b448"; g.beginPath(); g.ellipse(256, 170, 40, 54, 0, 0, 7); g.fill();
  g.fillStyle = "#b8452f"; g.beginPath(); g.ellipse(256, 170, 22, 32, 0, 0, 7); g.fill();
});
const doorTex = (key: string, col: string, trim: string) => ctex("door" + key, 256, 512, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = trim; g.lineWidth = 12; g.strokeRect(16, 16, 224, 480); g.beginPath(); g.moveTo(128, 16); g.lineTo(128, 496); g.stroke();
  g.fillStyle = trim; for (const y of [140, 360]) for (const x of [70, 186]) { g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); }
});

// ---------------- shapes ----------------
const M4 = (x: number, y: number, z: number, yaw = 0) => new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
const mul4 = (a: THREE.Matrix4, b: THREE.Matrix4) => a.clone().multiply(b);
/** gable roof in local space: ridge along x at height y0 + rise, eaves at y0, overhang o, texture tiles of `tile` m */
const gable = (b: Batch, m: THREE.Matrix4, w: number, d: number, y0: number, rise: number, o: number, mat: THREE.Material, tile = 3, ends?: THREE.Material) => {
  const hw = w / 2 + o, hd = d / 2 + o, u = (2 * hw) / tile, v = Math.hypot(hd, rise) / tile;
  b.add(quad(V(-hw, y0, hd), V(hw, y0, hd), V(hw, y0 + rise, 0), V(-hw, y0 + rise, 0), u, v), mat, m);
  b.add(quad(V(hw, y0, -hd), V(-hw, y0, -hd), V(-hw, y0 + rise, 0), V(hw, y0 + rise, 0), u, v), mat, m);
  if (ends) {
    const ew = w / 2, ed = d / 2;
    b.add(tri(V(-ew, y0, -ed), V(-ew, y0, ed), V(-ew, y0 + rise * (ed / hd), 0)), ends, m);
    b.add(tri(V(ew, y0, ed), V(ew, y0, -ed), V(ew, y0 + rise * (ed / hd), 0)), ends, m);
  }
};
/** front gable triangle with its own (ornamented) texture, facing local +z, in the plane z = zf */
const gableFace = (b: Batch, m: THREE.Matrix4, w: number, y0: number, rise: number, zf: number, mat: THREE.Material) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-w / 2, y0, zf, w / 2, y0, zf, 0, y0 + rise, zf], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  b.add(g, mat, m);
};

// ---------------- materials ----------------
const MAT = () => ({
  grass: lam("grassHD", () => ({ map: grassHD() })),
  road: lam("asphalt", () => ({ map: asphaltTex() })),
  dirt: lam("dirtM", () => ({ map: dirtTex() })),
  pave: lam("paveHD", () => ({ map: stoneHD("paveHD", ["#d8cfc0", "#cfc5b5", "#e0d8ca", "#c9bfae"], "#a89e8e") })),
  watWall: lam("watWall", () => ({ map: plasterTex("wat", "#f4f0e6") })),
  watBase: lam("watBase", () => ({ map: plasterTex("watbase", "#e8e0cf") })),
  watRoof: lam("watRoof", () => ({ map: roofHD("#d0682a"), side: THREE.DoubleSide })),
  watRoofG: lam("watRoofG", () => ({ map: roofHD("#3f7f4a"), side: THREE.DoubleSide })),
  gold: lam("gold", () => ({ color: "#d9a93a" })),
  watGable: lam("watGableM", () => ({ map: watGable() })),
  watDoor: lam("watDoor", () => ({ map: doorTex("wat", "#8c2f26", "#d9a93a") })),
  teak: lam("teak", () => ({ map: woodWallTex("teak", "#9a6a42") })),
  teakDark: lam("teakDark", () => ({ map: woodWallTex("teakd", "#7a5034") })),
  post: lam("postWood", () => ({ map: beamHD() })),
  zinc: lam("zinc", () => ({ map: roofHD("#9aa3a8", true), side: THREE.DoubleSide })),
  tile: lam("tileRed", () => ({ map: roofHD("#a8533a"), side: THREE.DoubleSide })),
  office: lam("officeWall", () => ({ map: woodWallTex("office", "#e6d3a8") })),
  cream: lam("creamWall", () => ({ map: plasterTex("cream", "#efe2c4") })),
  schoolRoof: lam("schoolRoof", () => ({ map: roofHD("#d27a3e"), side: THREE.DoubleSide })),
  white: lam("whitePaint", () => ({ color: "#f3f1ea" })),
  steel: lam("steelPole", () => ({ color: "#c9ccd2" })),
  fence: lam("fence", () => ({ color: "#e9e3d6" })),
  table: lam("table", () => ({ map: woodWallTex("table", "#b98252") })),
  roomWall: lam("roomWall", () => ({ map: plasterTex("room", "#e9dfc4") })),
});
type Mats = ReturnType<typeof MAT>;
const unlit = (map: THREE.Texture) => { const m = new THREE.MeshBasicMaterial({ map, color: 0xeeeeee }); return m; };

/** Thai wooden house on stilts: posts, floor, plank walls, steep tiled or zinc gable roof, a stair */
const stiltHouse = (b: Batch, M: Mats, x: number, z: number, yaw: number, w: number, d: number, si: number) => {
  const m = M4(x, 0, z, yaw), fl = 1.7, wh = 2.5;
  for (const px of [-w / 2 + 0.2, 0, w / 2 - 0.2]) for (const pz of [-d / 2 + 0.2, d / 2 - 0.2]) b.add(boxGeo(V(px - 0.12, 0, pz - 0.12), V(px + 0.12, fl, pz + 0.12)), M.post, m);
  b.add(boxGeo(V(-w / 2 - 0.3, fl, -d / 2 - 0.3), V(w / 2 + 0.3, fl + 0.18, d / 2 + 1.2), 2), M.teakDark, m); // floor + front veranda
  b.add(boxGeo(V(-w / 2, fl + 0.18, -d / 2), V(w / 2, fl + 0.18 + wh, d / 2), 2), si % 3 === 1 ? M.teakDark : M.teak, m);
  b.add(quad(V(-0.45, fl + 0.2, d / 2 + 0.01), V(0.45, fl + 0.2, d / 2 + 0.01), V(0.45, fl + 2.1, d / 2 + 0.01), V(-0.45, fl + 2.1, d / 2 + 0.01)), M.teakDark, m); // door
  gable(b, m, w, d, fl + 0.18 + wh, d * 0.62, 0.55, si % 2 ? M.zinc : M.tile, 3, M.teak);
  for (let k = 0; k < 6; k++) b.add(boxGeo(V(-0.5, (fl * k) / 6, d / 2 + 1.2 + (6 - k) * 0.28), V(0.5, (fl * k) / 6 + 0.08, d / 2 + 1.5 + (6 - k) * 0.28)), M.post, m); // stair
};

/** Wat Pho Nak's ordination hall: white walls on a stepped base, two-tier orange roof with green edge, gold finials */
const watHall = (b: Batch, M: Mats) => {
  const m = M4(WAT[0], 0, WAT[2], -Math.PI / 2); // local +x (the front) = world +z, toward the road
  const L = 18, W = 9, H = 5.2, base = 1.1;
  b.add(boxGeo(V(-L / 2 - 1.6, 0, -W / 2 - 1.4), V(L / 2 + 1.6, base, W / 2 + 1.4), 2), M.watBase, m);
  b.add(boxGeo(V(-L / 2, base, -W / 2), V(L / 2, base + H, W / 2), 3), M.watWall, m);
  // porch columns on the front (local +x = world +z)
  for (const s of [-1, 1]) for (const k of [0.2, 0.55, 0.9]) b.add(new THREE.CylinderGeometry(0.28, 0.32, H + 0.4, 12).translate(L / 2 + 1.0, base + (H + 0.4) / 2, s * (W / 2) * k), M.white, m);
  // roof tiers
  gable(b, m, L + 2.4, W + 1.6, base + H, 2.3, 0.2, M.watRoofG, 3);
  gable(b, m, L + 1.4, W - 0.4, base + H + 1.1, 4.6, 0.2, M.watRoof, 3);
  gable(b, mul4(m, M4(-0.5, 0, 0)), L - 2.0, W - 3.4, base + H + 3.1, 3.4, 0.15, M.watRoof, 3);
  // front gable (na ban) and door
  const fm = mul4(m, M4(0, 0, 0, Math.PI / 2));
  gableFace(b, fm, W - 0.6, base + H + 1.1, 4.5, (L + 1.4) / 2 + 0.18 + 0.05, M.watGable);
  b.add(quad(V(L / 2 + 0.02, base, 1.0), V(L / 2 + 0.02, base, -1.0), V(L / 2 + 0.02, base + 3.4, -1.0), V(L / 2 + 0.02, base + 3.4, 1.0)), M.watDoor, m);
  // gold finials: chofa at both ridge ends (a curved horn), small hang hong along the eaves
  for (const s of [-1, 1]) {
    const horn = new THREE.TorusGeometry(0.55, 0.11, 8, 16, Math.PI * 0.9);
    b.add(horn, M.gold, mul4(m, new THREE.Matrix4().compose(V(s * ((L + 1.4) / 2 + 0.25), base + H + 1.1 + 4.6 + 0.3, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, s > 0 ? -0.3 : Math.PI + 0.3)), V(1, 1, 1))));
    for (let k = 0; k < 4; k++) b.add(new THREE.ConeGeometry(0.12, 0.6, 6), M.gold, mul4(m, M4(s * ((L + 1.4) / 2 + 0.2), base + H + 1.1 + k * 1.1, (s * (W - 0.6) / 2) * (1 - k / 4) * (k % 2 ? 1 : -1))));
  }
  // courtyard paving + a low white wall with a gate toward the road
  b.add(quadUp(WAT[0] - 16, WAT[0] + 16, WAT[2] - 14, WAT[2] + 17, 8, 8, 0.012), M.pave);
  for (const [x0, x1] of [[WAT[0] - 16, WAT[0] - 2.5], [WAT[0] + 2.5, WAT[0] + 16]]) b.add(boxGeo(V(x0, 0, WAT[2] + 17), V(x1, 1.1, WAT[2] + 17.3)), M.white);
  for (const s of [-1, 1]) b.add(boxGeo(V(WAT[0] + s * 2.5 - 0.35, 0, WAT[2] + 16.8), V(WAT[0] + s * 2.5 + 0.35, 2.4, WAT[2] + 17.5)), M.white);
};

/** Tha Mai district education office: a long wooden building with a veranda and its name board */
const office = (b: Batch, M: Mats, signs: THREE.Group) => {
  const [x, , z] = OFFICE, m = M4(x, 0, z);
  b.add(boxGeo(V(-6, 0, -4), V(6, 0.45, 5.7), 2), M.watBase, m);
  b.add(boxGeo(V(-6, 0.45, -4), V(6, 3.6, 4), 2), M.office, m);
  for (const px of [-5.7, -2, 2, 5.7]) b.add(boxGeo(V(px - 0.12, 0.45, 5.4), V(px + 0.12, 3.6, 5.65)), M.post, m);
  b.add(quad(V(-0.8, 0.46, 4.01), V(0.8, 0.46, 4.01), V(0.8, 2.6, 4.01), V(-0.8, 2.6, 4.01)), M.teakDark, m);
  gable(b, m, 12, 9.7, 3.6, 2.6, 0.5, M.tile, 3, M.office);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.98), unlit(officeSign()));
  s.position.set(x, 3.0, z + 5.72); s.layers.set(NOINK); signs.add(s);
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.76, 1.12, 0.06), M.teakDark); back.position.set(x, 3.0, z + 5.68); signs.add(back);
};

/** the insert set: a desk against a plaster wall with a window */
const deskSet = (b: Batch, M: Mats) => {
  const [x, , z] = DESK;
  b.add(boxGeo(V(x - 0.9, 0.76, z - 0.55), V(x + 0.9, 0.8, z + 0.55)), M.table);
  for (const sx of [-0.82, 0.82]) for (const sz of [-0.48, 0.48]) b.add(boxGeo(V(x + sx - 0.04, 0, z + sz - 0.04), V(x + sx + 0.04, 0.76, z + sz + 0.04)), M.table);
  b.add(boxGeo(V(x - 4, 0, z - 1.6), V(x + 4, 3.2, z - 1.4)), M.roomWall);
  b.add(quadUp(x - 4, x + 4, z - 1.4, z + 4, 2, 2, 0.005), M.teakDark);
};

/** today's campus: two school blocks, field, flagpole, fence and the name sign at the gate */
const campus = (b: Batch, M: Mats, nowG: THREE.Group, signs: THREE.Group) => {
  const block = (cx: number, cz: number, yaw: number, w: number, floors: number) => {
    const m = M4(cx, 0, cz, yaw), d = 9, h = floors * 3.4;
    const fac = lam("schoolFac" + w + floors, () => ({ map: schoolFacade(`${w}_${floors}`, w, floors) }));
    b.add(quad(V(-w / 2, 0, d / 2), V(w / 2, 0, d / 2), V(w / 2, h, d / 2), V(-w / 2, h, d / 2)), fac, m);
    b.add(quad(V(w / 2, 0, -d / 2), V(-w / 2, 0, -d / 2), V(-w / 2, h, -d / 2), V(w / 2, h, -d / 2)), fac, m);
    b.add(quad(V(-w / 2, 0, -d / 2), V(-w / 2, 0, d / 2), V(-w / 2, h, d / 2), V(-w / 2, h, -d / 2), 3, 3), M.cream, m);
    b.add(quad(V(w / 2, 0, d / 2), V(w / 2, 0, -d / 2), V(w / 2, h, -d / 2), V(w / 2, h, d / 2), 3, 3), M.cream, m);
    gable(b, m, w, d, h, 3.2, 0.8, M.schoolRoof, 3, M.cream);
  };
  block(CAMPUS[0], CAMPUS[2], 0, 36, 3);
  block(CAMPUS[0] + 26, CAMPUS[2] - 14, -Math.PI / 2, 22, 3);
  b.add(quadUp(CAMPUS[0] - 22, CAMPUS[0] + 16, 13, 36, 6, 4, 0.01), lam("fieldGrass", () => ({ map: grassHD(), color: "#cfe7b0" })));
  // fence along the road with a gap for the gate
  for (const [x0, x1] of [[-60, GATE[0] - 2.4], [GATE[0] + 4.2, 70]]) {
    b.add(boxGeo(V(x0, 0, 9.0), V(x1, 0.5, 9.25)), M.fence);
    for (let x = x0; x < x1; x += 2.5) b.add(boxGeo(V(x, 0, 9.05), V(x + 0.12, 1.3, 9.2)), M.fence);
    b.add(boxGeo(V(x0, 1.15, 9.05), V(x1, 1.25, 9.2)), M.fence);
  }
  // flagpole
  b.add(new THREE.CylinderGeometry(0.07, 0.1, 12, 10).translate(2, 6, 22), M.steel);
  b.add(boxGeo(V(0.6, 0, 20.6), V(3.4, 0.4, 23.4)), M.white);
  // gate sign: base + posts + board (face unlit, toward -z)
  const [gx, , gz] = GATE;
  b.add(boxGeo(V(gx - 2.0, 0, gz - 0.35), V(gx + 2.0, 0.55, gz + 0.35), 2), M.watBase);
  for (const s of [-1, 1]) b.add(boxGeo(V(gx + s * 1.7 - 0.13, 0.55, gz - 0.13), V(gx + s * 1.7 + 0.13, 3.2, gz + 0.13)), M.white);
  b.add(boxGeo(V(gx - 1.75, 1.72, gz - 0.08), V(gx + 1.75, 2.9, gz + 0.06)), M.white);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), unlit(schoolSign()));
  face.position.set(gx, 2.31, gz - 0.09); face.rotation.y = Math.PI; face.layers.set(NOINK); signs.add(face);
  void nowG;
};

/** the villagers' wooden school, built piece by piece in shot 9 (each part its own mesh so it can grow) */
type Part = { o: THREE.Object3D; k0: number; k1: number; grow: "y" | "drop" | "fade" };
const schoolParts = (M: Mats, parent: THREE.Group): Part[] => {
  const parts: Part[] = [], W = 12, D = 7, fl = 0.6, wallH = 1.0, ph = 3.4;
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const at = (o: THREE.Object3D, x: number, y: number, z: number) => { o.position.set(PLOT[0] + x, y, PLOT[2] + z); return o; };
  // posts (grow up), staggered
  let n = 0;
  for (const px of [-W / 2, -W / 4, 0, W / 4, W / 2]) for (const pz of [-D / 2, D / 2]) {
    const o = at(mk(new THREE.BoxGeometry(0.22, ph, 0.22).translate(0, ph / 2, 0), M.post), px, 0, pz);
    parts.push({ o, k0: 0.02 + n * 0.018, k1: 0.1 + n * 0.018, grow: "y" }); n++;
  }
  // floor
  parts.push({ o: at(mk(new THREE.BoxGeometry(W + 0.4, 0.16, D + 0.4).translate(0, fl - 0.08, 0), M.teakDark), 0, 0, 0), k0: 0.24, k1: 0.34, grow: "drop" });
  parts.push({ o: at(mk(new THREE.BoxGeometry(W, fl - 0.16, D).translate(0, (fl - 0.16) / 2, 0), M.post), 0, 0, 0), k0: 0.24, k1: 0.3, grow: "y" });
  // beams on top of the posts
  for (const pz of [-D / 2, D / 2]) parts.push({ o: at(mk(new THREE.BoxGeometry(W + 0.5, 0.2, 0.2), M.post), 0, ph, pz), k0: 0.36, k1: 0.44, grow: "drop" });
  // roof: two zinc slopes slide down into place
  const rise = 2.0, o = 0.6, hd = D / 2 + o, sl = Math.hypot(hd, rise);
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(W + 1.2, 0.06, sl);
    const roof = mk(g, M.zinc);
    roof.rotation.x = s * Math.atan2(rise, hd); roof.position.set(PLOT[0], ph + rise / 2 - 0.05, PLOT[2] + s * hd / 2 - s * 0.0);
    parts.push({ o: roof, k0: 0.48 + (s + 1) * 0.06, k1: 0.6 + (s + 1) * 0.06, grow: "drop" });
  }
  for (const s of [-1, 1]) { // gable ends
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, ph, -D / 2, 0, ph, D / 2, 0, ph + rise * (D / 2) / hd, 0], 3));
    g.computeVertexNormals();
    const tg = mk(g, M.teak); (tg.material as THREE.Material).side = THREE.DoubleSide;
    parts.push({ o: at(tg, s * W / 2, 0, 0), k0: 0.66, k1: 0.72, grow: "fade" });
  }
  // half walls on the back and sides (the front stays open to the yard), back wall full height with the board
  parts.push({ o: at(mk(new THREE.BoxGeometry(W, ph - fl, 0.12).translate(0, fl + (ph - fl) / 2, 0), M.teak), 0, 0, -D / 2 + 0.06), k0: 0.7, k1: 0.8, grow: "y" });
  for (const s of [-1, 1]) parts.push({ o: at(mk(new THREE.BoxGeometry(0.12, wallH, D).translate(0, fl + wallH / 2, 0), M.teak), s * (W / 2 - 0.06), 0, 0), k0: 0.76, k1: 0.84, grow: "y" });
  parts.push({ o: at(mk(new THREE.BoxGeometry(W, 0.5, 0.1).translate(0, fl + 0.25, 0), M.teak), 0, 0, D / 2 - 0.05), k0: 0.8, k1: 0.86, grow: "y" });
  // blackboard + desks
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.44), unlit(boardTex())); board.layers.set(NOINK); parent.add(board);
  parts.push({ o: at(board, 0, fl + 1.55, -D / 2 + 0.14), k0: 0.88, k1: 0.92, grow: "fade" });
  let dn = 0;
  for (const dx of [-3.6, -1.2, 1.2, 3.6]) for (const dz of [-1.4, 0.6]) {
    const desk = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.6), M.table); top.position.y = 0.72; desk.add(top);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.3), M.table); bench.position.set(0, 0.42, 0.6); desk.add(bench);
    for (const lx of [-0.62, 0.62]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), M.table); leg.position.set(lx, 0.36, 0); desk.add(leg); }
    desk.traverse((c) => { (c as THREE.Mesh).castShadow = true; (c as THREE.Mesh).receiveShadow = true; });
    parent.add(desk);
    parts.push({ o: at(desk, dx, fl, dz), k0: 0.86 + dn * 0.012, k1: 0.9 + dn * 0.012, grow: "drop" }); dn++;
  }
  return parts;
};

/** the district sign (pops up in shot 12) */
const districtBoard = (M: Mats) => {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 2.24), unlit(districtSign()));
  face.position.set(0, 3.6, -0.07); face.rotation.y = Math.PI; face.layers.set(NOINK);
  const back = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.4, 0.1), M.steel); back.position.y = 3.6;
  g.add(face, back);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.8, 0.16), M.steel); p.position.set(s * 2.4, 2.4, 0.1); g.add(p); }
  g.traverse((o) => { (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true; });
  g.position.set(...DSIGN);
  return g;
};

/** every lens position of the film looking at its subject (things in the way are left out of the static world) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 6; f < s.b + 6; f += 3) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  void camKeys;
  return out;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private thenG = new THREE.Group(); private nowG = new THREE.Group();
  private parts: Part[];
  private district: THREE.Group;
  private flag: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root, M = MAT();
    // ---- sky + light (template) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 36, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- static world ----
    setSight(sightLines());
    const b = new Batch(), bThen = new Batch(), bNow = new Batch();
    const signsNow = new THREE.Group(), signsAll = new THREE.Group();
    b.add(quadUp(-900, 900, -900, 900, 450, 450), M.grass);
    b.add(quadUp(-900, 900, -4, 4, 900 / 4, 1, 0.02), M.road);
    bThen.add(quadUp(PLOT[0] - 8, PLOT[0] + 8, PLOT[2] - 5, PLOT[2] + 9, 4, 4, 0.015), M.dirt); // the plot beside the temple
    b.add(quadUp(OFFICE[0] - 9, OFFICE[0] + 9, OFFICE[2] + 5.5, -4, 4, 4, 0.014), M.dirt);
    b.add(quadUp(PLOT[0] - 3, PLOT[0] + 3, PLOT[2] + 9, -4, 2, 6, 0.013), M.dirt); // path to the road
    watHall(b, M);
    office(b, M, signsAll);
    deskSet(b, M);
    // the far school at the end of the kid's road, and the arrow sign at the roadside
    {
      const m = M4(190, 0, -14);
      b.add(boxGeo(V(-9, 0, -4), V(9, 6.8, 4), 3), M.cream, m);
      gable(b, m, 18, 8, 6.8, 2.6, 0.6, M.schoolRoof, 3, M.cream);
      const [kx, , kz] = KIDROAD;
      const sx = kx + 6.5, sz = kz - 1.2, yaw = -Math.PI / 2 + 0.75;
      b.add(boxGeo(V(sx - 0.06, 0, sz - 0.06), V(sx + 0.06, 1.9, sz + 0.06)), M.post);
      const ar = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.49), unlit(arrowSign()));
      ar.position.set(sx, 1.65, sz); ar.rotation.y = yaw; ar.translateZ(0.04); ar.layers.set(NOINK); signsAll.add(ar);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.49, 0.04), M.white); back.position.set(sx, 1.65, sz); back.rotation.y = yaw; signsAll.add(back);
    }
    // village houses along the road (the ones on today's campus land exist only in 1983)
    const r = rng(7);
    for (const side of [-1, 1]) for (let x = -170; x < 170; x += 11 + r() * 6) {
      const z = side * (15 + r() * 7), w = 6 + r() * 2, d = 5 + r() * 1.5, yaw = side > 0 ? Math.PI : 0;
      if (side < 0 && x > -46 && x < 6) continue;           // temple + school plot
      if (side < 0 && x > 46 && x < 76) continue;           // education office
      if (Math.abs(x - KIDROAD[0]) < 8 && side > 0) continue;
      const onCampus = side > 0 && x > -26 && x < 52;
      const hx = w / 2 + 1.5, hz = d / 2 + 2.5;
      if (sightBlocked(x - hx, x + hx, 0, 6.5, z - hz, z + hz)) continue;
      stiltHouse(onCampus ? bThen : b, M, x, z, yaw, w, d, Math.floor(r() * 9));
    }
    // orchards (durian / rambutan rows) and a few tall palms near the road
    for (const side of [-1, 1]) for (let z = side * 32; Math.abs(z) < 150; z += side * (8 + r() * 2)) for (let x = -160; x < 160; x += 8 + r() * 3) {
      if (side < 0 && x > -46 && x < 8 && z > -62) continue;
      if (side < 0 && x > 44 && x < 78 && z > -40) continue;
      const onCampus = side > 0 && x > -26 && x < 52 && z < 70;
      if (onCampus) continue;
      prop(b, {}, Math.abs(x) % 3 < 1 ? "tree_fat" : "tree_oak", x + r() * 2, 0, z + r() * 2, 5.5 + r() * 2.5, r() * 6);
    }
    for (let x = -150; x < 150; x += 23 + r() * 12) for (const side of [-1, 1]) {
      const z = side * (9 + r() * 3);
      if (side > 0 && x > -26 && x < 52) continue;
      if (side < 0 && x > -46 && x < 6) continue;
      prop(r() < 0.5 ? b : b, {}, "tree-high-round", x, 0, z, 8 + r() * 3, r() * 6);
    }
    // temple trees (a big bodhi-like shade tree beside the hall)
    prop(b, {}, "tree_fat", WAT[0] - 13, 0, WAT[2] + 5, 10, 0.4);
    prop(b, {}, "tree_oak", WAT[0] + 13, 0, WAT[2] - 6, 8, 1.4);
    campus(bNow, M, this.nowG, signsNow);
    b.build(R); bThen.build(this.thenG); bNow.build(this.nowG);
    R.add(this.thenG, this.nowG, signsAll);
    this.nowG.add(signsNow);
    signsAll.traverse((o) => { o.castShadow = true; });
    this.parts = schoolParts(M, this.thenG);
    this.district = districtBoard(M);
    this.nowG.add(this.district);
    // the flag (Thai tricolour) waving on the campus pole
    const fm = new THREE.MeshLambertMaterial({ map: flagThai(), side: THREE.DoubleSide });
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.4, 14, 1), fm);
    this.flag.position.set(2.05, 11.2, 22); this.flag.castShadow = true; this.flag.frustumCulled = false;
    this.nowG.add(this.flag);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 6, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = s.crowd === "desk" ? 60 : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- eras: 1983 village vs today's campus ----
    const now = s.era === "now";
    this.thenG.visible = !now; this.nowG.visible = now;
    const k = now ? 1 : id < 9 ? 0 : id === 9 ? buildK(t) : 1;
    for (const p of this.parts) {
      const u = smooth((k - p.k0) / Math.max(0.001, p.k1 - p.k0));
      p.o.visible = !now && u > 0.001;
      if (p.grow === "y") p.o.scale.set(1, Math.max(0.001, u), 1);
      else if (p.grow === "drop") { p.o.userData.y0 ??= p.o.position.y; p.o.position.y = p.o.userData.y0 + 2.2 * (1 - u) ** 2; }
      else p.o.scale.setScalar(Math.max(0.001, u));
    }
    // district sign: always there today, except shot 12 where it springs up on "ก็ได้เป็นอำเภอ"
    let ds = 1;
    if (id === 12) { const x = t - T_DISTRICT; ds = x < 0 ? 0 : 1 + 0.18 * Math.exp(-5 * x) * Math.sin(16 * x) - Math.exp(-14 * x) * (1 - clamp01(x * 6)); }
    this.district.visible = ds > 0.01; this.district.scale.set(1, Math.max(0.01, ds), 1);
    // flag wave
    {
      const p = this.flag.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const u = (i % 15) / 14, y = i < 15 ? 0.7 : -0.7;
        p.setXYZ(i, -1.05 + u * 2.1, y + 0.06 * u * Math.sin(t * 4 - u * 3), 0.28 * u * Math.sin(t * 5.5 - u * 5));
      }
      p.needsUpdate = true;
      this.flag.position.x = 2.05 + 1.05;
    }
    // ---- cast + effects (template machinery) ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, kk] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, kk, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }
}

/** horizontal quad facing up at height dy covering x0..x1, z0..z1 (z0 < z1) */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
import { inTheWay as sightBlocked } from "./build";
void rep;
