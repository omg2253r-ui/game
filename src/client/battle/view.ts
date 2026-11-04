/**
 * 3D battle presentation. Owns the arena, unit models, cinematic camera and plays back
 * the engine's event list as animations + VFX. It never decides outcomes.
 */
import * as THREE from 'three';
import type { BattleEvent, BattleState, Unit } from '../../core/combat/types';
import type { Element } from '../../core/types';
import { CharacterModel } from '../render/character';
import { RobotModel } from '../render/robots';
import { ELEMENT_COLOR, Vfx } from '../render/vfx';
import { glow, toon, torus, cyl, part } from '../render/toon';
import { gridTexture } from '../render/textures';
import { makeSky, makeSun } from '../world/common';
import { disposeTree, type QualityProfile } from '../render/renderer';
import type { DungeonTheme } from '../../core/data/regions';
import { audio } from '../audio/audio';

export interface ViewHooks {
  unit(id: string, patch: Partial<{ hp: number; maxHp: number; armor: number; maxArmor: number; energy: number; ult: number; alive: boolean }>): void;
  status(id: string, status: string, on: boolean, stacks?: number): void;
  float(id: string, text: string, cls: string, sub?: string): void;
  banner(text: string, color: string, sub?: string): void;
  log(text: string): void;
  team(v: number): void;
  flash(): void;
  added(u: Unit): void;
  swapped(outId: string, inId: string): void;
  intents(i: Record<string, unknown>): void;
  name(id: string): string;
}

