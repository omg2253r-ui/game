import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getServices } from './services';
import { newId } from './ids';
import type { UserRecord } from './types';

export const SESSION_COOKIE = 'd3_sid';
const MAX_AGE = 60 * 60 * 24 * 365;

const sign = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('base64url');

export function verifySessionToken(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const expected = Buffer.from(sign(id, secret));
  const actual = Buffer.from(token.slice(dot + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return id;
}

export const sessionToken = (userId: string, secret: string) => `${userId}.${sign(userId, secret)}`;

/**
 * MVP identity: a signed, httpOnly guest cookie. Every visitor gets a guest
 * account with starter credits; phase 2 (Auth.js email + Google) attaches
 * an email to the same user id so the library carries over.
 */
export async function currentUser(opts: { create: boolean }): Promise<UserRecord | null> {
  const { config, repo } = await getServices();
  const jar = await cookies();
  const id = verifySessionToken(jar.get(SESSION_COOKIE)?.value, config.sessionSecret);
  if (id) {
    const user = await repo.getUser(id);
    if (user) return user;
  }
  if (!opts.create) return null;
  const user = await repo.createUser(newId('usr'), config.STARTER_CREDITS);
  jar.set(SESSION_COOKIE, sessionToken(user.id, config.sessionSecret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
  return user;
}
