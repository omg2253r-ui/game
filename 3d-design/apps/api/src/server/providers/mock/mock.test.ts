import { describe, expect, it } from 'vitest';
import { STYLES } from '@3d-design/shared';
import { finaliseGlb, io } from '../../gltf';
import { MockProvider } from '.';
import { interpret } from './interpret';

const ctx = () => ({ onProgress: () => {}, signal: new AbortController().signal });
const req = (over: Partial<Parameters<MockProvider['generate']>[0]> = {}) => ({
  mode: 'text' as const,
  prompt: 'ดาบเวทย์ ด้ามสีน้ำเงิน',
  negativePrompt: '',
  style: 'stylized' as const,
  quality: 'standard' as const,
  seed: 42,
  ...over,
});

describe('interpret', () => {
  it('picks the object mentioned first', () => {
    expect(interpret('ดาบที่มีอัญมณี', '', 'realistic', 'draft').archetype).toBe('sword');
    expect(interpret('a crystal shard', '', 'realistic', 'draft').archetype).toBe('crystal');
    expect(interpret('something unusual', '', 'realistic', 'draft').archetype).toBe('rock');
  });

  it('reads colours in order and honours the negative prompt', () => {
    const i = interpret('red car with blue stripes', 'blue', 'realistic', 'draft');
    expect(i.colors).toEqual([0xc8342b]);
  });

  it('does not treat "ไม้" inside "ต้นไม้" as a wood material request', () => {
    expect(interpret('ต้นไม้แฟนตาซี', '', 'realistic', 'draft').material).toBe('default');
  });
});

describe('MockProvider', () => {
  const provider = new MockProvider(0);

  it('is deterministic per seed and varies across seeds', async () => {
    const a = await provider.generate(req(), ctx());
    const b = await provider.generate(req(), ctx());
    const c = await provider.generate(req({ seed: 43 }), ctx());
    expect(Buffer.from(a.glb).equals(Buffer.from(b.glb))).toBe(true);
    expect(Buffer.from(a.glb).equals(Buffer.from(c.glb))).toBe(false);
  });

  it.each(STYLES)('produces a valid, grounded GLB in %s style', async (style) => {
    const { glb } = await provider.generate(req({ style }), ctx());
    const { stats } = await finaliseGlb(glb, { license: 'L', generator: 'test', modelId: 'm' });
    expect(stats.triangles).toBeGreaterThan(50);
    expect(stats.bounds.y).toBeGreaterThan(0.5); // a sword is about a metre long
    const doc = await io.readBinary(glb);
    const { getBounds } = await import('@gltf-transform/core');
    expect(getBounds(doc.getRoot().listScenes()[0]!).min[1]).toBeCloseTo(0, 3); // sits on the ground
  });

  it('higher quality never produces fewer triangles', async () => {
    const tris = async (quality: 'draft' | 'high') => {
      const { glb } = await provider.generate(req({ quality, prompt: 'blue vase' }), ctx());
      return (await finaliseGlb(glb, { license: 'L', generator: 't', modelId: 'm' })).stats
        .triangles;
    };
    expect(await tris('high')).toBeGreaterThan(await tris('draft'));
  });

  it('reports monotonic progress and stops when aborted', async () => {
    const seen: number[] = [];
    await new MockProvider(0).generate(req(), {
      onProgress: (u) => void seen.push(u.progress),
      signal: new AbortController().signal,
    });
    expect(seen).toEqual([...seen].sort((x, y) => x - y));
    const ac = new AbortController();
    ac.abort();
    await expect(
      new MockProvider(0).generate(req(), { onProgress: () => {}, signal: ac.signal }),
    ).rejects.toThrow();
  });
});

describe('finaliseGlb', () => {
  it('embeds the licence in asset.copyright and extras', async () => {
    const { glb } = await provider().generate(req(), ctx());
    const out = await finaliseGlb(glb, {
      license: 'Owned by you',
      generator: 'g',
      modelId: 'mdl_x',
    });
    const doc = await io.readBinary(out.glb);
    expect(doc.getRoot().getAsset().copyright).toBe('Owned by you');
    expect(doc.getRoot().getExtras()).toMatchObject({ license: 'Owned by you', modelId: 'mdl_x' });
    expect(out.stats.fileSizeBytes).toBe(out.glb.byteLength);
  });
});

function provider() {
  return new MockProvider(0);
}
