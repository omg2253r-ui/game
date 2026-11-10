import { Document, getBounds, NodeIO, Primitive } from '@gltf-transform/core';
import type { MeshStats } from '@3d-design/shared';

export const io = new NodeIO();

export function computeStats(doc: Document, fileSizeBytes: number): MeshStats {
  const root = doc.getRoot();
  let triangles = 0;
  let vertices = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const count = prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION')?.getCount() ?? 0;
      vertices += prim.getAttribute('POSITION')?.getCount() ?? 0;
      const mode = prim.getMode();
      if (mode === Primitive.Mode.TRIANGLES) triangles += Math.floor(count / 3);
      else if (mode === Primitive.Mode.TRIANGLE_STRIP || mode === Primitive.Mode.TRIANGLE_FAN) {
        triangles += Math.max(0, count - 2);
      }
    }
  }
  let textureMaxSize: number | null = null;
  for (const tex of root.listTextures()) {
    const size = tex.getSize();
    if (size) textureMaxSize = Math.max(textureMaxSize ?? 0, size[0], size[1]);
  }
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  let bounds = { x: 0, y: 0, z: 0 };
  if (scene) {
    const { min, max } = getBounds(scene);
    const r = (n: number) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0);
    bounds = { x: r(max[0] - min[0]), y: r(max[1] - min[1]), z: r(max[2] - min[2]) };
  }
  return {
    triangles,
    vertices,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    fileSizeBytes,
    textureMaxSize,
    bounds,
  };
}

/**
 * Normalise whatever a provider returned: stamp the licence into the asset
 * header (survives most DCC round-trips) and measure the result.
 */
export async function finaliseGlb(
  glb: Uint8Array,
  meta: { license: string; generator: string; modelId: string },
): Promise<{ glb: Uint8Array; stats: MeshStats }> {
  const doc = await io.readBinary(glb);
  const asset = doc.getRoot().getAsset();
  asset.copyright = meta.license;
  asset.generator = meta.generator;
  doc.getRoot().setExtras({
    ...(doc.getRoot().getExtras() as object),
    license: meta.license,
    modelId: meta.modelId,
  });
  const out = await io.writeBinary(doc);
  // Size depends on the stats we embed only via the licence string, so one pass is exact.
  return { glb: out, stats: computeStats(doc, out.byteLength) };
}
