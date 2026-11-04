import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type Quality = 'low' | 'medium' | 'high';

export interface QualityProfile {
  pixelRatio: number;
  shadows: boolean;
  shadowSize: number;
  bloom: boolean;
  particles: number; // max particle budget
  lodBias: number; // multiplies LOD distances
  drawDistance: number;
}

export function isMobile(): boolean {
  return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

export function defaultQuality(): Quality {
  return isMobile() ? 'low' : 'medium';
}

export function profileFor(q: Quality): QualityProfile {
  const dpr = window.devicePixelRatio || 1;
  switch (q) {
    case 'low':
      return { pixelRatio: Math.min(dpr, isMobile() ? 1 : 1.25), shadows: false, shadowSize: 512, bloom: false, particles: 600, lodBias: 0.6, drawDistance: 70 };
    case 'medium':
      return { pixelRatio: Math.min(dpr, 1.5), shadows: true, shadowSize: 1024, bloom: false, particles: 1400, lodBias: 1, drawDistance: 110 };
    case 'high':
      return { pixelRatio: Math.min(dpr, 2), shadows: true, shadowSize: 2048, bloom: true, particles: 2600, lodBias: 1.5, drawDistance: 160 };
  }
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  composer: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  quality: Quality;
  profile: QualityProfile;
  scene: THREE.Scene | null = null;
  camera: THREE.PerspectiveCamera;
  private renderPass: RenderPass | null = null;
  // FPS monitor
  fps = 60;
  frameMs = 16;
  private acc = 0;
  private frames = 0;
  private slowFrames = 0;
  onAutoDowngrade?: (q: Quality) => void;

  constructor(readonly canvas: HTMLCanvasElement, quality: Quality) {
    const gl = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', stencil: false });
    if (!gl.capabilities.isWebGL2) console.warn('WebGL2 not available — falling back');
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl = gl;
    this.quality = quality;
    this.profile = profileFor(quality);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    this.apply();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.profile = profileFor(q);
    this.apply();
  }

  private apply() {
    const p = this.profile;
    this.gl.setPixelRatio(p.pixelRatio);
    this.gl.shadowMap.enabled = p.shadows;
    this.gl.shadowMap.needsUpdate = true;
    if (p.bloom) {
      if (!this.composer) {
        this.composer = new EffectComposer(this.gl);
        this.renderPass = new RenderPass(new THREE.Scene(), this.camera);
        this.composer.addPass(this.renderPass);
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
      }
    } else if (this.composer) {
      this.composer.dispose();
      this.composer = null;
      this.bloom = null;
      this.renderPass = null;
    }
    this.resize();
    // update shadow map sizes on existing lights
    this.scene?.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isDirectionalLight && l.castShadow) {
        l.shadow.mapSize.set(p.shadowSize, p.shadowSize);
        l.shadow.map?.dispose();
        l.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
    });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.visualViewport?.height ?? window.innerHeight;
    this.gl.setSize(w, h, false);
    this.canvas.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 68 : 55;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.profile.pixelRatio);
      this.composer.setSize(w, h);
    }
  }

  render(dt: number) {
    if (!this.scene) return;
    if (this.composer && this.renderPass) {
      this.renderPass.scene = this.scene;
      this.renderPass.camera = this.camera;
      this.composer.render(dt);
    } else this.gl.render(this.scene, this.camera);
    this.track(dt);
  }

  private track(dt: number) {
    this.acc += dt;
    this.frames++;
    if (this.acc >= 1) {
      this.fps = Math.round(this.frames / this.acc);
      this.frameMs = (this.acc / this.frames) * 1000;
      this.acc = 0;
      this.frames = 0;
      // auto downgrade when consistently slow
      if (this.fps < 24) this.slowFrames++;
      else this.slowFrames = 0;
      if (this.slowFrames >= 5 && this.quality !== 'low') {
        this.slowFrames = 0;
        const q = this.quality === 'high' ? 'medium' : 'low';
        this.setQuality(q);
        this.onAutoDowngrade?.(q);
      }
    }
  }

  stats(): string {
    const i = this.gl.info;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return `${this.fps} FPS  ${this.frameMs.toFixed(1)}ms  ${this.quality.toUpperCase()}\ncalls ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(1)}k\ngeo ${i.memory.geometries}  tex ${i.memory.textures}${mem ? `  heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)}MB` : ''}`;
  }
}

/** dispose everything under an object (geometries, materials, textures) except shared resources */
export function disposeTree(root: THREE.Object3D, keep: Set<unknown> = new Set()) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !keep.has(m.geometry) && !(m.geometry.userData as { shared?: boolean }).shared) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (keep.has(mat) || (mat.userData as { shared?: boolean }).shared) continue;
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !(v.userData as { shared?: boolean }).shared) v.dispose();
      mat.dispose();
    }
  });
}
