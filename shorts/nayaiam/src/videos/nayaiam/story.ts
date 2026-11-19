// "The school that came before the district": the history of Na Yai Am Phitthayakhom School in ~67 s.
// Timeline is locked to the Thai narration (voice/lines_timed.json, 30 fps). Words inside a line are placed by
// their share of the line's characters (wordAt), good to a few frames with an even TTS voice.
export const FPS = 30;
export const TOTAL = 2010;
export const D0 = 0; // ground level (build.ts reads it)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

// ---------------- narration ----------------
export type Line = { id: string; tts: string; cap: string; start: number; end: number };
export const LINES: Line[] = [
  { id: "hook", tts: "โรงเรียนแห่งนี้ เกิดก่อนอำเภอที่ตัวเองใช้ชื่อ ตั้งเก้าปี", cap: "โรงเรียนแห่งนี้ เกิดก่อนอำเภอที่ตัวเองใช้ชื่อ|ตั้ง 9 ปี", start: 0.25, end: 3.794 },
  { id: "setting", tts: "ย้อนไปปีสองพันห้าร้อยยี่สิบหก นายายอามยังเป็นแค่ตำบลหนึ่ง ของอำเภอท่าใหม่ จังหวัดจันทบุรี", cap: "ย้อนไปปี 2526 นายายอามยังเป็นแค่ตำบลหนึ่ง|ของอำเภอท่าใหม่ จังหวัดจันทบุรี", start: 4.344, end: 11.456 },
  { id: "problem", tts: "เด็กที่จบประถม ถ้าอยากเรียนต่อมัธยม ต้องเดินทางไปโรงเรียนที่อยู่ไกลมาก", cap: "เด็กที่จบประถม ถ้าอยากเรียนต่อมัธยม|ต้องเดินทางไปโรงเรียนที่อยู่ไกลมาก", start: 11.906, end: 17.441 },
  { id: "gather", tts: "ชาวบ้านนายายอาม ช้างข้าม และตำบลใกล้เคียง จึงรวมตัวกัน", cap: "ชาวบ้านนายายอาม ช้างข้าม และตำบลใกล้เคียง|จึงรวมตัวกัน", start: 17.891, end: 21.952 },
  { id: "petition", tts: "ร่วมกับแผนกศึกษาธิการอำเภอท่าใหม่ ยื่นขอตั้งโรงเรียนมัธยมของตัวเอง", cap: "ร่วมกับแผนกศึกษาธิการอำเภอท่าใหม่|ยื่นขอตั้งโรงเรียนมัธยมของตัวเอง", start: 22.302, end: 27.393 },
  { id: "approve", tts: "สิบเจ็ดมีนาคม สองพันห้าร้อยยี่สิบหก กระทรวงศึกษาธิการ อนุญาต", cap: "17 มีนาคม 2526|กระทรวงศึกษาธิการ อนุญาต", start: 27.843, end: 33.045 },
  { id: "lucky", tts: "โชคดี ได้โรงเรียนแล้ว", cap: "โชคดี ได้โรงเรียนแล้ว", start: 33.645, end: 35.05 },
  { id: "unlucky", tts: "โชคร้าย ช่วงแรกยังต้องอาศัยที่เรียน", cap: "โชคร้าย ช่วงแรกยังต้องอาศัยที่เรียน", start: 35.4, end: 38.047 },
  { id: "build", tts: "ชาวบ้านเลยช่วยกันสร้างอาคารเรียนขึ้นข้างวัดโพธิ์นาค เหมือนงานบุญ ที่ทุกบ้านถือของมาคนละอย่าง", cap: "ชาวบ้านเลยช่วยกันสร้างอาคารเรียนขึ้นข้างวัดโพธิ์นาค|เหมือนงานบุญ ที่ทุกบ้านถือของมาคนละอย่าง", start: 38.547, end: 45.506 },
  { id: "open", tts: "สิบหกพฤษภาคม ห้องเรียนแรกเปิดสอน มีนายเดชา สุดเสวต เป็นผู้บริหารคนแรก", cap: "16 พฤษภาคม ห้องเรียนแรกเปิดสอน|มีนายเดชา สุดเสวต เป็นผู้บริหารคนแรก", start: 46.006, end: 52.62 },
  { id: "today", tts: "วันนี้ โรงเรียนอยู่บนที่ดินกว่าสี่สิบไร่ ริมถนนสุขุมวิท", cap: "วันนี้ โรงเรียนอยู่บนที่ดินกว่า 40 ไร่|ริมถนนสุขุมวิท", start: 53.12, end: 57.449 },
  { id: "twist", tts: "ส่วนตำบลเล็กเล็ก ที่เคยต้องส่งลูกไปเรียนไกล เก้าปีต่อมาก็ได้เป็นอำเภอ", cap: "ส่วนตำบลเล็ก ๆ ที่เคยต้องส่งลูกไปเรียนไกล|9 ปีต่อมาก็ได้เป็นอำเภอ", start: 57.949, end: 63.811 },
  { id: "end", tts: "เหมือนโรงเรียนมาถึงก่อน แล้วยืนรอ", cap: "เหมือนโรงเรียนมาถึงก่อน แล้วยืนรอ", start: 64.161, end: 66.74 },
];
const lineOf = (id: string) => LINES.find((l) => l.id === id)!;
/** time (s) at which the given phrase starts inside a line, by character share of the spoken text */
export const wordAt = (id: string, phrase: string) => {
  const l = lineOf(id), txt = l.tts.replace(/ /g, ""), i = txt.indexOf(phrase.replace(/ /g, ""));
  if (i < 0) throw new Error(`wordAt: "${phrase}" not in ${id}`);
  return l.start + ((l.end - l.start) * i) / txt.length;
};
const F = (s: number) => Math.round(s * FPS);

