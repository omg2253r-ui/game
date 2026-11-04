/**
 * Hunter City — the neon hub. Shops, guild, workshop, market, quest board, storage,
 * multiplayer lobby and the Dungeon Gate, with idle and wandering NPCs.
 */
import * as THREE from 'three';
import { Collision, type Rect } from './controller';
import { followSun, makeSky, makeSun, type Interactable, type WorldScene } from './common';
import { CharacterModel } from '../render/character';
import { box, cyl, glow, part, sphere, toon, torus } from '../render/toon';
import { gridTexture, signTexture, windowsTexture } from '../render/textures';
import { disposeTree, type QualityProfile } from '../render/renderer';
import type { Appearance } from '../../core/types';
import { Rng } from '../../core/rng';

export type CityAction = 'weapon' | 'armor' | 'workshop' | 'market' | 'guild' | 'quests' | 'storage' | 'lobby' | 'gate' | 'npc';

interface Building {
  id: CityAction;
  name: string;
  sub: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  facing: number; // door direction (radians)
  npc?: string;
}

const BUILDINGS: Building[] = [
  { id: 'weapon', name: 'WEAPONS', sub: 'Blades · Guns · Upgrades', x: -24, z: -6, w: 10, d: 9, h: 9, color: '#ff4f6b', facing: Math.PI / 2, npc: 'Smith Gorou' },
  { id: 'armor', name: 'ARMOR', sub: 'Coats · Plates · Gear', x: -24, z: 10, w: 10, d: 9, h: 8, color: '#4fa3ff', facing: Math.PI / 2, npc: 'Tailor Mei' },
  { id: 'workshop', name: 'PC WORKSHOP', sub: 'Assemble · Sell · Orders', x: 24, z: -6, w: 11, d: 10, h: 10, color: '#4fd8ff', facing: -Math.PI / 2, npc: 'Engineer Ohm' },
  { id: 'market', name: 'MARKET', sub: 'Buy & sell parts', x: 24, z: 11, w: 10, d: 8, h: 7, color: '#ffc044', facing: -Math.PI / 2, npc: 'Trader Lulu' },
  { id: 'guild', name: 'HUNTER GUILD', sub: 'Party · Recruit · Skills', x: -16, z: -26, w: 14, d: 10, h: 13, color: '#b07bff', facing: 0, npc: 'Guildmaster Ren' },
  { id: 'storage', name: 'STORAGE', sub: 'Vault', x: 16, z: 26, w: 9, d: 8, h: 7, color: '#5fe08a', facing: Math.PI, npc: 'Keeper Bo' },
  { id: 'lobby', name: 'CO-OP LOBBY', sub: 'Party up · Raids', x: -15, z: 26, w: 10, d: 8, h: 8, color: '#ff4fd8', facing: Math.PI, npc: 'Netrunner Zia' },
];

const NPC_LOOKS: Appearance[] = [
  { hair: 0, hairColor: '#d9d9e8', eyeColor: '#ff6b6b', skin: '#e9c4ae', outfit: 3, outfitColor: '#3a2a2a', accentColor: '#ff4f6b', accessory: 1, body: 1 },
  { hair: 3, hairColor: '#1b1b2e', eyeColor: '#4fa3ff', skin: '#ffe0cf', outfit: 1, outfitColor: '#1d2a40', accentColor: '#4fa3ff', accessory: 0, body: 0 },
  { hair: 2, hairColor: '#ffd84a', eyeColor: '#4fd8ff', skin: '#f2c9a8', outfit: 2, outfitColor: '#18303a', accentColor: '#4fd8ff', accessory: 2, body: 0 },
  { hair: 4, hairColor: '#ff9a3a', eyeColor: '#ffc044', skin: '#ffe6d6', outfit: 0, outfitColor: '#3a3018', accentColor: '#ffc044', accessory: 3, body: 0 },
  { hair: 1, hairColor: '#6b4fff', eyeColor: '#b07bff', skin: '#d7a283', outfit: 1, outfitColor: '#25183a', accentColor: '#b07bff', accessory: 1, body: 1 },
  { hair: 5, hairColor: '#5fe08a', eyeColor: '#5fe08a', skin: '#e3b08f', outfit: 0, outfitColor: '#183a25', accentColor: '#5fe08a', accessory: 0, body: 0 },
  { hair: 4, hairColor: '#ff4fd8', eyeColor: '#ff4fd8', skin: '#fff0e6', outfit: 2, outfitColor: '#3a1838', accentColor: '#ff4fd8', accessory: 2, body: 0 },
];
const NPC_WEAPONS = ['gravity_hammer', 'energy_greatsword', 'plasma_rifle', 'dual_plasma', 'quantum_spear', 'railgun', 'photon_scythe'];

