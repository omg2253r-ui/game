/** Password hashing (PBKDF2-SHA256) and opaque session tokens (stored hashed). */

const enc = new TextEncoder();
export const PBKDF2_ITERATIONS = 100_000; // Workers' WebCrypto upper bound

export function hex(buf: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes: number): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(s: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ?? randomHex(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: hex(bits), salt };
}

/** constant-time string comparison */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const SESSION_DAYS = 60;

export function cleanName(raw: unknown, max = 16): string | null {
  if (typeof raw !== 'string') return null;
  const n = raw.normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, max);
  return n.length >= 2 ? n : null;
}

export function validUsername(u: unknown): u is string {
  return typeof u === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(u);
}

export function validPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128;
}
