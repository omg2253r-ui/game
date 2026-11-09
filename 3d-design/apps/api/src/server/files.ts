import { licenseNotice, THUMBNAIL_MAX_BYTES } from '@3d-design/shared';
import { finaliseGlb } from './gltf';
import { attachmentHeader, downloadName } from './access';
import { getServices } from './services';
import { AppError, type ModelRecord } from './types';

export async function sendModelFile(model: ModelRecord): Promise<Response> {
  const { storage } = await getServices();
  const disposition = attachmentHeader(model.name, model.id, 'glb');
  if (storage.signedUrl) {
    const url = await storage.signedUrl(
      model.fileKey,
      downloadName(model.name, model.id, 'glb'),
      300,
    );
    return Response.redirect(url, 302);
  }
  const obj = await storage.get(model.fileKey);
  if (!obj) throw new AppError('not_found', 404);
  return new Response(obj.body as BodyInit, {
    headers: {
      'Content-Type': 'model/gltf-binary',
      'Content-Length': String(obj.body.byteLength),
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}

export async function sendThumbnail(model: ModelRecord): Promise<Response> {
  const { storage } = await getServices();
  if (!model.thumbnailKey) throw new AppError('not_found', 404);
  const obj = await storage.get(model.thumbnailKey);
  if (!obj) throw new AppError('not_found', 404);
  return new Response(obj.body as BodyInit, {
    headers: { 'Content-Type': obj.contentType, 'Cache-Control': 'private, max-age=86400' },
  });
}

const SIGNATURES: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  {
    type: 'image/png',
    ext: 'png',
    test: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  {
    type: 'image/webp',
    ext: 'webp',
    test: (b) =>
      String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
  },
  { type: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

/**
 * Accept an image only if the declared Content-Type, the magic bytes and the
 * size limit all agree. Used for thumbnails now and image-to-3D uploads next.
 */
export function sniffImage(
  body: Uint8Array,
  declaredType: string | null,
  maxBytes = THUMBNAIL_MAX_BYTES,
) {
  if (body.byteLength > maxBytes) throw new AppError('payload_too_large', 413, { maxBytes });
  const sig = SIGNATURES.find((s) => s.test(body));
  const declared = declaredType?.split(';')[0]?.trim().toLowerCase();
  if (!sig || sig.type !== declared) throw new AppError('unsupported_media_type', 415);
  return sig;
}

/** Rewrite the licence inside the stored GLB after the owner changes terms. */
export async function restampLicense(model: ModelRecord): Promise<ModelRecord['stats']> {
  const { storage, provider } = await getServices();
  const obj = await storage.get(model.fileKey);
  if (!obj) throw new AppError('not_found', 404);
  const license = licenseNotice({
    modelId: model.id,
    ownerId: model.userId,
    createdAt: model.createdAt,
    provider: model.provider,
    allowCommercialUse: model.allowCommercialUse,
  });
  const { glb, stats } = await finaliseGlb(obj.body, {
    license,
    generator: `3D Design (${provider.id})`,
    modelId: model.id,
  });
  await storage.put(model.fileKey, glb, 'model/gltf-binary');
  return stats;
}
