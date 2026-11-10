import { describe, expect, it } from 'vitest';
import { en } from './en';
import { format } from './format';
import { th, type MessageKey } from './th';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('English has exactly the Thai keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(th).sort());
  });

  it('every translation uses the same placeholders', () => {
    for (const key of Object.keys(th) as MessageKey[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(th[key]));
    }
  });

  it('no empty strings and no all-caps labels', () => {
    for (const [key, value] of [...Object.entries(th), ...Object.entries(en)]) {
      expect(value.trim(), key).not.toBe('');
      // Guard the "no ALL CAPS labels" rule; acronyms like GLB/PBR are fine.
      expect(/\b[A-Z]{5,}\b/.test(value) && !/AI_PROVIDER|WEBGL/i.test(value), key).toBe(false);
    }
  });

  it('every API error code has a message', async () => {
    const { ERROR_CODES } = await import('@3d-design/shared');
    for (const code of ERROR_CODES) expect(th[`error.${code}` as MessageKey], code).toBeTruthy();
  });
});

describe('format', () => {
  it('interpolates and leaves unknown placeholders visible', () => {
    expect(format(th, 'credits.balance', { n: 45 })).toBe('เครดิต 45');
    expect(format(en, 'generate.button', {})).toBe('Create model · {cost}');
  });
});
