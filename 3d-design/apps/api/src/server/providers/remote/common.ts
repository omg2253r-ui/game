import { ProviderError } from '../../pipeline';

const GLB_MAGIC = 0x46546c67; // "glTF"

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { signal: AbortSignal },
): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError('provider_failed', `auth rejected by ${new URL(url).host}`);
  }
  if (!res.ok)
    throw new ProviderError('provider_failed', `${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

export async function downloadGlb(url: string, signal: AbortSignal, maxBytes = 200 * 1024 * 1024) {
  if (!url.startsWith('https://'))
    throw new ProviderError('provider_failed', 'non-https asset url');
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ProviderError('provider_failed', `asset download ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new ProviderError('provider_failed', 'asset too large');
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new ProviderError('provider_failed', 'asset too large');
  if (
    buf.byteLength < 12 ||
    new DataView(buf.buffer, buf.byteOffset).getUint32(0, true) !== GLB_MAGIC
  ) {
    throw new ProviderError('provider_failed', 'asset is not a GLB');
  }
  return buf;
}

export const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new ProviderError('provider_timeout', 'aborted'));
    });
  });

/** Style words appended to the prompt for vendors without a matching style flag. */
export const STYLE_HINT: Record<string, string> = {
  realistic: 'realistic, physically based materials',
  'low-poly': 'low-poly style, flat shaded facets',
  stylized: 'stylized, hand-painted game asset',
  anime: 'anime style, cel-shaded colours',
  voxel: 'voxel art, built from cubes',
};
