import * as THREE from 'three';
import { Collision } from './controller';
import { skyTexture } from '../render/textures';

export interface Interactable {
  id: string;
  pos: THREE.Vector3;
  radius: number;
  label: string;
  icon: string;
  action: () => void;
  enabled?: () => boolean;
}

export interface WorldScene {
  name: string;
  scene: THREE.Scene;
  collision: Collision;
  interactables: Interactable[];
  spawn: { x: number; z: number; facing: number };
  update(dt: number, player: THREE.Vector3, camera: THREE.Camera): void;
  drawMinimap(g: CanvasRenderingContext2D, w: number, h: number, player: THREE.Vector3, yaw: number): void;
  dispose(): void;
  music: 'city' | 'dungeon';
}

export function makeSky(scene: THREE.Scene, top: string, bottom: string, stars = 400) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.MeshBasicMaterial({ map: skyTexture(top, bottom), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);
  if (stars > 0) {
    const pos = new Float32Array(stars * 3);
    for (let i = 0; i < stars; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.45;
      pos[i * 3] = Math.cos(th) * Math.sin(ph) * 280;
      pos[i * 3 + 1] = Math.cos(ph) * 280;
      pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * 280;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#cfe4ff', size: 1.4, sizeAttenuation: false, fog: false }));
    scene.add(p);
  }
  return sky;
}

export function makeSun(scene: THREE.Scene, color: string, intensity: number, shadowSize: number, shadows: boolean, area = 40) {
  const sun = new THREE.DirectionalLight(color, intensity);
  sun.position.set(30, 50, 20);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const c = sun.shadow.camera;
  c.left = -area;
  c.right = area;
  c.top = area;
  c.bottom = -area;
  c.near = 1;
  c.far = 150;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  return sun;
}

/** keep the shadow camera centred on the player for crisp shadows on a small map */
export function followSun(sun: THREE.DirectionalLight, p: THREE.Vector3) {
  sun.position.set(p.x + 30, 50, p.z + 20);
  sun.target.position.set(p.x, 0, p.z);
}
