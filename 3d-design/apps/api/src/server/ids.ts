import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford-ish, no i/l/o/u

/** Random id with a type prefix, e.g. `mdl_7k2x9...`. */
export function newId(prefix: string, length = 16): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const b of bytes) out += ALPHABET[b & 31];
  return `${prefix}_${out}`;
}

export const newSeed = (): number => randomBytes(4).readUInt32BE() & 0x7fffffff;
