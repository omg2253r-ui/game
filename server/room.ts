/**
 * RaidRoom Durable Object — authoritative co-op turn synchronisation.
 *
 *  lobby  → members join with a room code, toggle ready, host picks the raid
 *  battle → round opens (30s timer) → each player submits/locks commands for their
 *           own hunter → when everyone is locked (or the timer fires) the server
 *           resolves the round with the shared combat engine and broadcasts the
 *           identical event list + state to every client → next round
 *  done   → rewards rolled server-side and written to D1 as claimable grants
 *
 * Disconnected players' hunters are AI-controlled until they reconnect.
 * Uses the hibernatable WebSocket API; room state is persisted to DO storage.
 */
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';
import type { Action, BattleState } from '../src/core/combat/types';
import type { ClientMsg, MemberInfo, RaidConfig, ServerMsg } from '../src/core/net/protocol';
import { MAX_PLAYERS, TURN_TIMER_MS } from '../src/core/net/protocol';
import { buildBattle, coopPartyScale, raidWaves } from '../src/core/combat/setup';
import { publicState, resolveRound, validateAction, getUnit } from '../src/core/combat/engine';
import { chooseAllyAction } from '../src/core/combat/ai';
import type { Encounter } from '../src/core/dungeon/generator';
import { hunterBuild } from '../src/core/progression';
import { migrateSave, validateSave, type SaveData } from '../src/core/save';
import type { HunterBuild } from '../src/core/combat/units';
import { DUNGEON_MAP } from '../src/core/data/regions';
import { rollDrops } from '../src/core/economy/loot';
import { Rng, randomSeed } from '../src/core/rng';
import type { ItemInstance } from '../src/core/economy/items';

interface Member {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  level: number;
  weapon: string;
}

interface PlanEntry {
  owner: string;
  action: Action | null;
  locked: boolean;
}

interface RoomData {
  code: string;
  hostId: string;
  created: number;
  members: Record<string, Member>;
  order: string[];
  config: RaidConfig;
  phase: 'lobby' | 'battle' | 'done';
  waves: Encounter[];
  wave: number;
  seed: number;
  defeated: { template: string; level: number; elite?: boolean }[];
  battle: BattleState | null;
  plans: Record<string, PlanEntry>;
  deadline: number;
  lastActive: number;
}

const IDLE_CLEANUP_MS = 15 * 60_000;
const RAID_KIT = { repair_kit: 2, nano_revive: 1, energy_cell: 1 };

