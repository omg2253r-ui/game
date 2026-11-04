/**
 * 3D dungeon built from a procedural layout: rooms, corridors, walls, themed props,
 * roaming machine "symbol encounters", chests, resource nodes, events, a hidden room
 * behind a cracked wall, a mini-boss and the final boss arena.
 * Rooms outside the draw distance are hidden (streaming / culling).
 */
import * as THREE from 'three';
import { Collision, type Rect } from './controller';
import { followSun, makeSky, makeSun, type Interactable, type WorldScene } from './common';
import { CELL, type DungeonLayout, type Encounter, type Room } from '../../core/dungeon/generator';
import { DUNGEON_MAP, type DungeonTheme } from '../../core/data/regions';
import { RobotModel } from '../render/robots';
import { box, cyl, glow, part, sphere, toon, torus, cone } from '../render/toon';
import { gridTexture, panelTexture } from '../render/textures';
import { disposeTree, type QualityProfile } from '../render/renderer';
import { Rng } from '../../core/rng';

export interface RunState {
  dungeonId: string;
  difficulty: number;
  seed: number;
  defeated: string[];
  opened: number[];
  gathered: string[];
  eventsUsed: number[];
  secrets: number[];
  visited: number[];
  pos: { x: number; z: number };
  hp: Record<string, number>;
  energy: Record<string, number>;
  startedAt: number;
  bossDefeated: boolean;
  buff?: string;
  lootValue: number;
}

export interface DungeonCallbacks {
  onEncounter(room: Room, idx: number, enc: Encounter): void;
  onChest(room: Room): void;
  onGather(room: Room, node: number): void;
  onEvent(room: Room): void;
  onSecret(room: Room): void;
  onExit(): void;
}

const WALL_H = 3.4;
const DOOR = 4.6;

interface Symbol {
  key: string;
  room: Room;
  enc: Encounter;
  model: RobotModel;
  home: THREE.Vector3;
  target: THREE.Vector3;
  wait: number;
  alive: boolean;
}

export class DungeonScene implements WorldScene {
  name: string;
  music = 'dungeon' as const;
  scene = new THREE.Scene();
  collision = new Collision();
  interactables: Interactable[] = [];
  spawn: { x: number; z: number; facing: number };
  readonly theme: DungeonTheme;
  private roomGroups = new Map<number, THREE.Group>();
  private symbols: Symbol[] = [];
  private chests = new Map<number, THREE.Group>();
  private nodes = new Map<string, THREE.Object3D>();
  private cracks = new Map<number, THREE.Object3D>();
  private corridorRects = new Map<string, Rect>();
  private spin: THREE.Object3D[] = [];
  private sun: THREE.DirectionalLight;
  private torch: THREE.PointLight;
  private grace = 1.5;
  private t = 0;
  currentRoom = 0;
  private drawDist: number;

  constructor(readonly layout: DungeonLayout, readonly run: RunState, profile: QualityProfile, private cb: DungeonCallbacks) {
    const def = DUNGEON_MAP[layout.dungeonId];
    this.name = def.name;
    this.theme = def.theme;
    this.drawDist = profile.drawDistance;
    const s = this.scene;
    s.background = new THREE.Color(this.theme.sky);
    s.fog = new THREE.Fog(this.theme.fog, 18, profile.drawDistance * 0.75);
    makeSky(s, this.theme.sky, this.theme.fog, 0);
    s.add(new THREE.HemisphereLight('#dfe8ff', this.theme.floor, 1.3));
    s.add(new THREE.AmbientLight('#ffffff', 0.35));
    this.sun = makeSun(s, '#fff0e0', 1.5, profile.shadowSize, profile.shadows, 30);
    this.torch = new THREE.PointLight(this.theme.accent, 25, 16, 2);
    s.add(this.torch);

    const rng = new Rng(layout.seed ^ 0x9e3779b9);
    for (const r of layout.rooms) this.buildRoom(r, rng);
    // corridors (unique pairs)
    for (const r of layout.rooms) {
      for (const l of r.links) if (l > r.id) this.buildCorridor(r, layout.rooms[l], false);
      if (r.secretLink !== undefined && r.type === 'hidden') this.buildCorridor(layout.rooms[r.secretLink], r, true);
    }
    const start = layout.rooms[0];
    const has = run.pos.x !== 0 || run.pos.z !== 0;
    this.spawn = has ? { x: run.pos.x, z: run.pos.z, facing: 0 } : { x: start.gx * CELL, z: start.gy * CELL + 2, facing: Math.PI };
    if (!run.visited.includes(0)) run.visited.push(0);
  }

