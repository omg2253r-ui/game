/**
 * Machine enemies & bosses. Built procedurally from primitives with toon shading and
 * emissive "eyes", animated by a small state machine (idle hover/bob, attack lunge,
 * hit recoil, charge glow, death collapse).
 */
import * as THREE from 'three';
import { ENEMY_MAP } from '../../core/data/enemies';
import { box, capsule, cone, cyl, glow, part, sphere, toon, torus } from './toon';

type AnimState = 'idle' | 'attack' | 'hit' | 'dead' | 'cast';

export class RobotModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private t = Math.random() * 10;
  private state: AnimState = 'idle';
  private stateT = 0;
  private stateDur = 0;
  private eyes: THREE.Mesh[] = [];
  private spinners: THREE.Object3D[] = [];
  private limbs: THREE.Object3D[] = [];
  private core: THREE.Mesh | null = null;
  readonly color: string;
  readonly height: number;
  hover = false;
  charging = false;
  private lunge = new THREE.Vector3();
  private baseY = 0;

  constructor(readonly templateId: string, elite = false) {
    const d = ENEMY_MAP[templateId];
    this.color = d?.color ?? '#ff4f6b';
    this.root.add(this.body);
    this.height = this.build(templateId);
    const s = (d?.size ?? 1) * (elite ? 1.25 : 1);
    this.root.scale.setScalar(s);
    this.height *= s;
    if (elite) {
      const aura = new THREE.Mesh(torus(0.8, 0.03, 32), glow('#ffc044', 0.8, true));
      aura.rotation.x = Math.PI / 2;
      aura.position.y = 0.05;
      this.root.add(aura);
      this.spinners.push(aura);
    }
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== 'outline') o.castShadow = true;
    });
  }

  private eye(parent: THREE.Object3D, x: number, y: number, z: number, r = 0.06) {
    const e = new THREE.Mesh(sphere(r, 10, 8), glow(this.color));
    e.position.set(x, y, z);
    parent.add(e);
    this.eyes.push(e);
    return e;
  }

  private build(id: string): number {
    const b = this.body;
    const c = this.color;
    const metal = toon('#4a5266');
    const dark = toon('#22273a');
    const neon = glow(c);
    switch (id) {
      case 'scrap_bot': {
        const torso = part(box(0.7, 0.6, 0.5), toon('#8a6a48'));
        torso.position.y = 0.85;
        const head = part(box(0.42, 0.32, 0.36), metal);
        head.position.y = 1.35;
        this.eye(head, 0.1, 0.03, 0.19, 0.055);
        this.eye(head, -0.1, 0.03, 0.19, 0.04);
        const ant = part(cyl(0.01, 0.01, 0.3, 4), dark);
        ant.position.set(0.12, 0.3, 0);
        head.add(ant);
        for (const s of [1, -1]) {
          const arm = new THREE.Group();
          arm.position.set(s * 0.45, 1.0, 0);
          const a = part(cyl(0.07, 0.09, 0.55, 8), metal);
          a.position.y = -0.25;
          const claw = part(box(0.18, 0.16, 0.18), dark);
          claw.position.y = -0.55;
          arm.add(a, claw);
          b.add(arm);
          this.limbs.push(arm);
          const leg = part(cyl(0.09, 0.12, 0.55, 8), dark);
          leg.position.set(s * 0.2, 0.3, 0);
          b.add(leg);
        }
        const patch = part(box(0.25, 0.2, 0.02), toon('#b05a2a'));
        patch.position.set(-0.15, 0.95, 0.26);
        b.add(torso, head, patch);
        return 1.6;
      }
      case 'processor_bot': {
        const chip = part(box(0.8, 0.12, 0.8), toon('#2b3a4a'));
        chip.position.y = 1.0;
        const die = part(box(0.42, 0.1, 0.42), toon('#9fb4c8'));
        die.position.y = 1.1;
        const corePulse = new THREE.Mesh(box(0.3, 0.12, 0.3), neon);
        corePulse.position.y = 1.15;
        this.core = corePulse;
        for (let i = 0; i < 8; i++) {
          const pin = part(box(0.04, 0.04, 0.16), toon('#d8b45a'), { outline: false });
          const a = (i / 8) * Math.PI * 2;
          pin.position.set(Math.cos(a) * 0.45, 0.98, Math.sin(a) * 0.45);
          pin.rotation.y = -a;
          b.add(pin);
        }
        const stalk = part(cyl(0.06, 0.12, 0.8, 8), dark);
        stalk.position.y = 0.45;
        const base = part(cyl(0.3, 0.38, 0.1, 12), metal);
        base.position.y = 0.05;
        this.eye(b, 0, 1.0, 0.41, 0.07);
        b.add(chip, die, corePulse, stalk, base);
        this.hover = true;
        this.spinners.push(chip);
        return 1.3;
      }
      case 'graphics_guardian': {
        const card = part(box(1.3, 0.75, 0.22), toon('#2a3a2a'));
        card.position.y = 1.2;
        for (const x of [-0.35, 0.35]) {
          const fan = new THREE.Group();
          const ring = part(torus(0.25, 0.04, 20), metal);
          const blade = new THREE.Mesh(box(0.42, 0.06, 0.02), neon);
          const blade2 = blade.clone();
          blade2.rotation.z = Math.PI / 2;
          fan.add(ring, blade, blade2);
          fan.position.set(x, 1.2, 0.13);
          b.add(fan);
          this.spinners.push(fan);
        }
        const leg1 = part(box(0.2, 0.8, 0.2), dark);
        leg1.position.set(-0.4, 0.4, 0);
        const leg2 = leg1.clone();
        leg2.position.x = 0.4;
        const shield = new THREE.Mesh(box(0.06, 0.9, 0.7), glow(c, 0.35, true));
        shield.position.set(0.85, 1.1, 0.1);
        this.limbs.push(shield);
        const bracket = part(box(1.35, 0.08, 0.06), toon('#aab4c0'));
        bracket.position.set(0, 1.62, 0);
        this.eye(b, 0, 1.62, 0.05, 0.06);
        b.add(card, leg1, leg2, shield, bracket);
        return 1.8;
      }
      case 'memory_drone': {
        const stick = part(box(1.1, 0.3, 0.12), toon('#6a3a9a'));
        stick.position.y = 1.4;
        for (let i = 0; i < 6; i++) {
          const chipM = part(box(0.11, 0.12, 0.04), toon('#151018'), { outline: false });
          chipM.position.set(-0.35 + i * 0.14, 1.4, 0.05);
          b.add(chipM);
        }
        const gold = part(box(0.9, 0.05, 0.085), toon('#d8b45a'), { outline: false });
        gold.position.y = 1.28;
        for (const s of [1, -1]) {
          const rotor = new THREE.Group();
          rotor.position.set(s * 0.55, 1.55, 0);
          const blades = new THREE.Mesh(box(0.5, 0.02, 0.06), glow(c, 0.6, true));
          rotor.add(blades);
          b.add(rotor);
          this.spinners.push(rotor);
        }
        this.eye(b, 0, 1.4, 0.1, 0.06);
        b.add(stick, gold);
        this.hover = true;
        return 1.7;
      }
      case 'storage_beast': {
        const bodyM = part(box(1.3, 0.8, 0.9), toon('#463c6a'));
        bodyM.position.y = 0.85;
        const platter = part(cyl(0.38, 0.38, 0.06, 20), toon('#c8d0e0'));
        platter.rotation.x = Math.PI / 2;
        platter.position.set(0.15, 0.9, 0.46);
        this.spinners.push(platter);
        const jaw = new THREE.Group();
        jaw.position.set(0, 0.7, 0.45);
        const teeth = part(box(1.1, 0.12, 0.3), metal);
        teeth.position.z = 0.15;
        for (let i = 0; i < 7; i++) {
          const t = part(cone(0.05, 0.14, 4), toon('#eee'), { outline: false });
          t.position.set(-0.45 + i * 0.15, 0.1, 0.28);
          jaw.add(t);
        }
        jaw.add(teeth);
        this.limbs.push(jaw);
        for (const [x, z] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) {
          const leg = part(box(0.22, 0.5, 0.22), dark);
          leg.position.set(x, 0.25, z);
          b.add(leg);
        }
        this.eye(b, -0.35, 1.15, 0.46, 0.07);
        this.eye(b, -0.15, 1.15, 0.46, 0.05);
        const led = new THREE.Mesh(box(0.5, 0.05, 0.02), neon);
        led.position.set(0, 0.55, 0.46);
        b.add(bodyM, platter, jaw, led);
        return 1.4;
      }
      case 'cooling_mech': {
        const torso = part(cyl(0.45, 0.5, 0.8, 16), toon('#5a7c8a'));
        torso.position.y = 1.05;
        const fan = new THREE.Group();
        const ring = part(torus(0.36, 0.05, 24), metal);
        const bl = new THREE.Mesh(box(0.66, 0.08, 0.03), glow('#d4f8ff', 0.8, true));
        const bl2 = bl.clone();
        bl2.rotation.z = Math.PI / 3;
        const bl3 = bl.clone();
        bl3.rotation.z = -Math.PI / 3;
        fan.add(ring, bl, bl2, bl3);
        fan.position.set(0, 1.05, 0.48);
        this.spinners.push(fan);
        for (const s of [1, -1]) {
          const arm = new THREE.Group();
          arm.position.set(s * 0.6, 1.2, 0);
          const pipe = part(cyl(0.08, 0.08, 0.6, 8), metal);
          pipe.position.y = -0.3;
          const nozzle = part(cone(0.12, 0.2, 8), dark);
          nozzle.position.y = -0.65;
          nozzle.rotation.x = Math.PI;
          arm.add(pipe, nozzle);
          this.limbs.push(arm);
          b.add(arm);
          const leg = part(capsule(0.12, 0.4), dark);
          leg.position.set(s * 0.25, 0.35, 0);
          b.add(leg);
        }
        const dome = part(sphere(0.3, 14, 10), glow('#bff6ff', 0.5, true), { outline: false });
        dome.position.y = 1.55;
        this.eye(b, 0, 1.55, 0.25, 0.08);
        b.add(torso, fan, dome);
        return 1.8;
      }
      case 'power_core_golem': {
        const torso = part(box(1.0, 1.0, 0.7), toon('#4a3a30'));
        torso.position.y = 1.2;
        const core = new THREE.Mesh(sphere(0.25, 16, 12), glow('#ffb44f'));
        core.position.set(0, 1.25, 0.32);
        this.core = core;
        const cage = part(torus(0.3, 0.04, 16), metal);
        cage.position.set(0, 1.25, 0.36);
        for (const s of [1, -1]) {
          const arm = new THREE.Group();
          arm.position.set(s * 0.68, 1.5, 0);
          const up = part(box(0.3, 0.6, 0.3), dark);
          up.position.y = -0.3;
          const fist = part(box(0.38, 0.38, 0.38), metal);
          fist.position.y = -0.75;
          arm.add(up, fist);
          b.add(arm);
          this.limbs.push(arm);
          const leg = part(box(0.32, 0.7, 0.32), dark);
          leg.position.set(s * 0.28, 0.35, 0);
          b.add(leg);
        }
        const head = part(box(0.4, 0.3, 0.35), metal);
        head.position.y = 1.85;
        this.eye(head, 0, 0, 0.18, 0.07);
        b.add(torso, core, cage, head);
        return 2.1;
      }
      // ---------------- bosses ----------------
      case 'server_golem': {
        const rack = part(box(1.2, 1.9, 0.8), toon('#20283a'));
        rack.position.y = 1.5;
        for (let i = 0; i < 7; i++) {
          const unit = part(box(1.05, 0.18, 0.05), toon('#2f3a52'), { outline: false });
          unit.position.set(0, 0.75 + i * 0.25, 0.41);
          const led = new THREE.Mesh(box(0.08, 0.04, 0.02), glow(i % 2 ? '#4fd8ff' : '#5fe08a'));
          led.position.set(0.4, 0, 0.03);
          unit.add(led);
          b.add(unit);
        }
        const head = part(box(0.7, 0.45, 0.6), metal);
        head.position.y = 2.75;
        this.eye(head, 0.15, 0.02, 0.31, 0.08);
        this.eye(head, -0.15, 0.02, 0.31, 0.08);
        for (const s of [1, -1]) {
          const arm = new THREE.Group();
          arm.position.set(s * 0.85, 2.2, 0);
          const up = part(box(0.4, 0.9, 0.4), toon('#2f3a52'));
          up.position.y = -0.45;
          const fist = part(box(0.55, 0.5, 0.55), metal);
          fist.position.y = -1.05;
          const cable = new THREE.Mesh(box(0.06, 0.8, 0.06), neon);
          cable.position.set(0, -0.45, 0.22);
          arm.add(up, fist, cable);
          b.add(arm);
          this.limbs.push(arm);
          const leg = part(box(0.45, 0.6, 0.5), dark);
          leg.position.set(s * 0.35, 0.3, 0);
          b.add(leg);
        }
        b.add(rack, head);
        return 3.1;
      }
      case 'titan_mech': {
        const hull = part(box(1.6, 1.0, 1.2), toon('#6a5030'));
        hull.position.y = 2.0;
        const cockpit = part(box(0.8, 0.5, 0.6), metal);
        cockpit.position.set(0, 2.6, 0.2);
        this.eye(cockpit, 0, 0.05, 0.31, 0.12);
        const cannon = new THREE.Group();
        cannon.position.set(0.9, 2.3, 0);
        const barrel = part(cyl(0.16, 0.2, 1.4, 12), dark);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.6;
        const muzzle = new THREE.Mesh(torus(0.17, 0.04, 16), neon);
        muzzle.position.z = 1.3;
        cannon.add(barrel, muzzle);
        this.limbs.push(cannon);
        const pods = part(box(0.6, 0.5, 0.8), toon('#5a4428'));
        pods.position.set(-0.95, 2.4, 0);
        for (let i = 0; i < 4; i++) {
          const m = new THREE.Mesh(cyl(0.06, 0.06, 0.05, 8), glow('#ff6a2a'));
          m.rotation.x = Math.PI / 2;
          m.position.set(-0.95 + (i % 2) * 0.2 - 0.1, 2.5 - Math.floor(i / 2) * 0.2, 0.41);
          b.add(m);
        }
        for (const s of [1, -1]) {
          const leg = new THREE.Group();
          leg.position.set(s * 0.6, 1.5, 0);
          const th = part(box(0.45, 0.8, 0.5), dark);
          th.position.y = -0.4;
          const sh = part(box(0.4, 0.8, 0.45), metal);
          sh.position.set(0, -1.05, 0.1);
          const foot = part(box(0.6, 0.2, 0.9), dark);
          foot.position.set(0, -1.4, 0.15);
          leg.add(th, sh, foot);
          b.add(leg);
        }
        b.add(hull, cockpit, cannon, pods);
        return 3.0;
      }
      case 'reactor_beast': {
        const bodyM = part(sphere(0.9, 18, 14), toon('#5a2a1a'));
        bodyM.scale.set(1.3, 0.85, 1);
        bodyM.position.y = 1.3;
        const core = new THREE.Mesh(sphere(0.45, 16, 12), glow('#ff6a2a'));
        core.position.set(0, 1.4, 0.55);
        this.core = core;
        const ring = new THREE.Mesh(torus(0.6, 0.05, 24), glow('#9dff4f', 0.9, true));
        ring.position.set(0, 1.4, 0.4);
        this.spinners.push(ring);
        const jaw = new THREE.Group();
        jaw.position.set(0, 0.9, 0.9);
        for (let i = 0; i < 6; i++) {
          const t = part(cone(0.08, 0.3, 5), toon('#e8d8c0'), { outline: false });
          t.position.set(-0.4 + i * 0.16, 0, 0);
          t.rotation.x = Math.PI;
          jaw.add(t);
        }
        this.limbs.push(jaw);
        for (let i = 0; i < 4; i++) {
          const leg = part(capsule(0.16, 0.7), toon('#3a1a10'));
          const x = i < 2 ? -0.8 : 0.8;
          const z = i % 2 ? -0.4 : 0.4;
          leg.position.set(x, 0.45, z);
          leg.rotation.z = x > 0 ? -0.4 : 0.4;
          b.add(leg);
        }
        for (let i = 0; i < 5; i++) {
          const spike = part(cone(0.12, 0.5, 6), toon('#2a2020'));
          spike.position.set(-0.6 + i * 0.3, 2.05, -0.1);
          spike.rotation.x = -0.3;
          b.add(spike);
        }
        this.eye(b, 0.35, 1.75, 0.7, 0.09);
        this.eye(b, -0.35, 1.75, 0.7, 0.09);
        b.add(bodyM, core, ring, jaw);
        return 2.4;
      }
      case 'neural_overlord': {
        const brain = part(sphere(0.85, 20, 16), toon('#4a2a6a'));
        brain.scale.set(1.1, 0.9, 1);
        brain.position.y = 2.4;
        for (let i = 0; i < 6; i++) {
          const fold = new THREE.Mesh(torus(0.5 + (i % 3) * 0.12, 0.025, 20), glow(i % 2 ? '#d06bff' : '#5cffb0', 0.9));
          fold.position.y = 2.4;
          fold.rotation.set(Math.random() * 3, Math.random() * 3, 0);
          b.add(fold);
          this.spinners.push(fold);
        }
        const eye = this.eye(b, 0, 2.3, 0.85, 0.2);
        eye.scale.set(1.4, 0.8, 0.5);
        for (let i = 0; i < 6; i++) {
          const ten = new THREE.Group();
          const a = (i / 6) * Math.PI * 2;
          ten.position.set(Math.cos(a) * 0.5, 1.8, Math.sin(a) * 0.5);
          const seg = part(capsule(0.08, 1.2), toon('#2a1a3a'));
          seg.position.y = -0.6;
          const tip = new THREE.Mesh(sphere(0.07, 8, 6), glow('#d06bff'));
          tip.position.y = -1.3;
          ten.add(seg, tip);
          ten.rotation.z = Math.cos(a) * 0.4;
          ten.rotation.x = -Math.sin(a) * 0.4;
          b.add(ten);
          this.limbs.push(ten);
        }
        b.add(brain);
        this.hover = true;
        return 3.3;
      }
      case 'omega_machine': {
        const torso = part(box(1.6, 1.6, 1.0), toon('#3a1a24'));
        torso.position.y = 2.3;
        const crown = new THREE.Group();
        crown.position.y = 3.4;
        for (let i = 0; i < 8; i++) {
          const s = part(cone(0.12, 0.6, 4), toon('#ffd84a'));
          const a = (i / 8) * Math.PI * 2;
          s.position.set(Math.cos(a) * 0.55, 0.2, Math.sin(a) * 0.55);
          crown.add(s);
        }
        this.spinners.push(crown);
        const head = part(box(0.8, 0.6, 0.7), metal);
        head.position.y = 3.35;
        this.eye(head, 0, 0, 0.36, 0.14);
        const core = new THREE.Mesh(sphere(0.35, 16, 12), glow('#ff3a6b'));
        core.position.set(0, 2.4, 0.5);
        this.core = core;
        const halo = new THREE.Mesh(torus(1.4, 0.05, 40), glow('#ffd84a', 0.9, true));
        halo.position.set(0, 2.5, -0.6);
        this.spinners.push(halo);
        for (const s of [1, -1]) {
          const arm = new THREE.Group();
          arm.position.set(s * 1.05, 2.9, 0);
          const up = part(box(0.45, 1.1, 0.45), dark);
          up.position.y = -0.55;
          const blade = new THREE.Mesh(box(0.08, 1.4, 0.3), glow('#ff3a6b'));
          blade.position.set(0, -1.6, 0.2);
          arm.add(up, blade);
          b.add(arm);
          this.limbs.push(arm);
          const leg = part(box(0.5, 1.5, 0.55), dark);
          leg.position.set(s * 0.45, 0.75, 0);
          b.add(leg);
        }
        b.add(torso, crown, head, core, halo);
        return 3.8;
      }
      default: {
        const blob = part(capsule(0.4, 0.6), metal);
        blob.position.y = 0.8;
        this.eye(b, 0, 1.1, 0.38);
        b.add(blob);
        return 1.6;
      }
    }
  }

  play(state: AnimState, dur = 0.6, dir?: THREE.Vector3) {
    if (this.state === 'dead') return;
    this.state = state;
    this.stateT = 0;
    this.stateDur = dur;
    if (dir) this.lunge.copy(dir);
  }

  setCharging(on: boolean) {
    this.charging = on;
  }

  update(dt: number) {
    this.t += dt;
    this.stateT += dt;
    const t = this.t;
    for (const s of this.spinners) s.rotation.z += dt * 2.2;
    const pulse = 0.75 + Math.sin(t * (this.charging ? 14 : 3)) * 0.25;
    for (const e of this.eyes) e.scale.setScalar(this.state === 'dead' ? 0.2 : pulse);
    if (this.core) {
      const k = this.charging ? 1.3 + Math.sin(t * 16) * 0.3 : 1 + Math.sin(t * 2.5) * 0.06;
      this.core.scale.setScalar(k);
    }
    const bob = this.hover ? 0.18 + Math.sin(t * 2) * 0.1 : Math.sin(t * 3) * 0.015;
    let ox = 0, oz = 0, rx = 0, ry = 0, rz = 0, oy = bob;
    const p = Math.min(1, this.stateT / Math.max(0.01, this.stateDur));
    switch (this.state) {
      case 'attack': {
        const k = p < 0.4 ? -Math.sin((p / 0.4) * Math.PI) * 0.15 : Math.sin(((p - 0.4) / 0.6) * Math.PI);
        ox = this.lunge.x * k;
        oz = this.lunge.z * k;
        rx = k * 0.25;
        for (const l of this.limbs) l.rotation.x = -k * 1.4;
        if (p >= 1) this.state = 'idle';
        break;
      }
      case 'cast': {
        oy += Math.sin(p * Math.PI) * 0.3;
        ry = Math.sin(p * Math.PI * 2) * 0.3;
        for (const l of this.limbs) l.rotation.z = Math.sin(p * Math.PI) * 0.6;
        if (p >= 1) this.state = 'idle';
        break;
      }
      case 'hit': {
        const k = Math.sin(p * Math.PI) * (1 - p);
        rx = -k * 0.35;
        oz = -k * 0.25;
        rz = Math.sin(p * 40) * 0.05 * (1 - p);
        if (p >= 1) this.state = 'idle';
        break;
      }
      case 'dead': {
        const k = Math.min(1, p);
        rx = -k * 1.2;
        oy = bob * (1 - k) - k * 0.3;
        this.body.scale.setScalar(Math.max(0.01, 1 - k * 0.15));
        break;
      }
      default:
        for (const l of this.limbs) {
          l.rotation.x *= 0.9;
          l.rotation.z *= 0.9;
        }
        rz = Math.sin(t * 1.5) * 0.02;
    }
    this.body.position.set(ox, this.baseY + oy, oz);
    this.body.rotation.set(rx, ry, rz);
  }

  get dead() {
    return this.state === 'dead';
  }
}