// story beats (seconds)
export const T_APPROVE = wordAt("approve", "อนุญาต");     // the stamp lands
export const T_BUILD0 = lineOf("build").start, T_BUILD1 = lineOf("build").end + 0.3;
export const T_DISTRICT = wordAt("twist", "ก็ได้เป็นอำเภอ"); // the district sign pops up
export const T_WAIT = wordAt("end", "แล้วยืนรอ");
/** building progress 0 (empty plot) .. 1 (finished) */
export const buildK = (t: number) => clamp01((t - T_BUILD0 - 0.4) / (T_BUILD1 - T_BUILD0 - 1.2));

// ---------------- places (metres, ground y = 0, +z toward the camera side of the road) ----------------
export const WAT: V3 = [-27, 0, -38];       // Wat Pho Nak's ordination hall, front facing +z
export const PLOT: V3 = [-8, 0, -33];       // the villagers' school building beside the temple (front at z = PLOT.z + 3.5)
export const OFFICE: V3 = [60, 0, -27];     // Tha Mai district education office (front at z = OFFICE.z + 4)
export const DESK: V3 = [300, 0, 300];      // insert set: the desk where the request is approved
export const KIDROAD: V3 = [-70, 0, 6.2];   // the kid at the roadside looking down the long road (+x)
export const CAMPUS: V3 = [12, 0, 42];      // today's campus on Sukhumvit Road
export const GATE: V3 = [1.5, 0, 9.5];      // the school's name sign at the gate (face toward -z, the road)
export const DSIGN: V3 = [6.2, 0, 18];       // the district sign that arrives nine years later

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Era = "then" | "now";
export type Crowd = "gate" | "aerial" | "roadkid" | "gather" | "petition" | "desk" | "plot" | "build" | "open" | "campus" | "wait";
export type ShotDef = { id: number; a: number; b: number; light: Light; era: Era; crowd: Crowd; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 126, light: "day", era: "now", crowd: "gate", sunAz: 120 },
  { id: 2, a: 126, b: 350, light: "day", era: "then", crowd: "aerial", sunAz: 110 },
  { id: 3, a: 350, b: 530, light: "day", era: "then", crowd: "roadkid", sunAz: 100 },
  { id: 4, a: 530, b: 664, light: "day", era: "then", crowd: "gather" },
  { id: 5, a: 664, b: 828, light: "day", era: "then", crowd: "petition" },
  { id: 6, a: 828, b: 1002, light: "day", era: "then", crowd: "desk", sunAz: 140, sunEl: 60 },
  { id: 7, a: 1002, b: 1058, light: "day", era: "then", crowd: "plot" },
  { id: 8, a: 1058, b: 1150, light: "day", era: "then", crowd: "plot" },
  { id: 9, a: 1150, b: 1376, light: "day", era: "then", crowd: "build" },
  { id: 10, a: 1376, b: 1590, light: "day", era: "then", crowd: "open" },
  { id: 11, a: 1590, b: 1734, light: "golden", era: "now", crowd: "campus", sunAz: 145, sunEl: 14 },
  { id: 12, a: 1734, b: TOTAL, light: "golden", era: "now", crowd: "wait", sunAz: 150, sunEl: 13 },
];
export const XFADE: Record<number, number> = { 3: 6, 7: 6, 9: 6, 10: 8, 11: 10, 12: 8 };
export const FLASH_AT = 126;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera (same grammar as the template: smootherstep glides, creeping holds, cuts, kicks) ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixCam(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const P = PLOT, G = GATE;
const CAMS: Record<number, Key[]> = {
  1: [ // hook: low on the gate sign + two students, then up over today's campus
    { f: 0, s: (f) => dolly(add(G, [0.3, 1.4, -11.2]), add(G, [0.3, 1.8, 0]), pushK(f, 0, 0.003), { fov: 40, roll: -0.03 }) },
    { f: 64, dur: 40, s: (f) => dolly(add(G, [-9, 9.5, -12]), add(G, [8, 3, 26]), pushK(f, 64, 0.002), { fov: 44, roll: 0.02 }) },
  ],
  2: [ // 1983: the village, the temple and the empty plot from the air
    { f: 126, s: (f) => dolly([62, 34, 30], [-12, 0, -30], pushK(f, 126, 0.0022), { fov: 44 }) },
    { f: F(wordAt("setting", "ของอำเภอท่าใหม่")) - 14, dur: 36, s: (f) => dolly([30, 20, 6], [-16, 1, -34], pushK(f, 270, 0.002), { fov: 42, roll: -0.03 }) },
  ],
  3: [ // the kid at the roadside, the road running off to a far school
    { f: 350, s: (f) => dolly(add(KIDROAD, [-7.8, 1.5, 0.3]), add(KIDROAD, [20, 1.0, -2.6]), pushK(f, 350, 0.0018), { fov: 40 }) },
    { f: F(wordAt("problem", "ต้องเดินทาง")) - 4, cut: true, s: (f) => dolly(add(KIDROAD, [3.4, 1.05, 1.6]), add(KIDROAD, [0, 1.0, 0]), pushK(f, 440, 0.0025, 0.006, 30), { fov: 36, roll: 0.035 }) },
  ],
  4: [ // villagers gather in front of the temple
    { f: 530, s: (f) => dolly(add(WAT, [14, 5.5, 26]), add(WAT, [2, 2.2, 10]), pushK(f, 530, 0.0022), { fov: 42 }) },
    { f: F(wordAt("gather", "จึงรวมตัวกัน")) - 3, cut: true, s: (f) => dolly(add(WAT, [4.2, 1.7, 19.5]), add(WAT, [1.2, 1.45, 13.2]), pushK(f, 600, 0.0025, 0.006, 30), { fov: 38, roll: -0.035 }) },
  ],
  5: [ // at the district education office with the petition
    { f: 664, s: (f) => dolly(add(OFFICE, [7, 2.4, 19]), add(OFFICE, [0, 2.4, 4]), pushK(f, 664, 0.0022), { fov: 42 }) },
    { f: F(wordAt("petition", "ยื่นขอ")) - 3, cut: true, s: (f) => dolly(add(OFFICE, [1.9, 1.75, 11.4]), add(OFFICE, [0.0, 1.55, 6.4]), pushK(f, 740, 0.0025), { fov: 40, roll: 0.035 }) },
  ],
  6: [ // insert: the approval stamp (punch push on "อนุญาต")
    { f: 828, s: (f) => dolly(add(DESK, [0.25, 1.62, 1.05]), add(DESK, [0, 0.8, 0.02]), pushK(f, 828, 0.002), { fov: 40 }) },
    { f: F(T_APPROVE) - 8, dur: 16, s: (f) => dolly(add(DESK, [0.18, 1.45, 0.8]), add(DESK, [0, 0.8, 0.02]), pushK(f, F(T_APPROVE), 0.0015, 0.006, 30), { fov: 38, roll: -0.04 }) },
  ],
  7: [ // lucky: the kids cheer on the empty plot
    { f: 1002, s: (f) => dolly(add(P, [1.6, 1.35, 10.6]), add(P, [0, 1.2, 4.9]), pushK(f, 1002, 0.003), { fov: 40, roll: 0.03 }) },
  ],
  8: [ // unlucky: pull back, nothing to learn in
    { f: 1058, s: (f) => dolly(add(P, [7, 4.2, 18]), add(P, [0, 0.8, 3]), pushK(f, 1058, 0.0016), { fov: 42, roll: -0.04 }) },
  ],
  9: [ // the villagers build it, then the carriers each bring something
    { f: 1150, s: (f) => dolly(add(P, [12, 7, 21]), add(P, [0, 2.0, 0]), pushK(f, 1150, 0.0015), { fov: 44 }) },
    { f: F(wordAt("build", "เหมือนงานบุญ")) - 3, cut: true, s: (f) => dolly(add(P, [4.2, 1.75, 13.2]), add(P, [0.5, 1.8, 7.6]), pushK(f, 1270, 0.0022), { fov: 40, roll: 0.03 }) },
  ],
  10: [ // opening day, then the first headteacher at the board
    { f: 1376, s: (f) => dolly(add(P, [4.5, 2.4, 14]), add(P, [0, 1.6, 3.5]), pushK(f, 1376, 0.002), { fov: 42 }) },
    { f: F(wordAt("open", "มีนายเดชา")) - 3, cut: true, s: (f) => dolly(add(P, [-1.6, 1.85, 8.6]), add(P, [0.6, 1.7, 3.6]), pushK(f, 1480, 0.0025), { fov: 38, roll: -0.03 }) },
  ],
  11: [ // today: the campus by Sukhumvit Road from the air
    { f: 1590, s: (f) => dolly([-46, 30, -26], [12, 3, 38], pushK(f, 1590, 0.0025), { fov: 44 }) },
  ],
  12: [ // the twist: the district sign arrives; the school was already there, waiting
    { f: 1734, s: (f) => dolly(add(G, [0.9, 1.5, -10.5]), add(G, [0.3, 2.2, 3]), pushK(f, 1734, 0.0018), { fov: 42 }) },
    { f: F(T_DISTRICT) - 10, dur: 22, s: (f) => dolly(add(G, [2.2, 1.9, -16]), add(G, [2.3, 2.8, 6]), pushK(f, F(T_DISTRICT), 0.0015), { fov: 54, roll: 0.03 }) },
    { f: F(wordAt("end", "เหมือน")) - 3, cut: true, s: (f) => dolly(add(G, [-1.6, 1.3, -4.4]), add(G, [0.4, 1.35, 0]), pushK(f, 1925, 0.0025, 0.006, 35), { fov: 38, roll: -0.035 }) },
  ],
};

const KICKS: [number, number][] = [[T_APPROVE, 1.2], [T_DISTRICT + 0.12, 1.0]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** every camera key of a shot, for the sight-line culler */
export const camKeys = (id: number) => CAMS[id];

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 10, focus: () => add(G, [0.2, 1.6, -1.5]) },   // hook: sign + students sharp, campus soft
  { f: 64, dur: 40, cInf: 0 },                                    // rise to the campus: sharp
  { f: 126, cInf: 0 },                                            // aerial
  { f: 350, cInf: 7, focus: () => add(KIDROAD, [0, 1.0, 0]) },    // kid + long road
  { f: F(wordAt("problem", "ต้องเดินทาง")) - 4, cInf: 13, focus: () => add(KIDROAD, [0, 1.05, 0]) }, // kid CU
  { f: 530, cInf: 0 },                                            // gathering wide
  { f: F(wordAt("gather", "จึงรวมตัวกัน")) - 3, cInf: 11, focus: () => add(WAT, [1.2, 1.5, 13.2]) },
  { f: 664, cInf: 0 },
  { f: F(wordAt("petition", "ยื่นขอ")) - 3, cInf: 11, focus: () => add(OFFICE, [0.0, 1.5, 6.4]) },
  { f: 828, cInf: 15, focus: () => add(DESK, [0, 0.8, 0]) },      // insert
  { f: 1002, cInf: 12, focus: () => add(P, [0, 1.2, 4.9]) },      // cheering kids
  { f: 1058, cInf: 0 },                                           // empty plot wide
  { f: F(wordAt("build", "เหมือนงานบุญ")) - 3, cInf: 10, focus: () => add(P, [0.5, 1.6, 7.6]) },
  { f: 1376, cInf: 0 },
  { f: F(wordAt("open", "มีนายเดชา")) - 3, cInf: 12, focus: () => add(P, [0.6, 1.7, 3.6]) },
  { f: 1590, cInf: 0 },
  { f: 1734, cInf: 5, focus: () => add(G, [0, 1.4, -0.4]) },
  { f: F(wordAt("end", "เหมือน")) - 3, cInf: 13, focus: () => add(G, [0.3, 1.3, -0.5]) },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
