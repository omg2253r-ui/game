/**
 * REST client for the Cloudflare Worker: guest/password auth, server save, reward grants.
 * Gracefully reports offline when no server is reachable (e.g. static hosting).
 */
import type { SaveData } from '../../core/save';

const TOKEN_KEY = 'scrapbound.token';
const API = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export interface Session {
  token: string;
  userId: string;
  name: string;
  guest: boolean;
}

export class Api {
  online = false;
  session: Session | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (raw) this.session = JSON.parse(raw);
    } catch {
      this.session = null;
    }
  }

  get base() {
    return API;
  }

  wsUrl(path: string): string {
    const base = API || location.origin;
    const u = new URL(path, base);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.toString();
  }

  private async req<T>(path: string, init: RequestInit = {}, timeout = 6000): Promise<T> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(API + path, {
        ...init,
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', ...(this.session ? { authorization: `Bearer ${this.session.token}` } : {}), ...(init.headers ?? {}) },
      });
      const text = await res.text();
      const body = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      return body as T;
    } finally {
      clearTimeout(t);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const r = await this.req<{ ok: boolean }>('/api/health', {}, 3500);
      this.online = !!r.ok;
    } catch {
      this.online = false;
    }
    return this.online;
  }

  private store(s: Session | null) {
    this.session = s;
    try {
      if (s) localStorage.setItem(TOKEN_KEY, JSON.stringify(s));
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked */
    }
  }

  async ensureGuest(name: string): Promise<Session | null> {
    if (this.session) {
      try {
        await this.req('/api/me');
        return this.session;
      } catch (e) {
        if (String(e).includes('401') || String(e).includes('nauthor')) this.store(null);
        else return this.session;
      }
    }
    try {
      const r = await this.req<Session>('/api/auth/guest', { method: 'POST', body: JSON.stringify({ name }) });
      this.store(r);
      return r;
    } catch {
      return null;
    }
  }

  async register(username: string, password: string): Promise<Session> {
    const r = await this.req<Session>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, upgradeToken: this.session?.guest ? this.session.token : undefined }) });
    this.store(r);
    return r;
  }

  async login(username: string, password: string): Promise<Session> {
    const r = await this.req<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    this.store(r);
    return r;
  }

  logout() {
    this.store(null);
  }

  async loadSave(): Promise<{ save: SaveData | null; updatedAt: number }> {
    return this.req('/api/save');
  }

  async putSave(save: SaveData): Promise<{ ok: boolean; updatedAt: number; warnings?: string[] }> {
    return this.req('/api/save', { method: 'PUT', body: JSON.stringify({ save }) }, 10000);
  }

  async claimGrants(): Promise<{ grants: { id: string; credits: number; exp: number; items: unknown[]; label: string }[] }> {
    return this.req('/api/grants/claim', { method: 'POST', body: '{}' });
  }

  async createRoom(): Promise<{ code: string }> {
    return this.req('/api/rooms', { method: 'POST', body: '{}' });
  }
}

export const api = new Api();
