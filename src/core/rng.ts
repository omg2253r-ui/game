/**
 * Deterministic, serialisable PRNG (mulberry32). The whole RNG state is a single
 * uint32 so it can live inside JSON battle state and be replayed identically on
 * the client and the authoritative server.
 */
export class Rng {
  constructor(public state: number) {
    this.state = state >>> 0;
  }
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  weighted<T>(entries: readonly { w: number; v: T }[]): T {
    const total = entries.reduce((s, e) => s + Math.max(0, e.w), 0);
    let r = this.next() * total;
    for (const e of entries) {
      r -= Math.max(0, e.w);
      if (r < 0) return e.v;
    }
    return entries[entries.length - 1].v;
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }
  return (Math.random() * 4294967296) >>> 0;
}

export function uid(rng?: Rng): string {
  const r = () => (rng ? rng.next() : Math.random());
  let s = '';
  for (let i = 0; i < 12; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(r() * 36)];
  return s;
}
