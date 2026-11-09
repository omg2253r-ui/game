import { Document } from '@gltf-transform/core';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Style } from '@3d-design/shared';
import { io } from '../../gltf';
import type { MatSpec, Part } from './parts';

function styled(m: MatSpec, style: Style): MatSpec {
  const c = new THREE.Color(m.color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const out = { ...m };
  switch (style) {
    case 'stylized':
      hsl.s = Math.min(1, hsl.s * 1.25);
      out.roughness = Math.max(out.roughness, 0.45);
      break;
    case 'anime':
      hsl.s = Math.min(1, hsl.s * 1.3);
      hsl.l = Math.min(0.85, hsl.l * 1.12);
      out.roughness = 0.9;
      out.metalness *= 0.3;
      break;
    case 'realistic':
      hsl.s *= 0.9;
      break;
    case 'low-poly':
    case 'voxel':
      out.roughness = Math.max(out.roughness, 0.75);
      out.metalness *= 0.5;
      break;
  }
  c.setHSL(hsl.h, hsl.s, hsl.l);
  out.color = c.getHex();
  return out;
}

/** three.js geometry parts → binary glTF (one primitive per material). */
export async function partsToGlb(parts: Part[], style: Style, name: string): Promise<Uint8Array> {
  const groups = new Map<string, { mat: MatSpec; geos: THREE.BufferGeometry[] }>();
  for (const part of parts) {
    let g = part.geometry;
    for (const attr of Object.keys(g.attributes)) {
      if (attr !== 'position' && attr !== 'normal') g.deleteAttribute(attr);
    }
    if (part.flat || style === 'low-poly') {
      g = g.index ? g.toNonIndexed() : g;
      g.computeVertexNormals();
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.index) {
      const n = g.getAttribute('position').count;
      g.setIndex(Array.from({ length: n }, (_, k) => k));
    }
    const mat = styled(part.material, style);
    const key = JSON.stringify(mat);
    const group = groups.get(key) ?? { mat, geos: [] };
    group.geos.push(g);
    groups.set(key, group);
  }

  // Sit on the ground (y=0), centred on x/z — what engines and the turntable expect.
  const merged = [...groups.values()].map((gr) => ({
    mat: gr.mat,
    geo: mergeGeometries(gr.geos, false)!,
  }));
  const box = new THREE.Box3();
  for (const m of merged) {
    m.geo.computeBoundingBox();
    box.union(m.geo.boundingBox!);
  }
  const center = box.getCenter(new THREE.Vector3());
  for (const m of merged) m.geo.translate(-center.x, -box.min.y, -center.z);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh(name);
  const materialNames = new Map<string, number>();
  for (const { mat, geo } of merged) {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
    const index = geo.getIndex()!;
    const count = pos.count;
    const indices = count > 65535 ? new Uint32Array(index.array) : new Uint16Array(index.array);

    // glTF factors are linear; THREE.Color stores linear values after setHex.
    const base = new THREE.Color(mat.color);
    const material = doc
      .createMaterial(uniqueName(materialNames, mat.name))
      .setBaseColorFactor([base.r, base.g, base.b, 1])
      .setRoughnessFactor(mat.roughness)
      .setMetallicFactor(mat.metalness);
    if (mat.emissive !== undefined) {
      const e = new THREE.Color(mat.emissive);
      material.setEmissiveFactor([e.r, e.g, e.b]);
    }
    const prim = doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc
          .createAccessor()
          .setType('VEC3')
          .setArray(new Float32Array(pos.array))
          .setBuffer(buffer),
      )
      .setAttribute(
        'NORMAL',
        doc.createAccessor().setType('VEC3').setArray(normalised(nor)).setBuffer(buffer),
      )
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
      .setMaterial(material);
    mesh.addPrimitive(prim);
  }
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene('Scene').addChild(node);
  doc.getRoot().setDefaultScene(doc.getRoot().listScenes()[0]!);
  return io.writeBinary(doc);
}

function normalised(attr: THREE.BufferAttribute): Float32Array {
  const out = new Float32Array(attr.array);
  for (let k = 0; k < out.length; k += 3) {
    const l = Math.hypot(out[k]!, out[k + 1]!, out[k + 2]!) || 1;
    out[k]! /= l;
    out[k + 1]! /= l;
    out[k + 2]! /= l;
  }
  return out;
}

function uniqueName(seen: Map<string, number>, name: string): string {
  const n = seen.get(name) ?? 0;
  seen.set(name, n + 1);
  return n === 0 ? name : `${name} ${n + 1}`;
}