interface UnitView {
  id: string;
  side: 'ally' | 'enemy';
  hunter?: CharacterModel;
  robot?: RobotModel;
  root: THREE.Object3D;
  home: THREE.Vector3;
  facing: number;
  height: number;
  ranged: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class BattleView {
  readonly scene = new THREE.Scene();
  readonly vfx: Vfx;
  readonly units = new Map<string, UnitView>();
  speed = 1;
  private camPos = new THREE.Vector3(7, 6, 12);
  private camLook = new THREE.Vector3(0, 1.2, -1);
  private goalPos = new THREE.Vector3(7, 6, 12);
  private goalLook = new THREE.Vector3(0, 1.2, -1);
  private camLerp = 3;
  private t = 0;
  private arenaRing: THREE.Object3D;
  private portrait: boolean;
  slowmo = 1;
  private tmp = new THREE.Vector3();

  constructor(state: BattleState, readonly camera: THREE.PerspectiveCamera, theme: DungeonTheme, profile: QualityProfile, private hooks: ViewHooks) {
    const s = this.scene;
    s.background = new THREE.Color(theme.sky);
    s.fog = new THREE.Fog(theme.fog, 25, 70);
    makeSky(s, theme.sky, theme.fog, 200);
    s.add(new THREE.HemisphereLight('#e8f0ff', theme.floor, 1.5));
    s.add(new THREE.AmbientLight('#ffffff', 0.45));
    makeSun(s, '#fff4e8', 2.0, profile.shadowSize, profile.shadows, 16);
    const fill = new THREE.DirectionalLight(theme.accent, 0.8);
    fill.position.set(-8, 4, 10);
    s.add(fill);
    const rim = new THREE.PointLight(theme.accent2, 30, 30, 2);
    rim.position.set(0, 6, -9);
    s.add(rim);

    const tex = gridTexture(theme.accent, theme.floor, 8).clone();
    tex.userData.shared = false;
    tex.repeat.set(6, 6);
    tex.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshToonMaterial({ map: tex, color: '#c0c8e0' }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const ring = new THREE.Mesh(torus(11, 0.08, 96), glow(theme.accent, 0.9));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    s.add(ring);
    this.arenaRing = ring;
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(15.6, 16, 96), glow(theme.accent2, 0.6, true));
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.04;
    s.add(ring2);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const p = part(cyl(0.35, 0.5, 6 + (i % 3) * 2, 8), toon(theme.wall));
      p.position.set(Math.cos(a) * 19, 3, Math.sin(a) * 19);
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), glow(i % 2 ? theme.accent : theme.accent2));
      cap.position.set(Math.cos(a) * 19, 7 + (i % 3) * 2, Math.sin(a) * 19);
      s.add(p, cap);
    }

    this.vfx = new Vfx(profile.particles);
    s.add(this.vfx.group);
    this.portrait = window.innerWidth < window.innerHeight;
    for (const u of state.units) if (u.onField || u.side === 'enemy') this.addUnit(u, state);
    this.layout(state);
    this.overview(true);
  }

  private addUnit(u: Unit, state: BattleState) {
    if (this.units.has(u.id)) return;
    let v: UnitView;
    if (u.side === 'ally') {
      const m = new CharacterModel({ look: u.look ?? { hair: 0, hairColor: '#333', eyeColor: '#4fd8ff', skin: '#ffe0cf', outfit: 0, outfitColor: '#223', accentColor: '#4fd8ff', accessory: 0, body: 0 }, weaponId: u.weaponId ?? 'energy_katana', scale: 1 });
      v = { id: u.id, side: 'ally', hunter: m, root: m.root, home: new THREE.Vector3(), facing: Math.PI, height: 1.9, ranged: m.ranged };
    } else {
      const m = new RobotModel(u.templateId, u.isElite);
      v = { id: u.id, side: 'enemy', robot: m, root: m.root, home: new THREE.Vector3(), facing: 0, height: m.height, ranged: true };
    }
    if (!u.alive) {
      v.root.visible = false;
    }
    this.scene.add(v.root);
    this.units.set(u.id, v);
    void state;
  }

  /** place units in formation */
  layout(state: BattleState) {
    const allies = state.units.filter((u) => u.side === 'ally' && u.onField).sort((a, b) => a.slot - b.slot);
    const enemies = state.units.filter((u) => u.side === 'enemy' && (u.alive || this.units.get(u.id)?.root.visible));
    const spread = this.portrait ? 2.3 : 3;
    allies.forEach((u, i) => {
      const v = this.units.get(u.id);
      if (!v) return;
      const x = (i - (allies.length - 1) / 2) * spread;
      v.home.set(x, 0, 4.2 + Math.abs(x) * 0.12);
      v.facing = Math.PI;
      v.root.position.copy(v.home);
      v.root.rotation.y = v.facing;
    });
    const bosses = enemies.filter((u) => u.isBoss);
    const minions = enemies.filter((u) => !u.isBoss);
    bosses.forEach((u) => {
      const v = this.units.get(u.id)!;
      v.home.set(0, 0, -5.8);
    });
    const espread = this.portrait ? 2.6 : 3.4;
    minions.forEach((u, i) => {
      const v = this.units.get(u.id);
      if (!v) return;
      const n = minions.length;
      let x = (i - (n - 1) / 2) * espread;
      if (bosses.length) x = (i % 2 ? 1 : -1) * (3.6 + Math.floor(i / 2) * 2.4);
      v.home.set(x, 0, -3.6 - Math.abs(x) * 0.1 + (bosses.length ? 1 : 0));
    });
    for (const u of enemies) {
      const v = this.units.get(u.id);
      if (!v) continue;
      v.facing = 0;
      v.root.position.copy(v.home);
      v.root.rotation.y = Math.atan2(-v.home.x * 0.3, 1);
    }
  }

  overview(snap = false) {
    const p = this.portrait;
    this.goalPos.set(p ? 0 : 7.5, p ? 8 : 6.2, p ? 14 : 12.5);
    this.goalLook.set(0, 1.1, p ? -1.2 : -0.8);
    this.camLerp = 2.5;
    if (snap) {
      this.camPos.copy(this.goalPos);
      this.camLook.copy(this.goalLook);
    }
  }

  focus(a: THREE.Vector3, b: THREE.Vector3, close = 1) {
    const mid = a.clone().lerp(b, 0.5);
    const dir = b.clone().sub(a).setY(0);
    const len = Math.max(3, dir.length());
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    this.goalPos.copy(mid).addScaledVector(side, (len * 0.9 + 3) * close).addScaledVector(dir, -len * 0.25).setY(3 + len * 0.15);
    this.goalLook.copy(mid).setY(1.3);
    this.camLerp = 3.5;
  }

  heroShot(v: UnitView) {
    const p = v.root.position;
    const f = new THREE.Vector3(Math.sin(v.root.rotation.y), 0, Math.cos(v.root.rotation.y));
    this.goalPos.copy(p).addScaledVector(f, 4.2).add(new THREE.Vector3(1.4, 1.6, 0));
    this.goalLook.copy(p).setY(1.4);
    this.camLerp = 5;
  }

  update(dt: number) {
    const sdt = dt * this.speed * this.slowmo;
    this.t += sdt;
    this.arenaRing.rotation.z += sdt * 0.1;
    for (const v of this.units.values()) {
      v.hunter?.update(sdt);
      v.robot?.update(sdt);
    }
    this.vfx.update(sdt);
    const k = Math.min(1, dt * this.camLerp);
    this.camPos.lerp(this.goalPos, k);
    this.camLook.lerp(this.goalLook, k);
    this.camera.position.copy(this.camPos);
    if (this.vfx.shake > 0) {
      const s = this.vfx.shake * 0.35;
      this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    }
    this.camera.lookAt(this.camLook);
  }

  /** screen position above a unit (for DOM labels) */
  screenPos(id: string, out: { x: number; y: number; visible: boolean }) {
    const v = this.units.get(id);
    if (!v || !v.root.visible) {
      out.visible = false;
      return out;
    }
    this.tmp.copy(v.root.position);
    this.tmp.y += v.height + 0.3;
    this.tmp.project(this.camera);
    out.x = (this.tmp.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-this.tmp.y * 0.5 + 0.5) * window.innerHeight;
    out.visible = this.tmp.z < 1;
    return out;
  }

  centerOf(id: string): THREE.Vector3 {
    const v = this.units.get(id);
    if (!v) return new THREE.Vector3();
    return v.root.position.clone().setY(v.height * 0.55);
  }

  pick(x: number, y: number): string | null {
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    let best: string | null = null;
    let bestD = Infinity;
    for (const v of this.units.values()) {
      if (!v.root.visible) continue;
      const c = v.root.position.clone().setY(v.height * 0.5).project(this.camera);
      const d = Math.hypot(c.x - ndc.x, (c.y - ndc.y) * 0.8);
      const r = 0.12 * Math.max(1, v.height / 1.8);
      if (d < r && d < bestD) {
        bestD = d;
        best = v.id;
      }
    }
    return best;
  }

  private wait(ms: number) {
    return sleep(ms / this.speed);
  }

  private async moveTo(v: UnitView, to: THREE.Vector3, ms: number) {
    const from = v.root.position.clone();
    const dir = to.clone().sub(from);
    if (dir.lengthSq() > 0.01) v.root.rotation.y = Math.atan2(dir.x, dir.z);
    v.hunter?.setLoop('run');
    const start = performance.now();
    const dur = ms / this.speed;
    await new Promise<void>((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - start) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        v.root.position.lerpVectors(from, to, e);
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      step();
    });
    v.hunter?.setLoop('idle');
  }

  private face(v: UnitView, at: THREE.Vector3) {
    const d = at.clone().sub(v.root.position);
    v.root.rotation.y = Math.atan2(d.x, d.z);
  }

  // -------------------------------------------------------------------------
  // playback
  // -------------------------------------------------------------------------

  async play(events: BattleEvent[], state: BattleState) {
    let i = 0;
    while (i < events.length) {
      const e = events[i];
      if (e.t === 'action') {
        let j = i + 1;
        while (j < events.length && !['action', 'round_end', 'end', 'phase', 'team_ultimate'].includes(events[j].t)) j++;
        // include immediate phase/death that belong to this beat is fine; phase handled separately
        await this.playAction(e, events.slice(i + 1, j), state);
        i = j;
        continue;
      }
      await this.misc(e, state);
      i++;
    }
    this.overview();
  }

  /** release held poses (defend) for living hunters after playback */
  releaseHolds(state: BattleState) {
    for (const u of state.units) {
      const v = this.units.get(u.id);
      if (!v?.hunter) continue;
      if (u.alive && u.onField && state.phase !== 'ended') v.hunter.release();
      if (u.alive) v.root.visible = u.onField;
    }
  }

  private async misc(e: BattleEvent, state: BattleState) {
    const H = this.hooks;
    switch (e.t) {
      case 'round':
        H.log(`— Round ${e.round} —`);
        break;
      case 'team_ultimate':
        H.flash();
        H.banner('TEAM ULTIMATE', '#ffc044', 'SCRAPSTORM');
        audio.sfx('ultimate');
        this.slowmo = 0.5;
        await this.wait(900);
        this.slowmo = 1;
        break;
      case 'phase': {
        const v = this.units.get(e.dst as string);
        if (v) this.heroShot(v);
        audio.sfx('boss');
        H.banner(String(e.name).toUpperCase(), '#ff3a6b', String(e.line));
        H.log(`⚠ ${H.name(e.dst as string)} enters phase: ${e.name}`);
        if (v) this.vfx.aura(v.root.position, '#ff3a6b');
        await this.wait(1600);
        this.overview();
        break;
      }
      case 'round_end':
        await this.wait(150);
        break;
      default:
        await this.apply(e, state);
    }
  }

  private animFor(e: BattleEvent, v: UnitView): string {
    const anim = String(e.anim ?? 'slash');
    if (e.skill === 'defend') return 'defend';
    if (e.skill === 'dodge') return 'dodge';
    if (e.skill === 'scan' || e.skill === 'item' || anim === 'cast') return 'cast';
    if (anim === 'buff') return 'buff';
    if (e.teamUlt) return 'ultimate';
    if (e.combo) return 'skill';
    const skill = String(e.skill ?? '');
    if (skill.startsWith('ult_')) return 'ultimate';
    if (skill === 'basic_attack') return 'attack';
    // weapon skill: ranged weapons use their attack anim, melee do a flourish
    return v.ranged ? 'attack' : 'skill';
  }

  private async playAction(e: BattleEvent, rest: BattleEvent[], state: BattleState) {
    const H = this.hooks;
    const src = this.units.get(e.src as string);
    const targets = ((e.targets as string[]) ?? []).map((id) => this.units.get(id)).filter(Boolean) as UnitView[];
    const element = (e.element as Element) ?? 'physical';
    const color = ELEMENT_COLOR[element];
    if (!src) {
      for (const r of rest) await this.apply(r, state);
      return;
    }
    const name = String(e.name);
    if (e.name !== 'Attack' && e.name !== 'Defend') H.log(`${H.name(src.id)} ▸ ${name}`);
    const isUlt = String(e.skill ?? '').startsWith('ult_') || !!e.teamUlt;
    const enemyTargets = targets.filter((t) => t.side !== src.side);
    const primary = enemyTargets[0] ?? targets[0];

    // ------------- hunters -------------
    if (src.hunter) {
      const m = src.hunter;
      const anim = this.animFor(e, src);
      if (isUlt && !e.teamUlt) {
        H.flash();
        H.banner(name.toUpperCase(), color, 'ULTIMATE');
        audio.sfx('ultimate');
        this.heroShot(src);
        this.vfx.aura(src.root.position, color);
        await this.wait(650);
      } else if (e.combo) {
        H.banner(name.toUpperCase(), '#ffc044', `${H.name(src.id)} × ${H.name(e.partner as string)}`);
      }
      const melee = !src.ranged && ['attack', 'skill', 'ultimate'].includes(anim) && enemyTargets.length > 0;
      const partner = e.partner ? this.units.get(e.partner as string) : undefined;
      if (melee && primary) {
        const aoe = enemyTargets.length > 1;
        const center = aoe ? enemyTargets.reduce((acc, t) => acc.add(t.root.position), new THREE.Vector3()).multiplyScalar(1 / enemyTargets.length) : primary.root.position.clone();
        const dir = src.root.position.clone().sub(center).setY(0).normalize();
        const to = center.clone().addScaledVector(dir, aoe ? 3.2 : 1.7 + (primary.robot ? primary.height * 0.25 : 0));
        if (!isUlt) this.focus(src.root.position, center);
        const moves = [this.moveTo(src, to, 280)];
        if (partner) moves.push(this.moveTo(partner, to.clone().add(new THREE.Vector3(1.6, 0, 0.6)), 300));
        await Promise.all(moves);
        this.face(src, center);
        if (partner) this.face(partner, center);
      } else if (primary && primary !== src) {
        this.face(src, primary.root.position);
        if (!isUlt) this.focus(src.root.position, primary.root.position, 0.9);
      }
      const info = m.play(anim, { hold: anim === 'defend' });
      if (partner?.hunter) partner.hunter.play('attack');
      this.anticipate(src, anim, color);
      if (anim === 'defend' || anim === 'dodge' || anim === 'buff' || anim === 'cast') {
        await this.wait(info.hit * 1000);
        this.selfFx(src, e, color);
        await this.runResults(rest, src, targets, element, state, info.hits.slice(1));
        await this.wait(Math.max(150, (info.duration - info.hit) * 600));
        if (anim !== 'defend') return;
        return;
      }
      await this.wait(info.hit * 1000);
      this.strikeFx(src, enemyTargets.length ? enemyTargets : targets, e, color, isUlt);
      await this.runResults(rest, src, targets, element, state, info.hits.slice(1));
      await this.wait(Math.max(120, (info.duration - info.hit) * 700));
      if (melee) {
        const back = [this.moveTo(src, src.home, 260)];
        if (partner) back.push(this.moveTo(partner, partner.home, 280));
        await Promise.all(back);
        src.root.rotation.y = src.facing;
        if (partner) partner.root.rotation.y = partner.facing;
      } else {
        src.root.rotation.y = src.facing;
      }
      return;
    }

    // ------------- machines -------------
    if (src.robot) {
      const r = src.robot;
      const anim = String(e.anim);
      const castLike = ['cast', 'buff', 'summon', 'charge', 'beam', 'swarm'].includes(anim) || enemyTargets.length !== 1;
      if (e.telegraph) H.banner(name, '#ff4f6b');
      if (anim === 'charge') {
        r.setCharging(true);
        this.heroShot(src);
        audio.sfx('boss');
        this.vfx.aura(src.root.position, '#ff3a6b');
        r.play('cast', 0.9);
        await this.wait(900);
        await this.runResults(rest, src, targets, element, state);
        this.overview();
        return;
      }
      if (primary) this.focus(src.root.position, primary.root.position, 0.9);
      if (castLike) {
        r.play('cast', 0.8);
        await this.wait(420);
      } else {
        const dist = primary.root.position.distanceTo(src.root.position);
        r.play('attack', 0.7, new THREE.Vector3(0, 0, Math.max(1, (dist - 2) / src.root.scale.x)));
        this.face(src, primary.root.position);
        await this.wait(380);
      }
      r.setCharging(false);
      this.strikeFx(src, enemyTargets.length ? enemyTargets : targets, e, color, false);
      await this.runResults(rest, src, targets, element, state);
      await this.wait(300);
      src.root.rotation.y = Math.atan2(-src.home.x * 0.3, 1);
    }
  }

  private anticipate(src: UnitView, anim: string, color: string) {
    if (anim === 'skill' || anim === 'ultimate') {
      const p = src.root.position.clone().setY(1);
      this.vfx.emit(p, color, 20, { speed: 2, up: 2, grav: -1, life: 0.8, spread: 1 });
    }
  }

  private selfFx(src: UnitView, e: BattleEvent, color: string) {
    const p = src.root.position.clone().setY(1);
    const vfx = String(e.vfx);
    if (vfx === 'shield') {
      this.vfx.orb(p, '#8fd8ff', 1.6, 0.6);
      audio.sfx('shield');
    } else if (vfx === 'heal' || vfx === 'revive') {
      for (const id of (e.targets as string[]) ?? []) {
        const t = this.units.get(id);
        if (t) this.vfx.aura(t.root.position, '#5fe08a');
      }
      audio.sfx('heal');
    } else if (vfx === 'dodge') {
      this.vfx.emit(p, '#c8ffef', 16, { speed: 3, life: 0.4 });
    } else if (vfx === 'scan') {
      for (const id of (e.targets as string[]) ?? []) {
        const t = this.units.get(id);
        if (t) {
          this.vfx.beam(src.root.position.clone().setY(1.4), t.root.position.clone().setY(t.height * 0.5), '#ffe66b', 0.05, 0.5);
          this.vfx.ring(t.root.position.clone().setY(t.height * 0.5), '#ffe66b', 2, 0.6, true);
        }
      }
      audio.sfx('quantum');
    } else if (vfx === 'emp' || vfx === 'explosion') {
      for (const id of (e.targets as string[]) ?? []) {
        const t = this.units.get(id);
        if (t && t.side !== src.side) this.vfx.explosion(t.root.position.clone().setY(1), vfx === 'emp' ? '#5fd8ff' : '#ff9a3a', 0.6);
      }
      audio.sfx(vfx === 'emp' ? 'electric' : 'explosion');
    } else {
      this.vfx.aura(src.root.position, color);
      audio.sfx('shield');
    }
  }

  private strikeFx(src: UnitView, targets: UnitView[], e: BattleEvent, color: string, big: boolean) {
    const vfx = String(e.vfx ?? 'hit');
    const from = src.hunter ? src.hunter.weaponPoint() : src.root.position.clone().setY(src.height * 0.6);
    const element = (e.element as Element) ?? 'physical';
    audio.sfx(src.ranged && src.hunter ? (vfx.includes('rail') ? 'rail' : 'shoot') : element === 'physical' ? 'slash' : element);
    for (const t of targets) {
      const at = t.root.position.clone().setY(t.height * 0.55);
      if (src.ranged || vfx.includes('beam') || vfx.includes('shot') || vfx.includes('rail') || vfx === 'electric' || vfx === 'fire' || vfx === 'ice_shard' || vfx === 'plasma_beam') {
        if (element === 'electric') this.vfx.lightning(from, at, color);
        this.vfx.beam(from, at, color, vfx.includes('rail') || big ? 0.3 : 0.12, 0.3);
      } else if (vfx === 'missiles' || vfx === 'debris') {
        this.vfx.emit(at.clone().add(new THREE.Vector3(0, 3, 0)), color, 10, { speed: 2, grav: 20, life: 0.5 });
      } else {
        const yaw = Math.atan2(at.x - src.root.position.x, at.z - src.root.position.z);
        this.vfx.slash(at, color, yaw, big ? 3 : 1.8);
      }
      if (big || vfx.startsWith('ult') || vfx === 'team_ult' || vfx === 'explosion' || vfx === 'quake') this.vfx.explosion(at, color, big ? 1.2 : 0.7);
      if (vfx === 'gravity_well' || vfx === 'ult_gravity' || vfx === 'quake') this.vfx.ring(t.root.position.clone().setY(0.1), '#8f6bff', 4, 0.7);
      if (vfx === 'ult_orbital') this.vfx.beam(at.clone().add(new THREE.Vector3(0, 30, 0)), at.clone().setY(0), color, 1.2, 0.6);
    }
  }

  /** apply result events of a beat, spreading multi-hits over the given extra hit times */
  private async runResults(rest: BattleEvent[], src: UnitView, _targets: UnitView[], _el: Element, state: BattleState, extraHits: number[] = []) {
    let srcHits = 0;
    let lastHitAt = 0;
    const start = performance.now();
    for (const r of rest) {
      if (r.t === 'dmg' && r.src === src.id && !r.reaction && !r.echo && extraHits.length) {
        srcHits++;
        if (srcHits > 1) {
          const when = extraHits[Math.min(srcHits - 2, extraHits.length - 1)] - extraHits[0] + 0.0;
          const elapsed = (performance.now() - start) / 1000;
          const target = Math.max(when, lastHitAt + 0.06);
          if (target > elapsed) await this.wait((target - elapsed) * 1000);
          lastHitAt = target;
          const tv = this.units.get(r.dst as string);
          if (tv) this.strikeFx(src, [tv], { t: 'x', vfx: 'hit', element: r.element }, ELEMENT_COLOR[(r.element as Element) ?? 'physical'], false);
        }
      }
      await this.apply(r, state);
    }
  }

  async apply(e: BattleEvent, state: BattleState) {
    const H = this.hooks;
    switch (e.t) {
      case 'dmg': {
        const v = this.units.get(e.dst as string);
        H.unit(e.dst as string, { hp: e.hp as number, maxHp: e.maxHp as number, armor: e.armor as number, maxArmor: e.maxArmor as number });
        if (!v) return;
        const amt = e.amount as number;
        const cls = e.dot ? 'resist' : e.reaction ? 'react' : e.crit ? 'crit' : e.weak ? 'weak' : e.resist ? 'resist' : '';
        const sub = e.dot ? String(e.dot).toUpperCase() : e.reaction ? String(e.reaction) : e.crit ? 'CRIT' : e.weak ? 'WEAK' : e.resist ? 'RESIST' : (e.chain as number) > 1 ? `CHAIN ×${e.chain}` : e.follow ? 'FOLLOW-UP' : e.echo ? 'ECHO' : undefined;
        H.float(v.id, String(amt), cls, sub);
        if ((e.absorbed as number) > 0) H.float(v.id, `⬡${e.absorbed}`, 'resist');
        const el = (e.element as Element) ?? 'physical';
        if (!e.dot) {
          this.vfx.impact(v.root.position.clone().setY(v.height * 0.55), el, e.crit ? 1.4 : 1);
          if (e.crit) {
            this.vfx.shake = Math.max(this.vfx.shake, 0.25);
            audio.sfx('crit');
          } else audio.sfx('hit');
          if (v.hunter && (e.hp as number) > 0) v.hunter.play('hit');
          if (v.robot && (e.hp as number) > 0) v.robot.play('hit', 0.4);
        }
        if ((e.chain as number) >= 3 && (e.chain as number) % 1 === 0) H.log(`Chain ×${e.chain}!`);
        await this.wait(e.dot ? 220 : 110);
        break;
      }
      case 'heal':
      case 'revive':
      case 'energy': {
        H.unit(e.dst as string, { hp: e.hp as number, maxHp: e.maxHp as number, energy: e.energy as number, ult: e.ult as number, alive: e.alive as boolean });
        const v = this.units.get(e.dst as string);
        if (e.t === 'heal' && v && (e.amount as number) > 0) {
          H.float(v.id, `+${e.amount}`, 'heal');
          this.vfx.emit(v.root.position.clone().setY(1), '#5fe08a', 10, { speed: 1, up: 2, grav: -1 });
        }
        if (e.t === 'revive' && v) {
          v.root.visible = true;
          v.hunter?.release();
          this.vfx.aura(v.root.position, '#5fe08a');
          H.float(v.id, 'REVIVED', 'heal');
          audio.sfx('heal');
          await this.wait(500);
        }
        break;
      }
      case 'armor':
        H.unit(e.dst as string, { armor: e.armor as number, maxArmor: e.maxArmor as number });
        break;
      case 'status':
        H.status(e.dst as string, e.status as string, e.on as boolean, e.stacks as number | undefined);
        if (e.on && e.status === 'frozen') {
          const v = this.units.get(e.dst as string);
          if (v) this.vfx.orb(v.root.position.clone().setY(v.height * 0.5), '#d4f8ff', 1.4, 0.6);
        }
        break;
      case 'reaction': {
        const v = this.units.get(e.dst as string);
        audio.sfx('reaction');
        H.banner(String(e.name).toUpperCase() + '!', '#ff4fd8', 'ELEMENTAL REACTION');
        H.log(`✦ Reaction: ${e.name}`);
        if (v) this.vfx.explosion(v.root.position.clone().setY(v.height * 0.55), '#ff4fd8', 0.7);
        await this.wait(260);
        break;
      }
      case 'break': {
        const v = this.units.get(e.dst as string);
        audio.sfx('break');
        H.banner('ARMOR BREAK!', '#ffd84a', 'Stunned · +25% damage · Team Finisher ready');
        H.log(`✖ ${H.name(e.dst as string)} — ARMOR BREAK`);
        if (v) {
          this.vfx.ring(v.root.position.clone().setY(v.height * 0.55), '#ffd84a', 3.5, 0.6, true);
          this.vfx.emit(v.root.position.clone().setY(v.height * 0.55), '#ffd84a', 30, { speed: 7 });
          this.vfx.shake = 0.4;
        }
        await this.wait(380);
        break;
      }
      case 'interrupt':
        H.banner('INTERRUPTED!', '#5fe08a', 'Charged attack cancelled');
        this.units.get(e.dst as string)?.robot?.setCharging(false);
        await this.wait(300);
        break;
      case 'death': {
        const v = this.units.get(e.dst as string);
        H.unit(e.dst as string, { hp: 0, alive: false });
        if (v?.robot) {
          v.robot.play('dead', 0.8);
          this.vfx.explosion(v.root.position.clone().setY(v.height * 0.5), v.robot.color, 0.8);
          audio.sfx('explosion');
          setTimeout(() => (v.root.visible = false), 900 / this.speed);
        } else if (v?.hunter) {
          v.hunter.play('defeat', { hold: true });
          audio.sfx('death');
        }
        H.log(`☠ ${H.name(e.dst as string)} is down`);
        await this.wait(350);
        break;
      }
      case 'dodge': {
        const v = this.units.get(e.dst as string);
        if (v) {
          H.float(v.id, 'DODGE', 'heal');
          v.hunter?.play('dodge');
        }
        await this.wait(200);
        break;
      }
      case 'immune': {
        const v = this.units.get(e.dst as string);
        if (v) H.float(v.id, 'IMMUNE', 'resist');
        await this.wait(150);
        break;
      }
      case 'phase_shift': {
        const v = this.units.get(e.dst as string);
        if (v) {
          H.float(v.id, 'PHASED', 'heal');
          this.vfx.ring(v.root.position.clone().setY(1), '#5cffb0', 2, 0.5, true);
        }
        break;
      }
      case 'summon': {
        const u = e.unit as Unit;
        this.addUnit(u, state);
        H.added(u);
        const st = { ...state, units: [...state.units.filter((x) => x.id !== u.id), u] };
        this.layout(st as BattleState);
        const v = this.units.get(u.id);
        if (v) this.vfx.aura(v.root.position, v.robot?.color ?? '#ff4f6b');
        H.log(`+ ${u.name} deployed`);
        await this.wait(350);
        break;
      }
      case 'switch': {
        const out = this.units.get(e.src as string);
        const inU = state.units.find((x) => x.id === e.dst);
        if (inU && !this.units.has(inU.id)) this.addUnit({ ...inU, onField: true }, state);
        const iv = this.units.get(e.dst as string);
        if (out) out.root.visible = false;
        if (iv) {
          iv.root.visible = true;
          if (out) {
            iv.home.copy(out.home);
            iv.root.position.copy(out.home);
          }
          iv.root.rotation.y = Math.PI;
          this.vfx.aura(iv.root.position, '#4fd8ff');
        }
        H.swapped(e.src as string, e.dst as string);
        H.log(`⇄ ${H.name(e.dst as string)} switches in`);
        await this.wait(450);
        break;
      }
      case 'team':
        H.team(e.value as number);
        break;
      case 'scan':
        H.log(`◎ Scan: ${H.name(e.dst as string)} — weak to ${(e.profile as { weak: string[] }).weak.join(', ') || 'nothing'}`);
        break;
      case 'skip': {
        const v = this.units.get(e.src as string);
        if (v) H.float(v.id, String(e.reason).toUpperCase(), 'resist', 'SKIP');
        await this.wait(250);
        break;
      }
      case 'info':
        H.log(String(e.text));
        if (e.src) H.float(e.src as string, String(e.text).split('—')[0].slice(0, 22), 'resist');
        await this.wait(250);
        break;
      case 'charging':
        H.log(`☢ ${H.name(e.src as string)} is charging ${e.name}!`);
        this.units.get(e.src as string)?.robot?.setCharging(true);
        break;
      case 'countdown':
        H.banner(e.reset ? 'COUNTDOWN RESET' : `OMEGA: ${e.value}`, '#ff3a6b');
        await this.wait(300);
        break;
      case 'barrier_down':
        H.banner('DATA SHIELD DOWN', '#4fd8ff', 'The Server Golem is exposed!');
        await this.wait(400);
        break;
      case 'adapt':
        H.log(`↻ ${H.name(e.dst as string)} rewrote its weaknesses — scan again!`);
        H.float(e.dst as string, 'ADAPTED', 'react');
        break;
      case 'intents':
        H.intents(e.intents as Record<string, unknown>);
        break;
      case 'ultimate':
        break;
      case 'end': {
        const win = e.result === 'victory';
        for (const v of this.units.values()) {
          if (v.hunter && v.root.visible && win) v.hunter.play('victory', { hold: true });
        }
        if (win) {
          const allies = [...this.units.values()].filter((v) => v.side === 'ally' && v.root.visible);
          if (allies[0]) this.heroShot(allies[Math.floor(allies.length / 2)]);
        }
        await this.wait(400);
        break;
      }
    }
  }

  dispose() {
    for (const v of this.units.values()) v.hunter?.dispose();
    this.vfx.clear();
    disposeTree(this.scene);
  }
}
