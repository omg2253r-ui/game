/** Deterministic PRNG so the same seed always yields the same model. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded 3D value noise in [-1, 1], smooth (quintic fade). */
export function makeNoise3(seed: number): (x: number, y: number, z: number) => number {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rand() * 2 - 1;
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j]!, perm[i]!];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]!;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const v = (x: number, y: number, z: number) => vals[perm[perm[perm[x]! + y]! + z]!]!;
  return (x, y, z) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      zi = Math.floor(z);
    const xf = x - xi,
      yf = y - yi,
      zf = z - zi;
    const X = xi & 255,
      Y = yi & 255,
      Z = zi & 255;
    const u = fade(xf),
      w = fade(yf),
      s = fade(zf);
    return lerp(
      lerp(lerp(v(X, Y, Z), v(X + 1, Y, Z), u), lerp(v(X, Y + 1, Z), v(X + 1, Y + 1, Z), u), w),
      lerp(
        lerp(v(X, Y, Z + 1), v(X + 1, Y, Z + 1), u),
        lerp(v(X, Y + 1, Z + 1), v(X + 1, Y + 1, Z + 1), u),
        w,
      ),
      s,
    );
  };
}

export function fbm(
  noise: ReturnType<typeof makeNoise3>,
  x: number,
  y: number,
  z: number,
  octaves = 3,
) {
  let sum = 0,
    amp = 0.5,
    freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq, z * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}
