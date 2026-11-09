import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { useT } from '../../i18n';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { usePrefs, type Lighting as LightingName } from '../../stores/prefs';
import { IconButton, cx } from '../ui';
import { Lighting } from './Lighting';
import { Measure } from './Measure';
import { hasWebGL, useViewerColors } from './theme';
import { Turntable } from './Turntable';

export interface ViewerHandle {
  rotate: (azimuthDeg: number, polarDeg?: number) => void;
  zoom: (factor: number) => void;
  reset: () => void;
}

export interface ViewerProps {
  /** GLB to show. Null shows the empty turntable (or the clay lump while generating). */
  url: string | null;
  /** 0..1 while a job runs: shows a clay lump that grows with progress. */
  progress?: number | null;
  wireframe?: boolean;
  clay?: boolean;
  measure?: boolean;
  lighting?: LightingName;
  /** Called once per url, a few frames after the model is drawn. */
  onCapture?: (blob: Blob) => void;
  onLoadError?: () => void;
  /** Overlay content (status, empty state) rendered above the canvas. */
  children?: ReactNode;
  toolbar?: 'full' | 'minimal' | 'none';
  className?: string;
  label?: string;
  handleRef?: Ref<ViewerHandle>;
}

/** The subset of drei's OrbitControls we drive directly. */
interface Controls {
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  update(): void;
}

const CLAY = new THREE.MeshStandardMaterial({ color: '#b6afa4', roughness: 0.82, metalness: 0 });

