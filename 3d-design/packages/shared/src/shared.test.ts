import { describe, expect, it } from 'vitest';
import {
  checkPrompt,
  creditCost,
  engineCompatibility,
  GenerateRequestSchema,
  licenseNotice,
  QUALITY_PRESETS,
  ROBLOX_MAX_TRIANGLES,
  UpdateModelSchema,
} from './index';

describe('checkPrompt', () => {
  it('allows ordinary prompts in Thai and English', () => {
    expect(checkPrompt('ดาบเวทย์ ด้ามสีน้ำเงิน').ok).toBe(true);
    expect(checkPrompt('a wooden marionette puppet').ok).toBe(true); // "mario" must not match inside a word
  });

  it('blocks copyrighted characters in either language', () => {
    expect(checkPrompt('pikachu plush')).toEqual({
      ok: false,
      code: 'content_copyrighted',
      term: 'pikachu',
    });
    expect(checkPrompt('ตุ๊กตาโดราเอมอน')).toMatchObject({
      ok: false,
      code: 'content_copyrighted',
    });
    expect(checkPrompt('Spider Man mask')).toMatchObject({ ok: false, term: 'spider-man' });
  });

  it('is not fooled by zero-width characters or case', () => {
    expect(checkPrompt('PIKA​chu')).toMatchObject({ ok: false });
  });

  it('checks the negative prompt too and ranks prohibited content first', () => {
    expect(checkPrompt('a box', 'pikachu')).toMatchObject({ ok: false });
    expect(checkPrompt('pikachu ghost gun')).toMatchObject({ code: 'content_prohibited' });
  });
});

describe('GenerateRequestSchema', () => {
  const base = { mode: 'text', prompt: 'a vase', style: 'voxel', quality: 'draft' } as const;

  it('trims, defaults the negative prompt and keeps the seed optional', () => {
    expect(GenerateRequestSchema.parse({ ...base, prompt: '  a vase  ' })).toEqual({
      ...base,
      negativePrompt: '',
    });
  });

  it('rejects short prompts, unknown styles and out-of-range seeds', () => {
    expect(GenerateRequestSchema.safeParse({ ...base, prompt: 'ab' }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ ...base, style: 'pixel' }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ ...base, seed: -1 }).success).toBe(false);
    expect(GenerateRequestSchema.safeParse({ ...base, seed: 2 ** 31 }).success).toBe(false);
  });
});

describe('UpdateModelSchema', () => {
  it('normalises and de-duplicates tags', () => {
    expect(UpdateModelSchema.parse({ tags: ['Fantasy', 'fantasy ', 'อาวุธ'] }).tags).toEqual([
      'fantasy',
      'อาวุธ',
    ]);
  });
  it('rejects tags with markup', () => {
    expect(UpdateModelSchema.safeParse({ tags: ['<script>'] }).success).toBe(false);
  });
});

describe('pricing and compatibility', () => {
  it('prices increase with quality', () => {
    expect(creditCost('draft')).toBeLessThan(creditCost('standard'));
    expect(creditCost('standard')).toBeLessThan(creditCost('high'));
    expect(QUALITY_PRESETS.high.targetTriangles).toBeGreaterThan(
      QUALITY_PRESETS.draft.targetTriangles,
    );
  });

  it('flags Roblox over its triangle limit', () => {
    const roblox = (tris: number) =>
      engineCompatibility({ triangles: tris }).find((c) => c.engine === 'roblox')!;
    expect(roblox(ROBLOX_MAX_TRIANGLES).level).toBe('ready');
    expect(roblox(ROBLOX_MAX_TRIANGLES + 1).level).toBe('over-limit');
  });

  it('licence text reflects the commercial-use choice', () => {
    const base = {
      modelId: 'mdl_1',
      ownerId: 'usr_1',
      createdAt: '2026-11-09T00:00:00Z',
      provider: 'mock',
    };
    expect(licenseNotice({ ...base, allowCommercialUse: true })).toContain(
      'may use it commercially.',
    );
    expect(licenseNotice({ ...base, allowCommercialUse: false })).toContain('non-commercial');
  });
});
