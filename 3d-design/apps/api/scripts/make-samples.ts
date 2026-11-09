/**
 * Renders the onboarding templates with the mock provider and writes them to
 * apps/web/public/samples so the home page has a model on its turntable.
 *   pnpm sample
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { STYLES, QUALITIES, type Quality, type Style } from '@3d-design/shared';
import { finaliseGlb } from '../src/server/gltf';
import { MockProvider } from '../src/server/providers/mock';

const out = path.resolve(import.meta.dirname, '../../web/public/samples');
const samples: { file: string; prompt: string; style: Style; quality: Quality; seed: number }[] = [
  {
    file: 'magic-sword.glb',
    prompt: 'ดาบเวทย์ ใบดาบเหล็ก ด้ามสีน้ำเงิน อัญมณีเรืองแสง',
    style: 'stylized',
    quality: 'standard',
    seed: 7,
  },
];

const provider = new MockProvider(0);
const noop = { onProgress: () => {}, signal: new AbortController().signal };
await fs.mkdir(out, { recursive: true });
for (const s of samples) {
  if (!STYLES.includes(s.style) || !QUALITIES.includes(s.quality)) throw new Error('bad sample');
  const { glb } = await provider.generate({ mode: 'text', negativePrompt: '', ...s }, noop);
  const final = await finaliseGlb(glb, {
    license: 'Sample asset bundled with 3D Design. Free to use for any purpose (CC0-1.0).',
    generator: '3D Design (mock)',
    modelId: 'sample',
  });
  await fs.writeFile(path.join(out, s.file), final.glb);
  console.log(s.file, final.stats);
}