export class RaidRoom extends DurableObject<Env> {
  private data: RoomData | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.data = (await ctx.storage.get<RoomData>('room')) ?? null;
    });
  }

  private async persist() {
    if (this.data) {
      this.data.lastActive = Date.now();
      await this.ctx.storage.put('room', this.data);
    }
  }

  // ---------------------------------------------------------------------------
  // connections
  // ---------------------------------------------------------------------------

  async fetch(req: Request): Promise<Response> {
    const userId = req.headers.get('x-user-id');
    const name = req.headers.get('x-user-name') ?? 'Hunter';
    const code = req.headers.get('x-room-code') ?? '?????';
    if (!userId) return new Response('unauthorized', { status: 401 });
    if (!this.data) {
      this.data = { code, hostId: userId, created: Date.now(), members: {}, order: [], config: { dungeonId: 'data_center', difficulty: 0 }, phase: 'lobby', waves: [], wave: 0, seed: randomSeed(), defeated: [], battle: null, plans: {}, deadline: 0, lastActive: Date.now() };
    }
    const d = this.data;
    const existing = d.members[userId];
    if (!existing) {
      if (d.phase !== 'lobby') return this.reject('This raid has already started.');
      if (d.order.length >= MAX_PLAYERS) return this.reject('Room is full (4 players).');
      const save = await this.loadSave(userId);
      if (!save) return this.reject('Sync your save first (create a hunter and enter the city).');
      const main = save.hunters.find((h) => h.isMain)!;
      const w = save.inventory.find((i) => i.uid === main.weaponUid)?.defId ?? 'energy_katana';
      d.members[userId] = { id: userId, name: save.name || name, ready: false, connected: true, joinedAt: Date.now(), level: main.level, weapon: w };
      d.order.push(userId);
    }
    // close stale sockets of the same user (reconnect from another tab)
    for (const ws of this.ctx.getWebSockets(userId)) {
      try {
        ws.close(4000, 'replaced');
      } catch {
        /* ignore */
      }
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [userId]);
    server.serializeAttachment({ userId });
    const m = d.members[userId];
    m.connected = true;
    if (!d.members[d.hostId]?.connected) d.hostId = userId;
    if (d.battle) for (const u of d.battle.units) if (u.ownerId === userId) u.autoControl = false;
    await this.persist();
    // initial sync for this socket
    this.sendTo(server, this.roomMsg(userId));
    if (d.phase === 'battle' && d.battle) {
      this.sendTo(server, { t: 'battle_start', wave: d.wave, waves: d.waves.length, state: publicState(d.battle), deadline: d.deadline, peers: this.peers() });
      this.sendTo(server, { t: 'round_open', state: publicState(d.battle), deadline: d.deadline, peers: this.peers(), plans: this.publicPlans() });
    }
    this.broadcast({ t: 'member', id: userId, connected: true, name: m.name }, userId);
    this.broadcastRoom();
    return new Response(null, { status: 101, webSocket: client });
  }

  private reject(msg: string): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.send(JSON.stringify({ t: 'error', msg } satisfies ServerMsg));
    server.close(4001, msg.slice(0, 100));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const d = this.data;
    const { userId } = (ws.deserializeAttachment() ?? {}) as { userId?: string };
    if (!d || !userId || !d.members[userId]) return;
    if (typeof raw !== 'string' || raw.length > 8000) return;
    let m: ClientMsg;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    switch (m.t) {
      case 'ping':
        this.sendTo(ws, { t: 'pong' });
        return;
      case 'ready':
        if (d.phase !== 'lobby') return;
        d.members[userId].ready = !!m.ready;
        await this.persist();
        this.broadcastRoom();
        return;
      case 'config':
        if (d.phase !== 'lobby' || userId !== d.hostId) return;
        if (!DUNGEON_MAP[m.dungeonId] || ![0, 1, 2, 3].includes(m.difficulty)) return;
        d.config = { dungeonId: m.dungeonId, difficulty: m.difficulty };
        await this.persist();
        this.broadcastRoom();
        return;
      case 'start':
        if (d.phase !== 'lobby' || userId !== d.hostId) return;
        if (!d.order.every((id) => d.members[id].ready || !d.members[id].connected)) {
          this.sendTo(ws, { t: 'error', msg: 'Everyone must be ready' });
          return;
        }
        await this.startRaid();
        return;
      case 'plan':
        await this.onPlan(userId, m.round, m.unitId, m.action, m.locked, ws);
        return;
      case 'chat': {
        const text = String(m.text ?? '').slice(0, 140);
        if (text) this.broadcast({ t: 'chat', from: d.members[userId].name, text });
        return;
      }
      case 'leave':
        await this.dropMember(userId, true);
        ws.close(1000, 'left');
        return;
    }
  }

  async webSocketClose(ws: WebSocket) {
    const { userId } = (ws.deserializeAttachment() ?? {}) as { userId?: string };
    if (!userId) return;
    // only mark disconnected if no other socket of this user is open
    if (this.ctx.getWebSockets(userId).some((s) => s !== ws && s.readyState === WebSocket.OPEN)) return;
    await this.dropMember(userId, false);
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  private async dropMember(userId: string, left: boolean) {
    const d = this.data;
    if (!d || !d.members[userId]) return;
    const m = d.members[userId];
    if (d.phase === 'lobby' && left) {
      delete d.members[userId];
      d.order = d.order.filter((x) => x !== userId);
    } else {
      m.connected = false;
      m.ready = false;
    }
    if (d.battle) for (const u of d.battle.units) if (u.ownerId === userId) u.autoControl = true;
    if (d.hostId === userId) {
      const next = d.order.find((id) => d.members[id]?.connected);
      if (next) d.hostId = next;
    }
    await this.persist();
    this.broadcast({ t: 'member', id: userId, connected: false, name: m.name });
    this.broadcastRoom();
    if (d.phase === 'battle') await this.maybeResolve();
    if (!d.order.some((id) => d.members[id]?.connected)) await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
  }

  // ---------------------------------------------------------------------------
  // raid flow
  // ---------------------------------------------------------------------------

  private async loadSave(userId: string): Promise<SaveData | null> {
    const row = await this.env.DB.prepare('SELECT data FROM saves WHERE user_id = ?').bind(userId).first<{ data: string }>();
    if (!row) return null;
    const save = migrateSave(JSON.parse(row.data));
    return validateSave(save).ok ? save : null;
  }

  private async startRaid() {
    const d = this.data!;
    const builds: HunterBuild[] = [];
    for (const id of d.order) {
      // stats always come from the server-side save, never from the client
      const save = await this.loadSave(id);
      if (!save) continue;
      const main = save.hunters.find((h) => h.isMain)!;
      const b = hunterBuild(main, save.inventory, id);
      b.id = `p${builds.length}`;
      b.name = save.name;
      builds.push(b);
      d.members[id].level = main.level;
    }
    if (!builds.length) return;
    const avg = Math.round(builds.reduce((s, b) => s + b.level, 0) / builds.length);
    d.seed = randomSeed();
    d.waves = raidWaves(d.config.dungeonId, d.config.difficulty, avg, d.seed, builds.length);
    d.wave = 0;
    d.defeated = [];
    d.phase = 'battle';
    this.startWave(builds);
    await this.persist();
  }

  private startWave(builds?: HunterBuild[]) {
    const d = this.data!;
    const prev = d.battle;
    let hunters: HunterBuild[];
    const carry = { hp: {} as Record<string, number>, energy: {} as Record<string, number> };
    if (builds) hunters = builds;
    else {
      // rebuild from previous battle units, carrying HP/energy between waves
      hunters = prev!.units.filter((u) => u.side === 'ally').map((u) => ({ id: u.templateId, name: u.name, level: u.level, stats: u.stats, weaponId: u.weaponId!, weaponLevel: u.counters.weaponLevel ?? 0, element: u.element, skills: u.skills, ultimate: u.ultimate!, passives: u.passives, look: u.look, ownerId: u.ownerId }));
      for (const u of prev!.units) if (u.side === 'ally') {
        carry.hp[u.templateId] = u.alive ? u.hp : Math.round(u.stats.hp * 0.25);
        carry.energy[u.templateId] = u.energy;
      }
    }
    const bags: Record<string, Record<string, number>> = {};
    for (const h of hunters) bags[h.ownerId!] = prev?.bags[h.ownerId!] ?? { ...RAID_KIT };
    const st = buildBattle({ seed: (d.seed + d.wave * 7919) >>> 0, hunters, enc: d.waves[d.wave], difficulty: d.config.difficulty, mode: 'coop', bags, carry, partyScale: coopPartyScale(hunters.length), arena: d.config.dungeonId });
    if (prev) for (const u of st.units) {
      const old = prev.units.find((x) => x.id === u.id);
      if (old && u.side === 'ally') u.ult = old.ult;
    }
    st.teamGauge = prev ? Math.round(prev.teamGauge * 0.5) : 0;
    for (const u of st.units) if (u.ownerId && !this.data!.members[u.ownerId]?.connected) u.autoControl = true;
    d.battle = st;
    d.plans = {};
    d.deadline = Date.now() + TURN_TIMER_MS;
    void this.ctx.storage.setAlarm(d.deadline);
    this.broadcast({ t: 'battle_start', wave: d.wave, waves: d.waves.length, state: publicState(st), deadline: d.deadline, peers: this.peers() });
  }

  private async onPlan(userId: string, round: number, unitId: string, action: Action | null, locked: boolean, ws: WebSocket) {
    const d = this.data!;
    const b = d.battle;
    if (d.phase !== 'battle' || !b || b.phase !== 'planning') return;
    // a stale round number means the command arrived after resolution: reject (no retroactive changes)
    if (round !== b.round) {
      this.sendTo(ws, { t: 'error', msg: 'Round already resolved' });
      return;
    }
    const u = getUnit(b, unitId);
    if (!u || u.ownerId !== userId) {
      this.sendTo(ws, { t: 'error', msg: 'Not your hunter' });
      return;
    }
    if (action) {
      const e = validateAction(b, unitId, action, userId);
      if (e) {
        this.sendTo(ws, { t: 'error', msg: e });
        return;
      }
      d.plans[unitId] = { owner: userId, action, locked: !!locked };
    } else {
      delete d.plans[unitId];
    }
    await this.persist();
    this.broadcast({ t: 'plan', owner: userId, unitId, action, locked: !!locked }, userId);
    await this.maybeResolve();
  }

  private ownersNeeded(): string[] {
    const b = this.data!.battle!;
    const owners = new Set<string>();
    for (const u of b.units) if (u.side === 'ally' && u.alive && u.onField && u.ownerId && !u.autoControl) owners.add(u.ownerId);
    return [...owners];
  }

  private async maybeResolve(force = false) {
    const d = this.data!;
    const b = d.battle;
    if (!b || d.phase !== 'battle' || b.phase !== 'planning') return;
    if (!force) {
      for (const owner of this.ownersNeeded()) {
        const units = b.units.filter((u) => u.side === 'ally' && u.alive && u.onField && u.ownerId === owner);
        if (!units.every((u) => d.plans[u.id]?.locked)) return;
      }
    }
    await this.resolve();
  }

  private async resolve() {
    const d = this.data!;
    const b = d.battle!;
    const plans: Record<string, Action> = {};
    for (const u of b.units) {
      if (u.side !== 'ally' || !u.alive || !u.onField) continue;
      const p = d.plans[u.id];
      // timed-out or disconnected players: their tentative command if valid, else AI
      plans[u.id] = p?.action ?? chooseAllyAction(b, u, b.bags[u.ownerId ?? 'local'] ?? {});
    }
    const r = resolveRound(b, plans);
    d.battle = r.state;
    d.plans = {};
    this.broadcast({ t: 'round_result', round: b.round, events: r.events, state: publicState(r.state) });
    const st = r.state;
    if (st.phase === 'ended') {
      if (st.result === 'victory') {
        for (const u of st.units) if (u.side === 'enemy' && !u.alive) d.defeated.push({ template: u.templateId, level: u.level, elite: u.isElite });
        if (d.wave < d.waves.length - 1) {
          d.wave++;
          this.broadcast({ t: 'wave_clear', wave: d.wave - 1, waves: d.waves.length });
          this.startWave();
        } else {
          await this.finishRaid(true);
        }
      } else {
        await this.finishRaid(false);
      }
    } else {
      d.deadline = Date.now() + TURN_TIMER_MS;
      await this.ctx.storage.setAlarm(d.deadline);
      this.broadcast({ t: 'round_open', state: publicState(st), deadline: d.deadline, peers: this.peers(), plans: {} });
    }
    await this.persist();
  }

  private async finishRaid(victory: boolean) {
    const d = this.data!;
    d.phase = 'done';
    const def = DUNGEON_MAP[d.config.dungeonId];
    const grantBase = `${d.code}-${d.seed.toString(36)}`;
    let summary: { credits: number; exp: number; items: number; grantId: string } | null = null;
    const stmts: D1PreparedStatement[] = [];
    d.order.forEach((uid, idx) => {
      const rng = new Rng((d.seed ^ (idx * 0x9e3779b9)) >>> 0);
      let credits = 0, exp = 0;
      const items: ItemInstance[] = [];
      for (const e of d.defeated) {
        const r = rollDrops(e.template, e.level, d.config.difficulty, rng, def.tier, e.elite);
        credits += r.credits;
        exp += r.exp;
        items.push(...r.items);
      }
      if (!victory) {
        credits = Math.round(credits * 0.3);
        exp = Math.round(exp * 0.5);
        items.length = Math.min(items.length, 2);
      }
      const capped = items.slice(0, 14);
      const id = `${grantBase}-${idx}`;
      stmts.push(this.env.DB.prepare('INSERT OR IGNORE INTO grants (id, user_id, payload, created_at) VALUES (?, ?, ?, ?)').bind(id, uid, JSON.stringify({ credits, exp, items: capped, label: `Co-op raid: ${def.name}${victory ? '' : ' (failed)'}` }), Date.now()));
      if (!summary) summary = { credits, exp, items: capped.length, grantId: id };
    });
    if (stmts.length) await this.env.DB.batch(stmts);
    const s = summary as { credits: number; exp: number; items: number; grantId: string } | null;
    this.broadcast({ t: 'raid_end', result: victory ? 'victory' : 'defeat', rewards: s });
    await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
  }

  async alarm() {
    const d = this.data;
    if (!d) return;
    if (d.phase === 'battle' && d.battle && Date.now() >= d.deadline - 50) {
      await this.maybeResolve(true);
      return;
    }
    if (Date.now() - d.lastActive >= IDLE_CLEANUP_MS - 1000 && !d.order.some((id) => d.members[id]?.connected)) {
      await this.ctx.storage.deleteAll();
      this.data = null;
    } else if (d.phase === 'done') {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_CLEANUP_MS);
    }
  }

  // ---------------------------------------------------------------------------
  // messaging
  // ---------------------------------------------------------------------------

  private roomMsg(you: string): ServerMsg {
    const d = this.data!;
    const members: MemberInfo[] = d.order.map((id) => {
      const m = d.members[id];
      return { id, name: m.name, ready: m.ready, connected: m.connected, level: m.level, weapon: m.weapon };
    });
    return { t: 'room', code: d.code, hostId: d.hostId, you, members, config: d.config, phase: d.phase };
  }

  private peers(): Record<string, { name: string }> {
    const d = this.data!;
    return Object.fromEntries(d.order.map((id) => [id, { name: d.members[id].name }]));
  }

  private publicPlans(): Record<string, PlanEntry> {
    return { ...this.data!.plans };
  }

  private sendTo(ws: WebSocket, m: ServerMsg) {
    try {
      ws.send(JSON.stringify(m));
    } catch {
      /* socket closing */
    }
  }

  private broadcast(m: ServerMsg, except?: string) {
    const raw = JSON.stringify(m);
    for (const ws of this.ctx.getWebSockets()) {
      const { userId } = (ws.deserializeAttachment() ?? {}) as { userId?: string };
      if (except && userId === except) continue;
      try {
        ws.send(raw);
      } catch {
        /* ignore */
      }
    }
  }

  private broadcastRoom() {
    for (const ws of this.ctx.getWebSockets()) {
      const { userId } = (ws.deserializeAttachment() ?? {}) as { userId?: string };
      if (userId) this.sendTo(ws, this.roomMsg(userId));
    }
  }
}