  private center(r: Room) {
    return new THREE.Vector3(r.gx * CELL, 0, r.gy * CELL);
  }

  private doorSides(r: Room) {
    const sides: Record<'n' | 's' | 'e' | 'w', { secret: boolean }[]> = { n: [], s: [], e: [], w: [] };
    const rel = (o: Room) => (o.gx > r.gx ? 'e' : o.gx < r.gx ? 'w' : o.gy > r.gy ? 's' : 'n');
    for (const l of r.links) sides[rel(this.layout.rooms[l])].push({ secret: false });
    if (r.secretLink !== undefined) sides[rel(this.layout.rooms[r.secretLink])].push({ secret: true });
    return sides;
  }

  private buildRoom(r: Room, rng: Rng) {
    const g = new THREE.Group();
    const c = this.center(r);
    g.position.copy(c);
    const th = this.theme;
    // floor
    const ft = gridTexture(th.accent, th.floor, 6).clone();
    ft.userData.shared = false;
    ft.repeat.set(r.w / 4, r.h / 4);
    ft.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), new THREE.MeshToonMaterial({ map: ft, color: '#b8c0d8' }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const edge = new THREE.Mesh(new THREE.RingGeometry(Math.min(r.w, r.h) * 0.3, Math.min(r.w, r.h) * 0.3 + 0.12, 48), glow(r.type === 'boss' ? '#ff3a6b' : r.type === 'hidden' ? '#ffd84a' : th.accent, 0.6, true));
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.02;
    g.add(edge);
    // walls with door gaps
    const wallMat = new THREE.MeshToonMaterial({ color: '#ffffff', map: panelTexture(th.wall, th.accent) });
    const sides = this.doorSides(r);
    const mkWall = (len: number, horizontal: boolean, x: number, z: number) => {
      if (len <= 0.05) return;
      const m = new THREE.Mesh(box(horizontal ? len : 0.6, WALL_H, horizontal ? 0.6 : len), wallMat);
      m.position.set(x, WALL_H / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      const trim = new THREE.Mesh(box(horizontal ? len : 0.62, 0.08, horizontal ? 0.62 : len), glow(th.accent));
      trim.position.set(x, WALL_H, z);
      g.add(trim);
    };
    const hw = r.w / 2, hh = r.h / 2;
    for (const side of ['n', 's', 'e', 'w'] as const) {
      const horizontal = side === 'n' || side === 's';
      const len = horizontal ? r.w : r.h;
      const fixed = side === 'n' ? -hh : side === 's' ? hh : side === 'e' ? hw : -hw;
      const doors = sides[side];
      if (doors.length === 0) {
        if (horizontal) mkWall(len, true, 0, fixed);
        else mkWall(len, false, fixed, 0);
        continue;
      }
      const seg = (len - DOOR) / 2;
      if (horizontal) {
        mkWall(seg, true, -len / 2 + seg / 2, fixed);
        mkWall(seg, true, len / 2 - seg / 2, fixed);
      } else {
        mkWall(seg, false, fixed, -len / 2 + seg / 2);
        mkWall(seg, false, fixed, len / 2 - seg / 2);
      }
      if (doors.some((d) => d.secret) && r.type !== 'hidden' && !this.run.secrets.includes(r.id)) {
        const crack = new THREE.Mesh(box(horizontal ? DOOR : 0.5, WALL_H, horizontal ? 0.5 : DOOR), new THREE.MeshToonMaterial({ color: '#8a7a6a', map: panelTexture('#3a3028', '#ffd84a') }));
        crack.position.set(horizontal ? 0 : fixed, WALL_H / 2, horizontal ? fixed : 0);
        const glowCrack = new THREE.Mesh(box(horizontal ? 0.4 : 0.52, 2, horizontal ? 0.52 : 0.4), glow('#ffd84a', 0.8, true));
        glowCrack.position.copy(crack.position);
        glowCrack.rotation.set(horizontal ? 0 : 0.4, 0, horizontal ? 0.4 : 0);
        const crackG = new THREE.Group();
        crackG.add(crack, glowCrack);
        g.add(crackG);
        this.cracks.set(r.id, crackG);
        const inward = new THREE.Vector3(horizontal ? 0 : -Math.sign(fixed) * 1.6, 0, horizontal ? -Math.sign(fixed) * 1.6 : 0);
        const p = c.clone().add(new THREE.Vector3(horizontal ? 0 : fixed, 0, horizontal ? fixed : 0)).add(inward);
        this.interactables.push({
          id: `secret${r.id}`, pos: p, radius: 2.4, label: 'A cracked wall… something hums behind it', icon: '🔍',
          action: () => this.cb.onSecret(r), enabled: () => !this.run.secrets.includes(r.id),
        });
      } else if (doors.some((d) => d.secret) && r.type !== 'hidden' && this.run.secrets.includes(r.id)) {
        // already revealed
      }
    }
    this.collision.walk.push({ x0: c.x - hw, z0: c.z - hh, x1: c.x + hw, z1: c.z + hh });

    // props along walls
    const n = Math.floor((r.w + r.h) / 5);
    for (let i = 0; i < n; i++) {
      const side = rng.int(0, 3);
      const t = rng.range(-0.38, 0.38);
      let x = 0, z = 0;
      if (side === 0) { x = t * r.w; z = -hh + 1.4; }
      if (side === 1) { x = t * r.w; z = hh - 1.4; }
      if (side === 2) { x = hw - 1.4; z = t * r.h; }
      if (side === 3) { x = -hw + 1.4; z = t * r.h; }
      if (Math.abs(side < 2 ? x : z) < DOOR) continue; // keep door lanes clear
      const prop = this.makeProp(rng);
      prop.position.set(x, 0, z);
      prop.rotation.y = side < 2 ? 0 : Math.PI / 2;
      g.add(prop);
      this.collision.block.push({ x0: c.x + x - 0.7, z0: c.z + z - 0.7, x1: c.x + x + 0.7, z1: c.z + z + 0.7 });
    }

    // contents
    if (r.type === 'start') {
      const portal = new THREE.Group();
      const ring = new THREE.Mesh(torus(1.6, 0.15, 32), glow('#4fd8ff'));
      ring.position.y = 2;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), glow('#2a7bff', 0.4, true));
      disc.position.y = 2;
      portal.add(ring, disc);
      portal.position.set(-hw + 3, 0, -hh + 3);
      portal.rotation.y = Math.PI / 4;
      g.add(portal);
      this.spin.push(ring);
      this.interactables.push({ id: 'exit', pos: c.clone().add(new THREE.Vector3(-hw + 3, 0, -hh + 3)), radius: 2.4, label: 'Return to Hunter City', icon: '🏙', action: () => this.cb.onExit() });
    }
    if (r.chest) {
      const chest = this.makeChest(r.type === 'hidden' || r.type === 'elite');
      chest.position.set(r.type === 'hidden' ? 0 : 2.5, 0, r.type === 'hidden' ? 0 : -2.5);
      g.add(chest);
      this.chests.set(r.id, chest);
      if (this.run.opened.includes(r.id)) this.openChestVisual(r.id);
      const p = c.clone().add(chest.position);
      this.collision.block.push({ x0: p.x - 0.7, z0: p.z - 0.5, x1: p.x + 0.7, z1: p.z + 0.5 });
      this.interactables.push({ id: `chest${r.id}`, pos: p, radius: 2, label: r.type === 'hidden' ? 'Ancient Cache' : 'Supply Crate', icon: '🎁', action: () => this.cb.onChest(r), enabled: () => !this.run.opened.includes(r.id) && this.roomClear(r) });
    }
    if (r.resources) {
      for (let i = 0; i < r.resources; i++) {
        const key = `${r.id}:${i}`;
        const a = (i / r.resources) * Math.PI * 2;
        const pos = new THREE.Vector3(Math.cos(a) * r.w * 0.28, 0, Math.sin(a) * r.h * 0.28);
        const node = new THREE.Group();
        for (let k = 0; k < 4; k++) {
          const chunk = part(box(rng.range(0.4, 0.8), rng.range(0.3, 0.6), rng.range(0.4, 0.8)), toon(k % 2 ? '#6a6a7a' : '#8a6a48'));
          chunk.position.set(rng.range(-0.4, 0.4), 0.25, rng.range(-0.4, 0.4));
          chunk.rotation.y = rng.next() * 3;
          node.add(chunk);
        }
        const shine = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), glow('#ffd84a'));
        shine.position.y = 0.9;
        node.add(shine);
        this.spin.push(shine);
        node.position.copy(pos);
        g.add(node);
        this.nodes.set(key, node);
        if (this.run.gathered.includes(key)) node.visible = false;
        this.interactables.push({ id: `node${key}`, pos: c.clone().add(pos), radius: 1.8, label: 'Salvage scrap pile', icon: '⛏', action: () => this.cb.onGather(r, i), enabled: () => !this.run.gathered.includes(key) });
      }
    }
    if (r.event) {
      const ev = this.makeEvent(r.event);
      g.add(ev);
      const labels = { terminal: 'Hack the data terminal', merchant: 'Talk to the merchant drone', trap: 'Disarm the EMP trap', shrine: 'Ancient Core — restore the party' };
      this.interactables.push({ id: `event${r.id}`, pos: c.clone(), radius: 2.6, label: labels[r.event], icon: r.event === 'merchant' ? '🛒' : r.event === 'shrine' ? '✚' : '⌨', action: () => this.cb.onEvent(r), enabled: () => !this.run.eventsUsed.includes(r.id) });
      this.collision.block.push({ x0: c.x - 0.8, z0: c.z - 0.8, x1: c.x + 0.8, z1: c.z + 0.8 });
    }
    if (r.type === 'boss') {
      const arena = new THREE.Mesh(new THREE.RingGeometry(6, 6.4, 64), glow('#ff3a6b', 0.9, true));
      arena.rotation.x = -Math.PI / 2;
      arena.position.y = 0.03;
      g.add(arena);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pil = part(cyl(0.4, 0.5, 5, 8), toon(th.wall));
        pil.position.set(Math.cos(a) * 9, 2.5, Math.sin(a) * 9);
        const orb = new THREE.Mesh(sphere(0.35, 10, 8), glow('#ff3a6b'));
        orb.position.set(Math.cos(a) * 9, 5.3, Math.sin(a) * 9);
        g.add(pil, orb);
        this.collision.block.push({ x0: c.x + Math.cos(a) * 9 - 0.5, z0: c.z + Math.sin(a) * 9 - 0.5, x1: c.x + Math.cos(a) * 9 + 0.5, z1: c.z + Math.sin(a) * 9 + 0.5 });
      }
    }
    // roaming machines
    r.encounters.forEach((enc, i) => {
      const key = `${r.id}:${i}`;
      if (this.run.defeated.includes(key)) return;
      const lead = enc.enemies[0];
      const m = new RobotModel(lead.template, !!lead.elite);
      if (!enc.boss) m.root.scale.multiplyScalar(0.8);
      const home = c.clone().add(new THREE.Vector3((i === 0 ? -1 : 1) * r.w * 0.18, 0, (i === 0 ? 1 : -1) * r.h * 0.12));
      if (enc.boss) home.copy(c);
      m.root.position.copy(home);
      this.scene.add(m.root);
      this.symbols.push({ key, room: r, enc, model: m, home, target: home.clone(), wait: rng.range(0.5, 2), alive: true });
    });
    this.scene.add(g);
    this.roomGroups.set(r.id, g);
  }

  private buildCorridor(a: Room, b: Room, secret: boolean) {
    const ca = this.center(a), cb = this.center(b);
    const horizontal = a.gy === b.gy;
    const th = this.theme;
    const g = new THREE.Group();
    const wallMat = new THREE.MeshToonMaterial({ color: '#ffffff', map: panelTexture(th.wall, th.accent2) });
    let rect: Rect;
    if (horizontal) {
      const [l, r] = ca.x < cb.x ? [a, b] : [b, a];
      const x0 = l.gx * CELL + l.w / 2 - 1.2;
      const x1 = r.gx * CELL - r.w / 2 + 1.2;
      const z = a.gy * CELL;
      rect = { x0, z0: z - DOOR / 2 + 0.2, x1, z1: z + DOOR / 2 - 0.2 };
      const len = x1 - x0;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(len, DOOR), toon(th.floor));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set((x0 + x1) / 2, 0.01, z);
      floor.receiveShadow = true;
      g.add(floor);
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(box(len - 2, WALL_H, 0.5), wallMat);
        w.position.set((x0 + x1) / 2, WALL_H / 2, z + s * (DOOR / 2 + 0.25));
        w.castShadow = true;
        g.add(w);
      }
      const strip = new THREE.Mesh(box(len, 0.04, 0.2), glow(secret ? '#ffd84a' : th.accent2, 0.9, true));
      strip.position.set((x0 + x1) / 2, 0.03, z);
      g.add(strip);
    } else {
      const [t, d] = ca.z < cb.z ? [a, b] : [b, a];
      const z0 = t.gy * CELL + t.h / 2 - 1.2;
      const z1 = d.gy * CELL - d.h / 2 + 1.2;
      const x = a.gx * CELL;
      rect = { x0: x - DOOR / 2 + 0.2, z0, x1: x + DOOR / 2 - 0.2, z1 };
      const len = z1 - z0;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(DOOR, len), toon(th.floor));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(x, 0.01, (z0 + z1) / 2);
      floor.receiveShadow = true;
      g.add(floor);
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(box(0.5, WALL_H, len - 2), wallMat);
        w.position.set(x + s * (DOOR / 2 + 0.25), WALL_H / 2, (z0 + z1) / 2);
        w.castShadow = true;
        g.add(w);
      }
      const strip = new THREE.Mesh(box(0.2, 0.04, len), glow(secret ? '#ffd84a' : th.accent2, 0.9, true));
      strip.position.set(x, 0.03, (z0 + z1) / 2);
      g.add(strip);
    }
    this.scene.add(g);
    const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
    this.corridorRects.set(key, rect);
    const leaf = secret ? a : null;
    if (!secret || (leaf && this.run.secrets.includes(leaf.id))) this.collision.walk.push(rect);
  }

  revealSecret(roomId: number) {
    const r = this.layout.rooms[roomId];
    if (r.secretLink === undefined) return;
    const crack = this.cracks.get(roomId);
    if (crack) crack.visible = false;
    const key = `${Math.min(roomId, r.secretLink)}-${Math.max(roomId, r.secretLink)}`;
    const rect = this.corridorRects.get(key);
    if (rect && !this.collision.walk.includes(rect)) this.collision.walk.push(rect);
  }

  private makeProp(rng: Rng): THREE.Object3D {
    const th = this.theme;
    const g = new THREE.Group();
    switch (th.prop) {
      case 'racks': {
        const rack = part(box(1.2, 2.4, 0.8), toon('#1a2030'));
        rack.position.y = 1.2;
        g.add(rack);
        for (let i = 0; i < 5; i++) {
          const led = new THREE.Mesh(box(0.9, 0.05, 0.02), glow(rng.chance(0.5) ? th.accent : '#5fe08a'));
          led.position.set(0, 0.4 + i * 0.42, 0.41);
          g.add(led);
        }
        break;
      }
      case 'pipes': {
        const p = part(cyl(0.35, 0.35, 3, 10), toon('#5a4a3a'));
        p.position.y = 1.5;
        const v = new THREE.Mesh(torus(0.4, 0.06, 12), glow(th.accent));
        v.position.y = 1.2;
        v.rotation.x = Math.PI / 2;
        const tank = part(cyl(0.6, 0.6, 1.2, 12), toon('#3a3028'));
        tank.position.set(0, 0.6, 0);
        g.add(p, v, tank);
        break;
      }
      case 'barrels': {
        for (let i = 0; i < 2; i++) {
          const b = part(cyl(0.38, 0.38, 1, 12), toon(i ? '#4a5a2a' : '#5a4a1a'));
          b.position.set(i * 0.5 - 0.25, 0.5, i * 0.3);
          const band = new THREE.Mesh(cyl(0.39, 0.39, 0.1, 12), glow(th.accent));
          band.position.copy(b.position);
          g.add(b, band);
        }
        const sign = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), glow('#ffd84a'));
        sign.position.set(-0.25, 0.6, 0.39);
        g.add(sign);
        break;
      }
      case 'labs': {
        const tube = new THREE.Mesh(cyl(0.45, 0.45, 2.2, 14), glow(th.accent2, 0.35, true));
        tube.position.y = 1.3;
        const cap = part(cyl(0.5, 0.5, 0.2, 14), toon('#d0d4e0'));
        cap.position.y = 2.5;
        const base = part(cyl(0.55, 0.55, 0.25, 14), toon('#d0d4e0'));
        base.position.y = 0.12;
        const spec = part(sphere(0.25, 10, 8), toon('#4a2a6a'));
        spec.position.y = 1.3;
        g.add(tube, cap, base, spec);
        break;
      }
      case 'gears': {
        const gear = part(cyl(1, 1, 0.3, 12), toon('#4a2a30'));
        gear.rotation.x = Math.PI / 2;
        gear.position.y = 1.2;
        for (let i = 0; i < 8; i++) {
          const tooth = part(box(0.3, 0.3, 0.3), toon('#4a2a30'), { outline: false });
          const a = (i / 8) * Math.PI * 2;
          tooth.position.set(Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0);
          gear.add(tooth);
        }
        const hub = new THREE.Mesh(cyl(0.3, 0.3, 0.35, 10), glow(th.accent));
        hub.rotation.x = Math.PI / 2;
        hub.position.y = 1.2;
        g.add(gear, hub);
        this.spin.push(gear);
        break;
      }
    }
    return g;
  }

  private makeChest(rare: boolean): THREE.Group {
    const g = new THREE.Group();
    const col = rare ? '#ffd84a' : this.theme.accent;
    const base = part(box(1.2, 0.6, 0.8), toon(rare ? '#5a4a20' : '#2a3352'));
    base.position.y = 0.3;
    const lid = new THREE.Group();
    lid.name = 'lid';
    lid.position.set(0, 0.6, -0.4);
    const lidM = part(box(1.25, 0.25, 0.85), toon(rare ? '#7a6a30' : '#3a4462'));
    lidM.position.set(0, 0.12, 0.4);
    lid.add(lidM);
    const lock = new THREE.Mesh(box(0.25, 0.25, 0.05), glow(col));
    lock.position.set(0, 0.45, 0.42);
    lock.name = 'lock';
    const beam = new THREE.Mesh(cyl(0.4, 0.4, 6, 12, ), glow(col, 0.18, true));
    beam.position.y = 3;
    beam.name = 'beam';
    g.add(base, lid, lock, beam);
    return g;
  }

  openChestVisual(roomId: number) {
    const c = this.chests.get(roomId);
    if (!c) return;
    const lid = c.getObjectByName('lid');
    if (lid) lid.rotation.x = -1.9;
    const beam = c.getObjectByName('beam');
    if (beam) beam.visible = false;
    const lock = c.getObjectByName('lock');
    if (lock) lock.visible = false;
  }

  hideNode(key: string) {
    const n = this.nodes.get(key);
    if (n) n.visible = false;
  }

  private makeEvent(type: Room['event']): THREE.Object3D {
    const g = new THREE.Group();
    const a = this.theme.accent;
    if (type === 'terminal') {
      const t = part(box(1.2, 1.4, 0.6), toon('#20283a'));
      t.position.y = 0.7;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), glow('#5fe08a', 0.85));
      scr.position.set(0, 1.15, 0.31);
      g.add(t, scr);
    } else if (type === 'merchant') {
      const d = part(sphere(0.5, 14, 10), toon('#ffc044'));
      d.position.y = 1.6;
      const eye = new THREE.Mesh(sphere(0.15, 8, 6), glow('#4fd8ff'));
      eye.position.set(0, 1.6, 0.45);
      const ring = new THREE.Mesh(torus(0.7, 0.05, 20), glow('#ffc044'));
      ring.position.y = 1.6;
      ring.rotation.x = Math.PI / 2;
      this.spin.push(ring);
      const crate = part(box(1, 0.6, 0.8), toon('#5a4a30'));
      crate.position.y = 0.3;
      g.add(d, eye, ring, crate);
    } else if (type === 'trap') {
      const plate = new THREE.Mesh(cyl(1.4, 1.4, 0.08, 20), glow('#ff4f6b', 0.6, true));
      plate.position.y = 0.05;
      const core = part(cone(0.4, 0.8, 6), toon('#3a2028'));
      core.position.y = 0.4;
      g.add(plate, core);
    } else if (type === 'shrine') {
      const base = part(cyl(0.8, 1, 0.5, 10), toon('#3a3a4a'));
      base.position.y = 0.25;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), glow('#5fe08a'));
      crystal.position.y = 1.6;
      this.spin.push(crystal);
      g.add(base, crystal);
    }
    void a;
    return g;
  }

  roomClear(r: Room): boolean {
    return r.encounters.every((_, i) => this.run.defeated.includes(`${r.id}:${i}`));
  }

  roomAt(p: THREE.Vector3): Room | undefined {
    return this.layout.rooms.find((r) => Math.abs(p.x - r.gx * CELL) <= r.w / 2 && Math.abs(p.z - r.gy * CELL) <= r.h / 2);
  }

  removeSymbol(key: string) {
    const s = this.symbols.find((x) => x.key === key);
    if (!s) return;
    s.alive = false;
    s.model.play('dead', 0.8);
    setTimeout(() => this.scene.remove(s.model.root), 900);
  }

  setGrace(sec: number) {
    this.grace = sec;
  }

  update(dt: number, player: THREE.Vector3) {
    this.t += dt;
    this.grace = Math.max(0, this.grace - dt);
    for (const s of this.spin) s.rotation.z += dt * 1.2;
    const room = this.roomAt(player);
    if (room) {
      this.currentRoom = room.id;
      if (!this.run.visited.includes(room.id)) this.run.visited.push(room.id);
    }
    // visibility streaming
    for (const [id, g] of this.roomGroups) {
      const r = this.layout.rooms[id];
      const d = Math.hypot(r.gx * CELL - player.x, r.gy * CELL - player.z);
      g.visible = d < this.drawDist;
    }
    for (const s of this.symbols) {
      if (!s.alive) {
        s.model.update(dt);
        continue;
      }
      const m = s.model;
      const p = m.root.position;
      const sameRoom = room?.id === s.room.id;
      const toP = player.clone().sub(p);
      const dist = toP.length();
      m.root.visible = Math.hypot(p.x - player.x, p.z - player.z) < this.drawDist;
      if (sameRoom && dist < 8 && !s.enc.boss) {
        // chase
        toP.y = 0;
        toP.normalize();
        p.addScaledVector(toP, dt * 2.6);
        m.root.rotation.y = Math.atan2(toP.x, toP.z);
      } else if (!s.enc.boss) {
        s.wait -= dt;
        const to = s.target.clone().sub(p);
        if (to.length() < 0.3 || s.wait > 0) {
          if (s.wait <= 0) {
            s.wait = 1 + Math.random() * 2;
            const rr = s.room;
            s.target.set(rr.gx * CELL + (Math.random() - 0.5) * rr.w * 0.6, 0, rr.gy * CELL + (Math.random() - 0.5) * rr.h * 0.6);
          }
        } else {
          to.normalize();
          p.addScaledVector(to, dt * 1.4);
          m.root.rotation.y = Math.atan2(to.x, to.z);
        }
      } else {
        m.root.rotation.y = Math.atan2(player.x - p.x, player.z - p.z);
      }
      m.update(dt);
      const contact = s.enc.boss ? 5 : 1.7;
      if (sameRoom && dist < contact && this.grace <= 0) {
        this.grace = 3;
        this.cb.onEncounter(s.room, Number(s.key.split(':')[1]), s.enc);
      }
    }
    this.torch.position.set(player.x, 3.2, player.z);
    followSun(this.sun, player);
    this.run.pos = { x: player.x, z: player.z };
  }

  drawMinimap(g: CanvasRenderingContext2D, w: number, h: number, player: THREE.Vector3, yaw: number) {
    g.clearRect(0, 0, w, h);
    const sc = w / 130;
    g.save();
    g.translate(w / 2 - player.x * sc, h / 2 - player.z * sc);
    const vis = new Set(this.run.visited);
    const near = new Set<number>();
    for (const id of vis) for (const l of this.layout.rooms[id].links) near.add(l);
    for (const r of this.layout.rooms) {
      if (!vis.has(r.id) && !near.has(r.id)) continue;
      if (r.type === 'hidden' && !this.run.secrets.includes(r.secretLink ?? -1)) continue;
      const x = r.gx * CELL, z = r.gy * CELL;
      g.fillStyle = vis.has(r.id) ? (r.type === 'boss' ? '#ff3a6b88' : '#4fd8ff55') : '#ffffff18';
      g.fillRect((x - r.w / 2) * sc, (z - r.h / 2) * sc, r.w * sc, r.h * sc);
      for (const l of r.links) {
        const o = this.layout.rooms[l];
        g.strokeStyle = '#4fd8ff55';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x * sc, z * sc);
        g.lineTo(o.gx * CELL * sc, o.gy * CELL * sc);
        g.stroke();
      }
      if (vis.has(r.id)) {
        if (r.type === 'boss') this.icon(g, x * sc, z * sc, '#ff3a6b');
        if (r.chest && !this.run.opened.includes(r.id)) this.icon(g, (x + 2.5) * sc, (z - 2.5) * sc, '#ffd84a');
        if (r.event && !this.run.eventsUsed.includes(r.id)) this.icon(g, x * sc, z * sc, '#5fe08a');
      }
    }
    for (const s of this.symbols) {
      if (!s.alive || !vis.has(s.room.id)) continue;
      g.fillStyle = s.enc.boss ? '#ff3a6b' : '#ff8a6b';
      g.beginPath();
      g.arc(s.model.root.position.x * sc, s.model.root.position.z * sc, s.enc.boss ? 4 : 2.5, 0, Math.PI * 2);
      g.fill();
    }
    g.translate(player.x * sc, player.z * sc);
    g.rotate(-yaw);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4, 4);
    g.lineTo(-4, 4);
    g.fill();
    g.restore();
  }

  private icon(g: CanvasRenderingContext2D, x: number, y: number, c: string) {
    g.fillStyle = c;
    g.fillRect(x - 2.5, y - 2.5, 5, 5);
  }

  dispose() {
    disposeTree(this.scene);
  }
}
