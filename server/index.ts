/**
 * SCRAPBOUND Worker: REST API (auth, server save, reward grants, rooms) and the
 * WebSocket entry point into the RaidRoom Durable Object. Static assets are served
 * by Workers Static Assets for every non-/api path.
 */
import { cleanName, hashPassword, randomHex, safeEqual, sha256, SESSION_DAYS, validPassword, validUsername } from './auth';
import { validateSave, plausibleTransition, migrateSave, type SaveData } from '../src/core/save';
import { ROOM_CODE_RE } from '../src/core/net/protocol';

export { RaidRoom } from './room';

export interface Env {
  DB: D1Database;
  RAID_ROOM: DurableObjectNamespace;
  ASSETS?: Fetcher;
}

interface UserRow {
  id: string;
  username: string | null;
  pass_hash: string | null;
  pass_salt: string | null;
  display_name: string;
  guest: number;
}

const MAX_BODY = 600_000;

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
const err = (status: number, error: string) => json({ error }, status);

async function body<T>(req: Request): Promise<T | null> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) return null;
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomHex(32);
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), userId, now, now + SESSION_DAYS * 86400_000).run();
  return token;
}

export async function authenticate(env: Env, token: string | null | undefined): Promise<UserRow | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await env.DB.prepare('SELECT u.id, u.username, u.pass_hash, u.pass_salt, u.display_name, u.guest, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').bind(await sha256(token)).first<UserRow & { expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return null;
  return row;
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

// --- tiny per-isolate rate limiter (best-effort; pair with Cloudflare WAF rules in production) ---
const hits = new Map<string, { n: number; t: number }>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now - e.t > windowMs) {
    hits.set(key, { n: 1, t: now });
    return false;
  }
  e.n++;
  if (hits.size > 5000) hits.clear();
  return e.n > max;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    if (!path.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Not found', { status: 404 });
    }
    const ip = req.headers.get('cf-connecting-ip') ?? 'local';
    try {
      // ------------------------------------------------------------------ health
      if (path === '/api/health') return json({ ok: true, time: Date.now() });

      // ------------------------------------------------------------------ auth
      if (path === '/api/auth/guest' && req.method === 'POST') {
        if (limited(`guest:${ip}`, 20, 60_000)) return err(429, 'Too many requests');
        const b = await body<{ name?: string }>(req);
        const name = cleanName(b?.name) ?? `Hunter${Math.floor(Math.random() * 9000 + 1000)}`;
        const id = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO users (id, display_name, guest, created_at) VALUES (?, ?, 1, ?)').bind(id, name, Date.now()).run();
        const token = await createSession(env, id);
        return json({ token, userId: id, name, guest: true });
      }
      if (path === '/api/auth/register' && req.method === 'POST') {
        if (limited(`reg:${ip}`, 10, 60_000)) return err(429, 'Too many requests');
        const b = await body<{ username?: string; password?: string; upgradeToken?: string }>(req);
        if (!b || !validUsername(b.username)) return err(400, 'Username: 3-20 letters, digits or _');
        if (!validPassword(b.password)) return err(400, 'Password must be 8-128 characters');
        const taken = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(b.username.toLowerCase()).first();
        if (taken) return err(409, 'Username already taken');
        const { hash, salt } = await hashPassword(b.password);
        let userId: string;
        const guest = await authenticate(env, b.upgradeToken);
        if (guest && guest.guest) {
          userId = guest.id;
          await env.DB.prepare('UPDATE users SET username = ?, pass_hash = ?, pass_salt = ?, guest = 0 WHERE id = ?').bind(b.username.toLowerCase(), hash, salt, userId).run();
        } else {
          userId = crypto.randomUUID();
          await env.DB.prepare('INSERT INTO users (id, username, pass_hash, pass_salt, display_name, guest, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)').bind(userId, b.username.toLowerCase(), hash, salt, b.username, Date.now()).run();
        }
        const token = await createSession(env, userId);
        return json({ token, userId, name: b.username, guest: false });
      }
      if (path === '/api/auth/login' && req.method === 'POST') {
        if (limited(`login:${ip}`, 10, 60_000)) return err(429, 'Too many attempts, wait a minute');
        const b = await body<{ username?: string; password?: string }>(req);
        if (!b || !validUsername(b.username) || !validPassword(b.password)) return err(400, 'Invalid credentials');
        const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(b.username.toLowerCase()).first<UserRow>();
        if (!u || !u.pass_hash || !u.pass_salt) return err(401, 'Invalid credentials');
        const { hash } = await hashPassword(b.password, u.pass_salt);
        if (!safeEqual(hash, u.pass_hash)) return err(401, 'Invalid credentials');
        const token = await createSession(env, u.id);
        return json({ token, userId: u.id, name: u.display_name, guest: false });
      }

      // ------------------------------------------------------------------ websocket into a raid room
      const wsMatch = /^\/api\/rooms\/([A-Za-z0-9]{5})\/ws$/.exec(path);
      if (wsMatch) {
        if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return err(426, 'Expected websocket');
        const user = await authenticate(env, url.searchParams.get('token'));
        if (!user) return err(401, 'Unauthorized');
        const code = wsMatch[1].toUpperCase();
        const stub = env.RAID_ROOM.get(env.RAID_ROOM.idFromName(code));
        const fwd = new Request(`https://room/${code}`, req);
        fwd.headers.set('x-user-id', user.id);
        fwd.headers.set('x-user-name', user.display_name);
        fwd.headers.set('x-room-code', code);
        return stub.fetch(fwd);
      }

      // ------------------------------------------------------------------ authenticated routes
      const user = await authenticate(env, bearer(req));
      if (!user) return err(401, 'Unauthorized');

      if (path === '/api/me') return json({ userId: user.id, name: user.display_name, guest: !!user.guest, username: user.username });

      if (path === '/api/save' && req.method === 'GET') {
        const row = await env.DB.prepare('SELECT data, server_updated_at FROM saves WHERE user_id = ?').bind(user.id).first<{ data: string; server_updated_at: number }>();
        return json({ save: row ? JSON.parse(row.data) : null, updatedAt: row?.server_updated_at ?? 0 });
      }
      if (path === '/api/save' && req.method === 'PUT') {
        if (limited(`save:${user.id}`, 30, 60_000)) return err(429, 'Saving too often');
        const b = await body<{ save?: SaveData }>(req);
        if (!b?.save) return err(400, 'Missing save');
        const save = migrateSave(b.save);
        const v = validateSave(save);
        if (!v.ok) {
          await env.DB.prepare('INSERT INTO save_audit (user_id, reason, created_at) VALUES (?, ?, ?)').bind(user.id, 'invalid: ' + v.errors.slice(0, 5).join('; '), Date.now()).run();
          return json({ error: 'Save rejected', details: v.errors.slice(0, 10) }, 422);
        }
        const prev = await env.DB.prepare('SELECT data, server_updated_at FROM saves WHERE user_id = ?').bind(user.id).first<{ data: string; server_updated_at: number }>();
        let warnings: string[] = [];
        if (prev) {
          const p = migrateSave(JSON.parse(prev.data));
          const freshRestart = save.createdAt !== p.createdAt && save.hunters.every((h) => h.level <= 2) && save.credits <= 1500;
          warnings = freshRestart ? [] : plausibleTransition(p, save, Date.now() - prev.server_updated_at);
          if (warnings.length) {
            await env.DB.prepare('INSERT INTO save_audit (user_id, reason, created_at) VALUES (?, ?, ?)').bind(user.id, warnings.join('; '), Date.now()).run();
            return json({ error: 'Save rejected by anti-cheat', details: warnings }, 422);
          }
        }
        const now = Date.now();
        await env.DB.prepare('INSERT INTO saves (user_id, data, version, updated_at, server_updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated_at = excluded.updated_at, server_updated_at = excluded.server_updated_at').bind(user.id, JSON.stringify(save), save.version, save.updatedAt, now).run();
        return json({ ok: true, updatedAt: now, warnings });
      }
      if (path === '/api/grants/claim' && req.method === 'POST') {
        const rows = await env.DB.prepare('SELECT id, payload FROM grants WHERE user_id = ? AND claimed_at IS NULL ORDER BY created_at LIMIT 20').bind(user.id).all<{ id: string; payload: string }>();
        const grants = (rows.results ?? []).map((r) => ({ id: r.id, ...JSON.parse(r.payload) }));
        if (grants.length) {
          const now = Date.now();
          await env.DB.batch(grants.map((g) => env.DB.prepare('UPDATE grants SET claimed_at = ? WHERE id = ? AND user_id = ?').bind(now, g.id, user.id)));
        }
        return json({ grants });
      }
      if (path === '/api/rooms' && req.method === 'POST') {
        if (limited(`room:${user.id}`, 10, 60_000)) return err(429, 'Too many rooms');
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = crypto.getRandomValues(new Uint8Array(5));
        const code = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
        if (!ROOM_CODE_RE.test(code)) return err(500, 'code');
        return json({ code });
      }
      return err(404, 'Not found');
    } catch (e) {
      console.error('api error', e);
      return err(500, 'Server error');
    }
  },
} satisfies ExportedHandler<Env>;