export default function Viewer({
  url,
  progress = null,
  wireframe = false,
  clay = false,
  measure = false,
  lighting,
  onCapture,
  onLoadError,
  children,
  toolbar = 'full',
  className,
  label,
  handleRef,
}: ViewerProps) {
  const t = useT();
  const reduced = useReducedMotion();
  const prefs = usePrefs();
  const colors = useViewerColors();
  // Bounds are keyed by url and derived during render. Resetting them in an
  // effect would run after the new model's layout effect and wipe its box.
  const [measured, setMeasured] = useState<{ url: string; box: THREE.Box3 } | null>(null);
  const box = url && measured?.url === url ? measured.box : null;
  const onBox = useCallback((b: THREE.Box3) => url && setMeasured({ url, box: b }), [url]);
  const [webgl] = useState(hasWebGL);
  const api = useRef<ViewerHandle | null>(null);
  useImperativeHandle(handleRef, () => ({
    rotate: (a, p) => api.current?.rotate(a, p),
    zoom: (f) => api.current?.zoom(f),
    reset: () => api.current?.reset(),
  }));

  const spinning = prefs.autoRotate && !reduced;
  const working = progress !== null && progress < 1;
  const radius = box
    ? Math.max(0.35, Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) * 0.62)
    : 0.6;

  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => api.current?.rotate(-15),
      ArrowRight: () => api.current?.rotate(15),
      ArrowUp: () => api.current?.rotate(0, -10),
      ArrowDown: () => api.current?.rotate(0, 10),
      '+': () => api.current?.zoom(0.85),
      '=': () => api.current?.zoom(0.85),
      '-': () => api.current?.zoom(1.18),
      '0': () => api.current?.reset(),
      Home: () => api.current?.reset(),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className={cx('relative isolate h-full w-full overflow-hidden bg-viewer', className)}>
      {webgl ? (
        // A custom keyboard widget (arrows rotate, +/− zoom, 0 resets), so it is
        // focusable and handles keys; every action also has a labelled button.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="application"
          aria-roledescription={t('viewer.roleDescription')}
          aria-label={label ?? t('viewer.label')}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          onKeyDown={onKey}
          className="absolute inset-0 focus-visible:outline-offset-[-4px]"
        >
          <Canvas
            dpr={[1, 2]}
            frameloop={spinning || working ? 'always' : 'demand'}
            camera={{ position: [1.6, 1.1, 2.1], fov: 35, near: 0.01, far: 500 }}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
          >
            <Lighting preset={lighting ?? prefs.lighting} />
            <Turntable radius={radius} ink={colors.ink} accent={colors.accent} />
            {url && (
              <CanvasBoundary key={url} onError={onLoadError}>
                <Suspense fallback={null}>
                  <Model
                    url={url}
                    wireframe={wireframe}
                    clay={clay}
                    lineColor={colors.ink}
                    onBox={onBox}
                  />
                  {box && (
                    <ContactShadows
                      key={`${url}-shadow`}
                      position={[0, 0.001, 0]}
                      opacity={0.45}
                      scale={radius * 3}
                      blur={2.2}
                      far={Math.max(0.5, box.max.y)}
                      resolution={512}
                      frames={1}
                    />
                  )}
                </Suspense>
              </CanvasBoundary>
            )}
            {!url && working && <ClayLump progress={progress} still={reduced} />}
            {box && measure && <Measure box={box} color={colors.accentInk} />}
            <OrbitControls
              makeDefault
              enableDamping={!reduced}
              autoRotate={spinning}
              autoRotateSpeed={0.7}
              minPolarAngle={0.05}
              maxPolarAngle={Math.PI / 2 - 0.02}
            />
            <Controller apiRef={api} box={box} url={url} onCapture={onCapture} />
          </Canvas>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-small text-muted">
          <p className="max-w-[40ch]">{t('viewer.noWebgl')}</p>
        </div>
      )}

      {children}

      {webgl && toolbar !== 'none' && (
        <div
          className="absolute inset-x-1 bottom-1 flex flex-wrap items-center justify-between gap-1 z-(--z-viewer-ui)"
          role="toolbar"
          aria-label={t('viewer.toolbar')}
        >
          <div className="flex gap-0.5">
            <IconButton
              variant="overlay"
              icon="rotateLeft"
              label={t('viewer.rotateLeft')}
              onClick={() => api.current?.rotate(-30)}
            />
            <IconButton
              variant="overlay"
              icon="rotateRight"
              label={t('viewer.rotateRight')}
              onClick={() => api.current?.rotate(30)}
            />
            <IconButton
              variant="overlay"
              icon="plus"
              label={t('viewer.zoomIn')}
              onClick={() => api.current?.zoom(0.8)}
            />
            <IconButton
              variant="overlay"
              icon="minus"
              label={t('viewer.zoomOut')}
              onClick={() => api.current?.zoom(1.25)}
            />
            <IconButton
              variant="overlay"
              icon="reset"
              label={t('viewer.reset')}
              onClick={() => api.current?.reset()}
            />
          </div>
          {toolbar === 'full' && (
            <IconButton
              variant="overlay"
              icon="spin"
              label={t('viewer.autoRotate')}
              pressed={spinning}
              disabled={reduced}
              onClick={() => prefs.setAutoRotate(!prefs.autoRotate)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Model({
  url,
  wireframe,
  clay,
  lineColor,
  onBox,
}: {
  url: string;
  wireframe: boolean;
  clay: boolean;
  lineColor: string;
  onBox: (b: THREE.Box3) => void;
}) {
  const gltf = useGLTF(url, false);
  const invalidate = useThree((s) => s.invalidate);

  // Own copy: material toggles must not leak into drei's shared GLTF cache.
  const { scene, originals } = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        originals.set(o, o.material);
      }
    });
    return { scene, originals };
  }, [gltf]);

  useLayoutEffect(() => {
    onBox(new THREE.Box3().setFromObject(scene));
  }, [scene, onBox]);

  useEffect(() => {
    for (const [mesh, mat] of originals) mesh.material = clay ? CLAY : mat;
    invalidate();
  }, [clay, originals, invalidate]);

  // Wireframe-on-shaded, as in a DCC: overlay edges, keep the surface visible.
  useEffect(() => {
    if (!wireframe) return;
    const overlay = new THREE.MeshBasicMaterial({
      color: lineColor,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const added: THREE.Mesh[] = [];
    for (const mesh of originals.keys()) {
      const w = new THREE.Mesh(mesh.geometry, overlay);
      w.renderOrder = 1;
      mesh.add(w);
      added.push(w);
    }
    invalidate();
    return () => {
      for (const w of added) w.removeFromParent();
      overlay.dispose();
      invalidate();
    };
  }, [wireframe, originals, lineColor, invalidate]);

  return <primitive object={scene} />;
}

function ClayLump({ progress, still }: { progress: number; still: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.22, 4);
    g.scale(1.15, 0.85, 1);
    g.translate(0, 0.19, 0);
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const grow = 0.35 + 0.65 * progress;
    const breathe = still ? 1 : 1 + Math.sin(clock.elapsedTime * 2.4) * 0.015;
    ref.current.scale.set(grow * breathe, grow, grow * breathe);
  });
  return <mesh ref={ref} geometry={geo} material={CLAY} />;
}