export class HunterCity implements WorldScene {
  name = 'Hunter City';
  music = 'city' as const;
  scene = new THREE.Scene();
  collision = new Collision();
  interactables: Interactable[] = [];
  spawn = { x: 0, z: 8, facing: Math.PI };
  private npcs: CharacterModel[] = [];
  private walkers: { m: CharacterModel; path: THREE.Vector3[]; i: number; speed: number }[] = [];
  private spinners: THREE.Object3D[] = [];
  private drones: { o: THREE.Object3D; r: number; s: number; h: number; a: number }[] = [];
  private sun: THREE.DirectionalLight;
  private gateRing: THREE.Object3D | null = null;
  private t = 0;

  constructor(profile: QualityProfile, actions: Record<CityAction, (npc?: string) => void>) {
    const s = this.scene;
    s.background = new THREE.Color('#070a16');
    s.fog = new THREE.Fog('#0b1022', 40, profile.drawDistance + 40);
    makeSky(s, '#05070f', '#2a1840', 500);
    s.add(new THREE.HemisphereLight('#8aa4ff', '#3a2050', 1.5));
    s.add(new THREE.AmbientLight('#ffffff', 0.25));
    this.sun = makeSun(s, '#b8c8ff', 1.4, profile.shadowSize, profile.shadows, 45);
    const rng = new Rng(77);

    // ground
    const gtex = gridTexture('#4fd8ff', '#0d1224', 8);
    gtex.repeat.set(24, 24);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshToonMaterial({ map: gtex, color: '#9fb0d0' }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    // plaza disc + roads
    const ptex = gridTexture('#ff4fd8', '#26305a', 6).clone();
    ptex.userData.shared = false;
    ptex.repeat.set(5, 5);
    ptex.needsUpdate = true;
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(15, 48), new THREE.MeshToonMaterial({ map: ptex, color: '#c8d0ff' }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    s.add(plaza);
    const ringL = new THREE.Mesh(new THREE.RingGeometry(14.6, 15, 64), glow('#4fd8ff', 0.8));
    ringL.rotation.x = -Math.PI / 2;
    ringL.position.y = 0.03;
    s.add(ringL);
    for (const [w, d, x, z] of [[8, 90, 0, 0], [90, 8, 0, 0]] as const) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon('#141a2e'));
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.015, z);
      road.receiveShadow = true;
      s.add(road);
    }

