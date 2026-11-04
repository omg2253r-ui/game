/**
 * Pooled VFX: one GPU particle buffer (ring-allocated) plus pools of reusable meshes for
 * slashes, shockwaves, beams, orbs and lightning bolts. Nothing is allocated per hit.
 */
import * as THREE from 'three';
import type { Element } from '../../core/types';
import { radialTexture } from './textures';

export const ELEMENT_COLOR: Record<Element, string> = {
  physical: '#e8ecf5',
  electric: '#5fd8ff',
  fire: '#ff7a2f',
  ice: '#a8f0ff',
  plasma: '#ff4fd8',
  gravity: '#8f6bff',
  quantum: '#5cffb0',
};

interface Particle {
  life: number;
  max: number;
  vx: number;
  vy: number;
  vz: number;
  drag: number;
  grav: number;
  size: number;
}

const vert = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying float vA; varying vec3 vC;
void main(){ vA=aAlpha; vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }`;
const frag = `
uniform sampler2D map; varying float vA; varying vec3 vC;
void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC*1.6,t.a*vA); if(gl_FragColor.a<0.01) discard; }`;

interface MeshFx {
  obj: THREE.Mesh | THREE.Line;
  life: number;
  max: number;
  kind: string;
  base: number; // base scale
  grow: number;
  active: boolean;
  spin: number;
}

export class Vfx {
  readonly group = new THREE.Group();
  private points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private parts: Particle[] = [];
  private cursor = 0;
  private cap: number;
  private pools: Record<string, MeshFx[]> = {};
  private tmpC = new THREE.Color();
  shake = 0;

  constructor(capacity = 1500) {
    this.cap = capacity;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500);
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: radialTexture() } }, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    for (let i = 0; i < capacity; i++) this.parts.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, drag: 0, grav: 0, size: 0 });
    this.group.add(this.points);
  }

  setCapacityHint(n: number) {
    this.cap = Math.min(this.parts.length, Math.max(200, n));
  }

  emit(at: THREE.Vector3, color: string, count: number, opts: { speed?: number; up?: number; life?: number; size?: number; spread?: number; grav?: number; drag?: number; dir?: THREE.Vector3 } = {}) {
    const c = this.tmpC.set(color);
    const sp = opts.speed ?? 4;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.cap;
      const p = this.parts[i];
      const s = opts.spread ?? 0.2;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * s;
      this.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * s;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * s;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const v = sp * (0.4 + Math.random() * 0.6);
      p.vx = Math.sin(ph) * Math.cos(th) * v + (opts.dir?.x ?? 0);
      p.vy = Math.abs(Math.cos(ph)) * v * 0.6 + (opts.up ?? 1) + (opts.dir?.y ?? 0);
      p.vz = Math.sin(ph) * Math.sin(th) * v + (opts.dir?.z ?? 0);
      p.max = p.life = (opts.life ?? 0.7) * (0.6 + Math.random() * 0.6);
      p.drag = opts.drag ?? 2.5;
      p.grav = opts.grav ?? 6;
      p.size = (opts.size ?? 0.35) * (0.6 + Math.random() * 0.8);
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
    }
  }

  private take(kind: string, make: () => THREE.Mesh | THREE.Line): MeshFx {
    const pool = (this.pools[kind] ??= []);
    let fx = pool.find((f) => !f.active);
    if (!fx) {
      const obj = make();
      obj.frustumCulled = false;
      this.group.add(obj);
      fx = { obj, life: 0, max: 1, kind, base: 1, grow: 0, active: false, spin: 0 };
      pool.push(fx);
    }
    fx.active = true;
    fx.obj.visible = true;
    return fx;
  }

  private addMat(color: string, opacity = 1) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  }

  slash(at: THREE.Vector3, color: string, yaw: number, size = 1.6, tilt = 0.3) {
    const fx = this.take('slash', () => new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32, 1, 0, Math.PI * 0.9), this.addMat('#fff')));
    const m = fx.obj as THREE.Mesh;
    (m.material as THREE.MeshBasicMaterial).color.set(color);
    m.position.copy(at);
    m.rotation.set(Math.PI / 2 + tilt, 0, yaw);
    fx.base = size;
    fx.grow = 0.5;
    fx.life = fx.max = 0.32;
    fx.spin = 7;
  }

  ring(at: THREE.Vector3, color: string, size = 2.5, life = 0.6, vertical = false) {
    const fx = this.take('ring', () => new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), this.addMat('#fff')));
    const m = fx.obj as THREE.Mesh;
    (m.material as THREE.MeshBasicMaterial).color.set(color);
    m.position.copy(at);
    m.rotation.set(vertical ? 0 : -Math.PI / 2, 0, 0);
    fx.base = 0.2;
    fx.grow = size;
    fx.life = fx.max = life;
    fx.spin = 0;
  }

  orb(at: THREE.Vector3, color: string, size = 1, life = 0.5) {
    const fx = this.take('orb', () => new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.addMat('#fff')));
    const m = fx.obj as THREE.Mesh;
    (m.material as THREE.MeshBasicMaterial).color.set(color);
    m.position.copy(at);
    fx.base = size * 0.3;
    fx.grow = size;
    fx.life = fx.max = life;
    fx.spin = 0;
  }

  beam(from: THREE.Vector3, to: THREE.Vector3, color: string, width = 0.15, life = 0.35) {
    const fx = this.take('beam', () => {
      const g = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, 0.5);
      return new THREE.Mesh(g, this.addMat('#fff'));
    });
    const m = fx.obj as THREE.Mesh;
    (m.material as THREE.MeshBasicMaterial).color.set(color);
    m.position.copy(from);
    m.lookAt(to);
    const len = from.distanceTo(to);
    m.scale.set(width, width, len);
    fx.base = width;
    fx.grow = -width;
    fx.life = fx.max = life;
    fx.spin = 0;
    (m.userData as { len: number }).len = len;
  }

  lightning(from: THREE.Vector3, to: THREE.Vector3, color = '#9fe8ff', life = 0.25) {
    const fx = this.take('bolt', () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#fff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    });
    const l = fx.obj as THREE.Line;
    (l.material as THREE.LineBasicMaterial).color.set(color);
    const arr = (l.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < 16; i++) {
      const k = i / 15;
      const j = i === 0 || i === 15 ? 0 : 0.35;
      arr[i * 3] = from.x + (to.x - from.x) * k + (Math.random() - 0.5) * j;
      arr[i * 3 + 1] = from.y + (to.y - from.y) * k + (Math.random() - 0.5) * j;
      arr[i * 3 + 2] = from.z + (to.z - from.z) * k + (Math.random() - 0.5) * j;
    }
    l.geometry.getAttribute('position').needsUpdate = true;
    l.position.set(0, 0, 0);
    l.scale.set(1, 1, 1);
    fx.life = fx.max = life;
    fx.base = 1;
    fx.grow = 0;
    fx.spin = 0;
  }

  /** composite effects keyed by element/vfx id */
  impact(at: THREE.Vector3, element: Element, strength = 1) {
    const c = ELEMENT_COLOR[element];
    this.emit(at, c, Math.round(14 * strength), { speed: 4 * strength, life: 0.5 });
    this.orb(at, c, 0.6 * strength, 0.25);
    if (element === 'electric') {
      for (let i = 0; i < 2; i++) this.lightning(at.clone().add(new THREE.Vector3(0, 2.5, 0)), at, c);
    } else if (element === 'fire') {
      this.emit(at, '#ffd84a', Math.round(10 * strength), { speed: 2, up: 3, grav: -1, life: 0.8, size: 0.5 });
    } else if (element === 'ice') {
      this.emit(at, '#ffffff', Math.round(10 * strength), { speed: 3, grav: 8, life: 0.7, size: 0.25 });
    } else if (element === 'gravity') {
      this.ring(at, c, 2.2 * strength, 0.5, true);
    } else if (element === 'quantum') {
      this.ring(at, c, 1.6 * strength, 0.4, true);
      this.emit(at, '#ffffff', 8, { speed: 6, grav: 0, drag: 6, life: 0.4, size: 0.2 });
    } else if (element === 'plasma') {
      this.ring(at, c, 1.4 * strength, 0.35, true);
    }
  }

  explosion(at: THREE.Vector3, color = '#ff9a3a', size = 1) {
    this.orb(at, color, 2.4 * size, 0.55);
    this.orb(at, '#fff6d0', 1.2 * size, 0.3);
    this.ring(at.clone().setY(0.05), color, 4 * size, 0.6);
    this.emit(at, color, Math.round(40 * size), { speed: 8 * size, life: 0.9, size: 0.55 });
    this.emit(at, '#555', Math.round(16 * size), { speed: 3, up: 2, grav: -0.5, life: 1.4, size: 0.9 });
    this.shake = Math.max(this.shake, 0.35 * size);
  }

  aura(at: THREE.Vector3, color: string) {
    this.ring(at.clone().setY(0.05), color, 1.8, 0.8);
    this.emit(at.clone().setY(0.2), color, 18, { speed: 0.6, up: 3.5, grav: -0.5, life: 1, spread: 1.2, size: 0.3 });
  }

  update(dt: number) {
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.life <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      p.life -= dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vz *= d;
      p.vy = p.vy * d - p.grav * dt;
      this.pos[i * 3] += p.vx * dt;
      this.pos[i * 3 + 1] += p.vy * dt;
      this.pos[i * 3 + 2] += p.vz * dt;
      const k = Math.max(0, p.life / p.max);
      this.alpha[i] = k;
      this.size[i] = p.size * (0.5 + k * 0.5);
    }
    const g = this.points.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('aAlpha').needsUpdate = true;
    g.getAttribute('aSize').needsUpdate = true;
    g.getAttribute('aColor').needsUpdate = true;

    for (const pool of Object.values(this.pools)) {
      for (const fx of pool) {
        if (!fx.active) continue;
        fx.life -= dt;
        const k = 1 - Math.max(0, fx.life / fx.max);
        const mat = (fx.obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1 - k) * (fx.kind === 'orb' ? 0.8 : 1);
        if (fx.kind === 'beam') {
          const w = Math.max(0.001, fx.base * (1 - k));
          fx.obj.scale.set(w, w, (fx.obj.userData as { len: number }).len);
        } else if (fx.kind !== 'bolt') {
          const s = fx.base + fx.grow * k;
          fx.obj.scale.setScalar(Math.max(0.001, s));
        }
        if (fx.spin) fx.obj.rotation.z += fx.spin * dt;
        if (fx.life <= 0) {
          fx.active = false;
          fx.obj.visible = false;
        }
      }
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
  }

  clear() {
    for (const p of this.parts) p.life = 0;
    for (const pool of Object.values(this.pools)) for (const fx of pool) {
      fx.active = false;
      fx.obj.visible = false;
    }
  }
}
