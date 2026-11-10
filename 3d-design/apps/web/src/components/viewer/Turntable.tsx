import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * The sculptor's banding wheel: a ring with a tick every 15°, a longer one
 * every 90°, and the 0° mark in tape yellow so rotation is readable.
 */
export function Turntable({
  radius,
  ink,
  accent,
}: {
  radius: number;
  ink: string;
  accent: string;
}) {
  const group = useMemo(() => {
    const g = new THREE.Group();
    g.position.y = 0.0015;
    const geo = (pts: number[]) =>
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));

    const ringPts: number[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      ringPts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
    const tickPts: number[] = [];
    for (let deg = 15; deg < 360; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const len = deg % 90 === 0 ? radius * 0.1 : radius * 0.045;
      tickPts.push(
        Math.cos(a) * radius,
        0,
        Math.sin(a) * radius,
        Math.cos(a) * (radius + len),
        0,
        Math.sin(a) * (radius + len),
      );
    }
    const inkMat = new THREE.LineBasicMaterial({ color: ink });
    g.add(new THREE.Line(geo(ringPts), inkMat));
    g.add(new THREE.LineSegments(geo(tickPts), inkMat));
    g.add(
      new THREE.LineSegments(
        geo([0, 0, radius, 0, 0, radius * 1.16]),
        new THREE.LineBasicMaterial({ color: accent }),
      ),
    );
    return g;
  }, [radius, ink, accent]);

  useEffect(
    () => () => {
      group.traverse((o) => {
        if (o instanceof THREE.Line) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
    [group],
  );

  return <primitive object={group} />;
}