    // central hologram fountain
    const base = part(cyl(3, 3.4, 0.6, 24), toon('#2a3352'));
    base.position.y = 0.3;
    s.add(base);
    const water = new THREE.Mesh(cyl(2.7, 2.7, 0.1, 24), glow('#2a7bff', 0.7, true));
    water.position.y = 0.62;
    s.add(water);
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(torus(1 + i * 0.5, 0.05, 40), glow(i === 1 ? '#ff4fd8' : '#4fd8ff', 0.9, true));
      r.position.y = 2.2 + i * 0.6;
      r.rotation.x = Math.PI / 2 + i * 0.3;
      s.add(r);
      this.spinners.push(r);
    }
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), glow('#bff4ff'));
    crystal.position.y = 3;
    s.add(crystal);
    this.spinners.push(crystal);
    this.collision.block.push({ x0: -3.4, z0: -3.4, x1: 3.4, z1: 3.4 });
    this.interactables.push({ id: 'fountain', pos: new THREE.Vector3(0, 0, 3.6), radius: 2.4, label: 'Data Fountain — Save game', icon: '💾', action: () => actions.npc('fountain') });

    // shops
    for (const b of BUILDINGS) this.addBuilding(b, actions, rng);

    // quest board
    const board = new THREE.Group();
    const post = part(box(4.2, 2.4, 0.3), toon('#232b48'));
    post.position.y = 1.9;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: signTexture('QUEST BOARD', '#ffc044', 'Bounties · Contracts'), toneMapped: false }));
    sign.position.set(0, 3.6, 0.17);
    const legs = part(box(0.3, 1.2, 0.3), toon('#1a1f33'));
    legs.position.set(-1.6, 0.6, 0);
    const legs2 = legs.clone();
    legs2.position.x = 1.6;
    for (let i = 0; i < 5; i++) {
      const note = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), toon(i % 2 ? '#ffe9b0' : '#d0f0ff'));
      note.position.set(-1.5 + i * 0.75, 1.9 + (i % 2) * 0.2, 0.16);
      note.rotation.z = (rng.next() - 0.5) * 0.3;
      board.add(note);
    }
    board.add(post, sign, legs, legs2);
    board.position.set(9, 0, -12);
    board.rotation.y = -0.5;
    s.add(board);
    this.collision.block.push({ x0: 7, z0: -13.5, x1: 11, z1: -10.5 });
    this.interactables.push({ id: 'quests', pos: new THREE.Vector3(8.2, 0, -10.2), radius: 2.6, label: 'Quest Board', icon: '📜', action: () => actions.quests() });

    // dungeon gate
    const gate = new THREE.Group();
    gate.position.set(0, 0, -40);
    const pillarL = part(box(2, 12, 2), toon('#20283f'));
    pillarL.position.set(-7, 6, 0);
    const pillarR = pillarL.clone();
    pillarR.position.x = 7;
    const top = part(box(16, 2, 2.2), toon('#20283f'));
    top.position.y = 12.5;
    const ring = new THREE.Mesh(torus(5, 0.35, 48), glow('#ff4fd8'));
    ring.position.y = 6.2;
    const portal = new THREE.Mesh(new THREE.CircleGeometry(4.7, 48), new THREE.MeshBasicMaterial({ color: '#7a3cff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    portal.position.y = 6.2;
    const gsign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: signTexture('DUNGEON GATE', '#ff4fd8', 'Abandoned City · Factory · Wasteland · Lab · Abyss'), toneMapped: false }));
    gsign.position.set(0, 12.5, 1.15);
    gate.add(pillarL, pillarR, top, ring, portal, gsign);
    s.add(gate);
    this.gateRing = ring;
    this.spinners.push(portal);
    const gl = new THREE.PointLight('#ff4fd8', 40, 30, 2);
    gl.position.set(0, 5, -37);
    s.add(gl);
    this.collision.block.push({ x0: -8, z0: -41, x1: -6, z1: -39 }, { x0: 6, z0: -41, x1: 8, z1: -39 }, { x0: -6, z0: -41.2, x1: 6, z1: -40.6 });
    this.interactables.push({ id: 'gate', pos: new THREE.Vector3(0, 0, -37.5), radius: 4.2, label: 'Enter the Dungeon Gate', icon: '🌀', action: () => actions.gate() });

    // skyline (LOD buildings)
    const winA = windowsTexture('#4fd8ff', 1);
    const winB = windowsTexture('#ff4fd8', 2);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rng.range(-0.04, 0.04);
      const r = rng.range(58, 85);
      const h = rng.range(18, 60);
      const w = rng.range(7, 14);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const lod = new THREE.LOD();
      const tex = (i % 3 ? winA : winB).clone();
      tex.userData.shared = false;
      tex.repeat.set(w / 6, h / 10);
      tex.needsUpdate = true;
      const hi = new THREE.Mesh(box(w, h, w), new THREE.MeshToonMaterial({ map: tex, emissive: new THREE.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.9, color: '#9aa6c8' }));
      hi.position.y = h / 2;
      const roof = new THREE.Mesh(box(w * 0.3, 0.5, w * 0.3), glow(i % 2 ? '#ff4fd8' : '#4fd8ff'));
      roof.position.y = h + 0.3;
      const hiG = new THREE.Group();
      hiG.add(hi, roof);
      const lo = new THREE.Mesh(box(w, h, w), toon('#141b30'));
      lo.position.y = h / 2;
      const loG = new THREE.Group();
      loG.add(lo);
      lod.addLevel(hiG, 0);
      lod.addLevel(loG, 120 * profile.lodBias);
      lod.position.set(x, 0, z);
      s.add(lod);
    }
    // street lamps
    for (const [x, z] of [[-6, -14], [6, -14], [-6, 16], [6, 16], [-14, -2], [14, -2], [-14, 6], [14, 6], [-5, -30], [5, -30]]) {
      const pole = part(cyl(0.12, 0.15, 5, 8), toon('#2a3352'));
      pole.position.set(x, 2.5, z);
      const lamp = new THREE.Mesh(sphere(0.35, 12, 8), glow(x > 0 ? '#4fd8ff' : '#ff4fd8'));
      lamp.position.set(x, 5.1, z);
      s.add(pole, lamp);
      this.collision.block.push({ x0: x - 0.2, z0: z - 0.2, x1: x + 0.2, z1: z + 0.2 });
    }
    // drones
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Group();
      const body = part(box(0.8, 0.25, 0.8), toon('#2a3352'));
      const eye = new THREE.Mesh(sphere(0.12, 8, 6), glow(i % 2 ? '#ff4fd8' : '#ffc044'));
      eye.position.y = -0.15;
      d.add(body, eye);
      s.add(d);
      this.drones.push({ o: d, r: rng.range(12, 35), s: rng.range(0.1, 0.25) * (i % 2 ? 1 : -1), h: rng.range(8, 16), a: rng.next() * 6 });
    }
    // wandering NPCs
    const paths = [
      [[-10, 18], [10, 18], [10, -16], [-10, -16]],
      [[-18, 2], [18, 2]],
      [[0, -18], [0, -32], [12, -32], [12, -18]],
    ];
    paths.forEach((p, i) => {
      const m = new CharacterModel({ look: NPC_LOOKS[(i + 3) % NPC_LOOKS.length], weaponId: NPC_WEAPONS[(i + 2) % NPC_WEAPONS.length] });
      const pts = p.map(([x, z]) => new THREE.Vector3(x, 0, z));
      m.root.position.copy(pts[0]);
      s.add(m.root);
      this.walkers.push({ m, path: pts, i: 1, speed: 2.2 + i * 0.3 });
    });

    // bounds
    const W: Rect = { x0: -45, z0: -46, x1: 45, z1: 40 };
    this.collision.walk = [W];
  }

  private addBuilding(b: Building, actions: Record<CityAction, (npc?: string) => void>, rng: Rng) {
    const s = this.scene;
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    const wall = new THREE.MeshToonMaterial({ color: '#232b48', map: windowsTexture(b.color, Math.round(b.x + b.z)), emissive: new THREE.Color('#ffffff'), emissiveMap: windowsTexture(b.color, Math.round(b.x + b.z)), emissiveIntensity: 0.5 });
    const body = new THREE.Mesh(box(b.w, b.h, b.d), wall);
    body.position.y = b.h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const roof = part(box(b.w + 0.6, 0.6, b.d + 0.6), toon('#161c30'));
    roof.position.y = b.h + 0.3;
    g.add(roof);
    // front facade: door + sign + awning, oriented by facing
    const front = new THREE.Group();
    front.rotation.y = b.facing;
    const depth = b.facing === 0 || Math.abs(b.facing) === Math.PI ? b.d : b.w;
    const half = depth / 2 + 0.05;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), glow(b.color, 0.55, true));
    door.position.set(0, 1.6, half);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.6), toon('#0b0f1c'));
    frame.position.set(0, 1.8, half - 0.01);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: signTexture(b.name, b.color, b.sub), toneMapped: false }));
    sign.position.set(0, Math.min(b.h - 1.2, 5.2), half + 0.06);
    const awn = part(box(5, 0.2, 1.6), toon(b.color));
    awn.position.set(0, 3.7, half + 0.8);
    const strip = new THREE.Mesh(box(5, 0.08, 0.08), glow(b.color));
    strip.position.set(0, 3.6, half + 1.6);
    front.add(frame, door, sign, awn, strip);
    g.add(front);
    s.add(g);
    // collision footprint
    this.collision.block.push({ x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 });
    // NPC stands in front of the door
    const dir = new THREE.Vector3(Math.sin(b.facing), 0, Math.cos(b.facing));
    const npcPos = new THREE.Vector3(b.x, 0, b.z).addScaledVector(dir, half + 1.6).add(new THREE.Vector3(dir.z * 2.2, 0, -dir.x * 2.2));
    const look = NPC_LOOKS[BUILDINGS.indexOf(b) % NPC_LOOKS.length];
    const npc = new CharacterModel({ look, weaponId: NPC_WEAPONS[BUILDINGS.indexOf(b) % NPC_WEAPONS.length] });
    npc.root.position.copy(npcPos);
    npc.root.rotation.y = b.facing;
    s.add(npc.root);
    this.npcs.push(npc);
    // light
    const l = new THREE.PointLight(b.color, 18, 14, 2);
    l.position.copy(new THREE.Vector3(b.x, 3, b.z).addScaledVector(dir, half + 2));
    s.add(l);
    const doorPos = new THREE.Vector3(b.x, 0, b.z).addScaledVector(dir, half + 1.2);
    this.interactables.push({ id: b.id, pos: doorPos, radius: 3, label: `${b.npc} — ${b.name}`, icon: '💬', action: () => actions[b.id](b.npc) });
    void rng;
  }

  update(dt: number, player: THREE.Vector3) {
    this.t += dt;
    for (const sp of this.spinners) sp.rotation.z += dt * 0.8;
    if (this.gateRing) this.gateRing.rotation.z -= dt * 0.6;
    for (const d of this.drones) {
      d.a += d.s * dt;
      d.o.position.set(Math.cos(d.a) * d.r, d.h + Math.sin(this.t * 2 + d.r) * 0.4, Math.sin(d.a) * d.r);
      d.o.rotation.y = -d.a;
    }
    for (const n of this.npcs) {
      n.update(dt);
      // NPCs glance at the player when near
      const d = n.root.position.distanceTo(player);
      const head = n.joints.head;
      if (head && d < 6) {
        const local = n.root.worldToLocal(player.clone().setY(1.5));
        head.rotation.y = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
      }
    }
    for (const w of this.walkers) {
      const target = w.path[w.i];
      const p = w.m.root.position;
      const dir = target.clone().sub(p);
      const dist = dir.length();
      if (dist < 0.3) w.i = (w.i + 1) % w.path.length;
      else {
        dir.normalize();
        p.addScaledVector(dir, Math.min(dist, w.speed * dt));
        const yaw = Math.atan2(dir.x, dir.z);
        w.m.root.rotation.y += Math.atan2(Math.sin(yaw - w.m.root.rotation.y), Math.cos(yaw - w.m.root.rotation.y)) * Math.min(1, dt * 6);
      }
      w.m.setLoop('walk');
      w.m.update(dt);
    }
    followSun(this.sun, player);
  }

  drawMinimap(g: CanvasRenderingContext2D, w: number, h: number, player: THREE.Vector3, yaw: number) {
    const sc = w / 100;
    g.clearRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    g.fillStyle = 'rgba(79,216,255,0.12)';
    g.beginPath();
    g.arc(0, 0, 15 * sc, 0, Math.PI * 2);
    g.fill();
    for (const b of BUILDINGS) {
      g.fillStyle = b.color + '99';
      g.fillRect((b.x - b.w / 2) * sc, (b.z - b.d / 2) * sc, b.w * sc, b.d * sc);
    }
    g.fillStyle = '#ff4fd8';
    g.fillRect(-7 * sc, -41 * sc, 14 * sc, 2 * sc);
    g.fillStyle = '#ffc044';
    g.fillRect(7 * sc, -13 * sc, 4 * sc, 3 * sc);
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

  dispose() {
    for (const n of [...this.npcs, ...this.walkers.map((w) => w.m)]) n.dispose();
    disposeTree(this.scene);
  }
}
