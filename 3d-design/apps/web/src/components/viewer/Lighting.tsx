import { Environment, Lightformer } from '@react-three/drei';
import type { Lighting as LightingName } from '../../stores/prefs';

/**
 * Image-based lighting built from Lightformers instead of downloaded HDRIs:
 * no network fetch, works offline, and each preset reads like a real setup.
 */
export function Lighting({ preset }: { preset: LightingName }) {
  if (preset === 'outdoor') {
    return (
      <>
        <directionalLight position={[4, 6, 2]} intensity={2.2} color="#fff1d6" />
        <hemisphereLight args={['#bcd6ff', '#5b5246', 0.6]} />
        <Environment resolution={256} frames={1}>
          <color attach="background" args={['#6f7a86']} />
          <Lightformer
            form="rect"
            intensity={1.6}
            color="#cfe2ff"
            position={[0, 8, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[20, 20, 1]}
          />
          <Lightformer form="circle" intensity={6} color="#fff0cf" position={[6, 5, 3]} scale={2} />
          <Lightformer
            form="rect"
            intensity={0.4}
            color="#8a7a63"
            position={[0, -3, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[20, 20, 1]}
          />
        </Environment>
      </>
    );
  }
  if (preset === 'dramatic') {
    return (
      <>
        <directionalLight position={[-5, 3, 1]} intensity={3} />
        <ambientLight intensity={0.05} />
        <Environment resolution={256} frames={1}>
          <color attach="background" args={['#1c1e20']} />
          <Lightformer
            form="rect"
            intensity={3}
            position={[-6, 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[3, 8, 1]}
          />
          <Lightformer
            form="rect"
            intensity={0.6}
            position={[4, 3, -4]}
            rotation={[0, -Math.PI / 4, 0]}
            scale={[1, 6, 1]}
          />
        </Environment>
      </>
    );
  }
  // Studio: key softbox, fill card, rim strip — a classic three-point product setup.
  return (
    <>
      <directionalLight position={[3, 5, 4]} intensity={1.4} />
      <ambientLight intensity={0.15} />
      <Environment resolution={256} frames={1}>
        {/* Grey sweep base: metals pick up a neutral mid-tone instead of black. */}
        <color attach="background" args={['#5c6064']} />
        <Lightformer
          form="rect"
          intensity={2.4}
          position={[2, 4, 4]}
          rotation={[-0.6, 0.4, 0]}
          scale={[5, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          position={[-5, 1.5, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[4, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.6}
          position={[0, 2.5, -5]}
          rotation={[0, Math.PI, 0]}
          scale={[8, 0.6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          position={[0, 6, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
        />
      </Environment>
    </>
  );
}
