import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useFormat } from '../../i18n';

/** Bounding-box callipers in tape yellow, with real-world sizes. */
export function Measure({ box, color }: { box: THREE.Box3; color: string }) {
  const f = useFormat();
  const { min, max } = box;
  const size = box.getSize(new THREE.Vector3());
  const o = Math.max(size.x, size.y, size.z) * 0.06; // offset lines off the surface
  const label = (text: string) => (
    <span className="num pointer-events-none whitespace-nowrap rounded-control bg-bg/85 px-0.5 text-caption text-accent-ink">
      {text}
    </span>
  );
  const w: [THREE.Vector3Tuple, THREE.Vector3Tuple] = [
    [min.x, min.y, max.z + o],
    [max.x, min.y, max.z + o],
  ];
  const h: [THREE.Vector3Tuple, THREE.Vector3Tuple] = [
    [max.x + o, min.y, max.z],
    [max.x + o, max.y, max.z],
  ];
  const d: [THREE.Vector3Tuple, THREE.Vector3Tuple] = [
    [max.x + o, min.y, min.z],
    [max.x + o, min.y, max.z],
  ];
  const mid = (a: THREE.Vector3Tuple, b: THREE.Vector3Tuple): THREE.Vector3Tuple => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2,
  ];
  return (
    <group>
      <Line points={w} color={color} lineWidth={1.5} />
      <Line points={h} color={color} lineWidth={1.5} />
      <Line points={d} color={color} lineWidth={1.5} />
      <lineSegments position={box.getCenter(new THREE.Vector3())}>
        <edgesGeometry args={[new THREE.BoxGeometry(size.x, size.y, size.z)]} />
        <lineBasicMaterial color={color} transparent opacity={0.35} />
      </lineSegments>
      <Html position={mid(...w)} center zIndexRange={[5, 0]}>
        {label(f.metres(size.x))}
      </Html>
      <Html position={mid(...h)} center zIndexRange={[5, 0]}>
        {label(f.metres(size.y))}
      </Html>
      <Html position={mid(...d)} center zIndexRange={[5, 0]}>
        {label(f.metres(size.z))}
      </Html>
    </group>
  );
}
