/**
 * Third-person character controller + orbit camera. Collision against rectangle
 * walkable areas and rectangle blockers (enough for city blocks and dungeon rooms).
 */
import * as THREE from 'three';
import type { Input } from '../input/input';
import type { CharacterModel } from '../render/character';

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export class Collision {
  walk: Rect[] = [];
  block: Rect[] = [];
  radius = 0.45;

  ok(x: number, z: number): boolean {
    const r = this.radius;
    const inWalk = this.walk.length === 0 || this.walk.some((w) => x >= w.x0 + r && x <= w.x1 - r && z >= w.z0 + r && z <= w.z1 - r) || this.inWalkUnion(x, z);
    if (!inWalk) return false;
    return !this.block.some((b) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
  }

  /** allow standing where two walkable rects overlap/touch (doorways) */
  private inWalkUnion(x: number, z: number): boolean {
    const r = this.radius;
    // check the four probe points each lie in some rect
    const probes = [[x - r, z], [x + r, z], [x, z - r], [x, z + r]];
    return probes.every(([px, pz]) => this.walk.some((w) => px >= w.x0 && px <= w.x1 && pz >= w.z0 && pz <= w.z1));
  }
}

export class PlayerController {
  yaw = Math.PI; // camera yaw
  pitch = 0.42;
  dist = 7.5;
  minDist = 3.5;
  maxDist = 14;
  speed = 4.6;
  runSpeed = 8.2;
  facing = 0;
  readonly pos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private vel = new THREE.Vector3();
  moving = 0; // 0 idle 1 walk 2 run
  sensitivity = 1;
  private stepT = 0;
  onStep?: () => void;

  constructor(readonly model: CharacterModel, readonly camera: THREE.PerspectiveCamera, readonly input: Input, public collision: Collision) {}

  place(x: number, z: number, facing = 0) {
    this.pos.set(x, 0, z);
    this.facing = facing;
    this.yaw = facing + Math.PI;
    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = facing;
    this.camTarget.copy(this.pos);
    this.updateCamera(1, true);
  }

  update(dt: number, allowMove = true) {
    const inp = this.input;
    inp.poll();
    const cam = inp.consumeCam();
    this.yaw -= cam.x * 0.0055 * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + cam.y * 0.004 * this.sensitivity, 0.08, 1.15);
    this.dist = THREE.MathUtils.clamp(this.dist + cam.zoom, this.minDist, this.maxDist);
    if (inp.keys.has('KeyZ')) this.yaw += dt * 2.2;
    if (inp.keys.has('KeyC')) this.yaw -= dt * 2.2;

    const mv = allowMove ? inp.move : { x: 0, y: 0 };
    const mag = Math.hypot(mv.x, mv.y);
    if (mag > 0.05) {
      // camera-relative movement: forward is away from camera
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = -fz, rz = fx;
      const dx = fx * mv.y + rx * mv.x;
      const dz = fz * mv.y + rz * mv.x;
      const len = Math.hypot(dx, dz) || 1;
      const sp = (inp.run ? this.runSpeed : this.speed) * Math.min(1, mag * 1.2);
      this.vel.set((dx / len) * sp, 0, (dz / len) * sp);
      const target = Math.atan2(dx, dz);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 12);
      this.moving = inp.run && mag > 0.5 ? 2 : 1;
    } else {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 12));
      if (this.vel.lengthSq() < 0.05) this.vel.set(0, 0, 0);
      this.moving = 0;
    }
    // integrate with axis-separated collision sliding
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    if (this.collision.ok(nx, nz)) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else if (this.collision.ok(nx, this.pos.z)) this.pos.x = nx;
    else if (this.collision.ok(this.pos.x, nz)) this.pos.z = nz;

    this.model.root.position.copy(this.pos);
    this.model.root.rotation.y = this.facing;
    this.model.setLoop(this.moving === 2 ? 'run' : this.moving === 1 ? 'walk' : 'idle');
    if (this.moving) {
      this.stepT -= dt * (this.moving === 2 ? 1.8 : 1);
      if (this.stepT <= 0) {
        this.stepT = 0.42;
        this.onStep?.();
      }
    }
    this.updateCamera(dt);
  }

  updateCamera(dt: number, snap = false) {
    this.camTarget.lerp(this.pos, snap ? 1 : Math.min(1, dt * 8));
    const t = this.camTarget;
    const cx = t.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cz = t.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cy = 1.4 + Math.sin(this.pitch) * this.dist;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(t.x, 1.3, t.z);
  }
}