/** Camera fitting, keyboard/button camera moves, and thumbnail capture. */
function Controller({
  apiRef,
  box,
  url,
  onCapture,
}: {
  apiRef: RefObject<ViewerHandle | null>;
  box: THREE.Box3 | null;
  url: string | null;
  onCapture?: (blob: Blob) => void;
}) {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const controls = useThree((s) => s.controls as unknown as Controls | null);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const captured = useRef<string | null>(null);

  const fit = useCallback(() => {
    if (!controls) return;
    const b =
      box ?? new THREE.Box3(new THREE.Vector3(-0.4, 0, -0.4), new THREE.Vector3(0.4, 0.6, 0.4));
    const size = b.getSize(new THREE.Vector3());
    const center = b.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 0.15);
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.08;
    const dir = new THREE.Vector3(0.62, 0.42, 0.95).normalize();
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.near = dist / 100;
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.minDistance = radius * 0.6;
    controls.maxDistance = radius * 8;
    controls.update();
    invalidate();
  }, [box, camera, controls, invalidate]);

  useEffect(fit, [fit]);

  useEffect(() => {
    apiRef.current = {
      rotate: (az, polar = 0) => {
        if (!controls) return;
        const offset = camera.position.clone().sub(controls.target);
        const s = new THREE.Spherical().setFromVector3(offset);
        s.theta += THREE.MathUtils.degToRad(az);
        s.phi = THREE.MathUtils.clamp(
          s.phi + THREE.MathUtils.degToRad(polar),
          0.05,
          Math.PI / 2 - 0.02,
        );
        camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
        controls.update();
        invalidate();
      },
      zoom: (factor) => {
        if (!controls) return;
        const offset = camera.position.clone().sub(controls.target);
        const len = THREE.MathUtils.clamp(
          offset.length() * factor,
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position.copy(controls.target).add(offset.setLength(len));
        controls.update();
        invalidate();
      },
      reset: fit,
    };
  }, [apiRef, camera, controls, fit, invalidate]);

  // Capture a square thumbnail once per model, after shadows have rendered.
  // `captured` is only set once a blob exists: if this effect re-runs mid-way
  // (new box object, StrictMode double-invoke), the cleanup cancels and the
  // next run starts over instead of being skipped.
  useEffect(() => {
    if (!box || !url || !onCapture || captured.current === url) return;
    let frames = 0;
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      invalidate();
      if (++frames < 6) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const src = gl.domElement;
      const side = Math.min(src.width, src.height);
      if (side === 0) return;
      const out = document.createElement('canvas');
      out.width = out.height = 480;
      out
        .getContext('2d')!
        .drawImage(
          src,
          (src.width - side) / 2,
          (src.height - side) / 2,
          side,
          side,
          0,
          0,
          480,
          480,
        );
      out.toBlob(
        (b) => {
          if (!b || cancelled || captured.current === url) return;
          captured.current = url;
          onCapture(b);
        },
        'image/webp',
        0.86,
      );
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [box, url, onCapture, gl, invalidate]);

  return null;
}

/** Error boundary that lives inside the R3F tree (bad/missing GLB). */
class CanvasBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError?.();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
