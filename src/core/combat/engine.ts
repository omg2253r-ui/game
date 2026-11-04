/**
 * SCRAPBOUND turn-based combat engine.
 *
 * Pure & deterministic: (state, plans) -> (newState, events). The same module runs in
 * the browser (single player) and inside the Cloudflare Durable Object (co-op), where it
 * is the sole authority on turn order, damage, statuses and results. Clients only play
 * back the returned event list.
 *
 * Round flow:
 *   planning  -> every on-field ally gets one Action (players / AI), enemies' intents were
 *                planned at round start (telegraphed moves are visible to players)
 *   resolve   -> queue sorted by priority, then effective speed, then seeded tiebreak.
 *                each action may cause damage, statuses, reactions, breaks, follow-ups…
 *   round end -> DoT, status timers, armor recovery, boss mechanics, next intents.
 */
import { Rng } from '../rng';
import type { Element } from '../types';
import { ENEMY_MAP } from '../data/enemies';
import { CONSUMABLE_MAP, DEBUFFS, BUFFS } from '../data/items';
import { getSkill, type SkillDef, type TargetMode } from '../data/skills';
import { WEAPON_MAP, weaponSkillBonus } from '../data/weapons';
import type { Action, BattleConfig, BattleEvent, BattleState, RoundResult, StatusId, StatusInst, Unit } from './types';
import { makeEnemyUnit } from './units';
import { planEnemyIntent } from './ai';

export const TEAM_COMBO_COST = 30;
export const TEAM_ULT_COST = 100;
export const ELEMENT_STATUS: Record<Element, StatusId | null> = {
  physical: null,
  electric: 'shock',
  fire: 'burn',
  ice: 'chill',
  plasma: 'ionized',
  gravity: 'crushed',
  quantum: 'entangled',
};

interface Reaction {
  name: string;
  pairs: [Element, StatusId][];
  effect: string;
  consume: boolean;
}

/** order matters: first match wins */
export const REACTIONS: Reaction[] = [
  { name: 'Plasma Burst', pairs: [['electric', 'ionized'], ['plasma', 'shock']], effect: 'plasma_burst', consume: true },
  { name: 'Shatter', pairs: [['physical', 'frozen'], ['gravity', 'frozen']], effect: 'shatter', consume: true },
  { name: 'Thermal Shock', pairs: [['fire', 'chill'], ['fire', 'frozen'], ['ice', 'burn']], effect: 'thermal', consume: true },
  { name: 'Superconduct', pairs: [['electric', 'chill'], ['ice', 'shock']], effect: 'superconduct', consume: true },
  { name: 'Overload', pairs: [['fire', 'shock'], ['electric', 'burn']], effect: 'overload', consume: true },
  { name: 'Fusion Flare', pairs: [['plasma', 'burn'], ['fire', 'ionized']], effect: 'fusion', consume: true },
  { name: 'Singularity', pairs: [['gravity', 'entangled'], ['quantum', 'crushed']], effect: 'singularity', consume: true },
  { name: 'Quantum Echo', pairs: [['quantum', 'shock'], ['quantum', 'burn'], ['quantum', 'ionized'], ['quantum', 'chill']], effect: 'echo', consume: false },
  { name: 'Compression', pairs: [['gravity', 'shock'], ['gravity', 'burn'], ['gravity', 'ionized'], ['gravity', 'chill']], effect: 'spread', consume: false },
];

const STATUS_ELEMENT: Partial<Record<StatusId, Element>> = { shock: 'electric', burn: 'fire', chill: 'ice', ionized: 'plasma', frozen: 'ice' };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

interface Ctx {
  s: BattleState;
  rng: Rng;
  ev: BattleEvent[];
  followUps: { unit: string; target: string; power: number; element: Element; label: string }[];
  ended: boolean;
  comboOk?: Set<string>;
}

export function cloneState(s: BattleState): BattleState {
  return JSON.parse(JSON.stringify(s));
}

export function getUnit(s: BattleState, id: string | undefined): Unit | undefined {
  return id ? s.units.find((u) => u.id === id) : undefined;
}

export function hasStatus(u: Unit, id: StatusId): StatusInst | undefined {
  return u.statuses.find((x) => x.id === id);
}

export function living(s: BattleState, side: 'ally' | 'enemy'): Unit[] {
  return s.units.filter((u) => u.side === side && u.alive && u.onField);
}

function opponents(s: BattleState, u: Unit): Unit[] {
  return living(s, u.side === 'ally' ? 'enemy' : 'ally');
}
function friends(s: BattleState, u: Unit): Unit[] {
  return living(s, u.side);
}

export function effSpd(u: Unit): number {
  let m = 1;
  if (hasStatus(u, 'spd_up')) m += 0.2;
  if (hasStatus(u, 'spd_down')) m -= 0.2;
  const chill = hasStatus(u, 'chill');
  if (chill) m -= 0.15 * chill.stacks;
  if (hasStatus(u, 'crushed')) m -= 0.1;
  return Math.max(1, u.stats.spd * Math.max(0.3, m));
}

export function effAtk(u: Unit): number {
  let m = 1;
  if (hasStatus(u, 'atk_up')) m += 0.25;
  if (hasStatus(u, 'atk_down')) m -= 0.25;
  if (u.passives.includes('last_stand') && u.hp < u.stats.hp * 0.4) m += 0.3;
  const melt = hasStatus(u, 'meltdown');
  if (melt) m += 0.12 * melt.stacks;
  return u.stats.atk * m;
}

export function effDef(u: Unit): number {
  let m = 1;
  if (hasStatus(u, 'def_up')) m += 0.3;
  if (hasStatus(u, 'ionized')) m -= 0.15;
  if (hasStatus(u, 'crushed')) m -= 0.2;
  if (hasStatus(u, 'superconduct')) m -= 0.4;
  return u.stats.def * Math.max(0.1, m);
}

function emit(c: Ctx, e: BattleEvent) {
  c.ev.push(e);
}

function snapshot(u: Unit) {
  return { hp: u.hp, maxHp: u.stats.hp, armor: u.armor, maxArmor: u.maxArmor, energy: u.energy, ult: u.ult, alive: u.alive };
}

function gainTeam(c: Ctx, amount: number) {
  const before = c.s.teamGauge;
  c.s.teamGauge = Math.min(100, c.s.teamGauge + amount);
  if (c.s.teamGauge !== before) emit(c, { t: 'team', value: c.s.teamGauge });
}

function gainEnergy(u: Unit, amount: number) {
  if (u.side !== 'ally') return;
  u.energy = Math.max(0, Math.min(u.stats.energy, u.energy + amount));
}
function gainUlt(u: Unit, amount: number) {
  if (u.side !== 'ally' || !u.ultimate) return;
  u.ult = Math.max(0, Math.min(100, u.ult + amount));
}

// ---------------------------------------------------------------------------
// statuses
// ---------------------------------------------------------------------------

export function applyStatus(c: Ctx, dst: Unit, id: StatusId, turns: number, stacks = 1, value?: number, src?: Unit, data?: string) {
  if (!dst.alive) return;
  const el = STATUS_ELEMENT[id];
  if (el && dst.profile.immune.includes(el)) return;
  if (dst.isBoss && id === 'hacked') return;
  if (id === 'frozen' && dst.counters.freezeImmune > 0) return;
  const existing = hasStatus(dst, id);
  if (id === 'chill') {
    const total = (existing?.stacks ?? 0) + stacks;
    if (total >= 2) {
      dst.statuses = dst.statuses.filter((x) => x.id !== 'chill');
      if (dst.counters.freezeImmune > 0) {
        dst.statuses.push({ id: 'chill', turns, stacks: 1, source: src?.id });
      } else {
        dst.statuses.push({ id: 'frozen', turns: 2, stacks: 1, source: src?.id });
        if (dst.isBoss) dst.counters.freezeImmune = 3;
        emit(c, { t: 'status', dst: dst.id, status: 'frozen', on: true });
      }
      return;
    }
  }
  if (existing) {
    existing.turns = Math.max(existing.turns, turns);
    if (id === 'meltdown') existing.stacks = Math.min(5, existing.stacks + stacks);
    else if (id === 'chill') existing.stacks = Math.min(2, existing.stacks + stacks);
    if (value !== undefined) existing.value = id === 'shield' ? (existing.value ?? 0) + value : Math.max(existing.value ?? 0, value);
    if (data) existing.data = data;
  } else {
    dst.statuses.push({ id, turns, stacks, value, source: src?.id, data });
  }
  emit(c, { t: 'status', dst: dst.id, status: id, on: true, stacks: hasStatus(dst, id)?.stacks ?? stacks });
}

export function removeStatus(c: Ctx, dst: Unit, id: StatusId) {
  if (!hasStatus(dst, id)) return;
  dst.statuses = dst.statuses.filter((x) => x.id !== id);
  emit(c, { t: 'status', dst: dst.id, status: id, on: false });
}

function dotValue(id: StatusId, src: Unit | undefined): number | undefined {
  if (!src) return undefined;
  if (id === 'burn') return Math.round(effAtk(src) * 0.45);
  if (id === 'shock') return Math.round(effAtk(src) * 0.3);
  return undefined;
}

// ---------------------------------------------------------------------------
// damage
// ---------------------------------------------------------------------------

interface HitOpts {
  power: number;
  element: Element;
  armorDmg: number;
  ignoreDef?: number;
  single?: boolean; // single-target (evasion applies)
  fixed?: number; // fixed base damage instead of ATK * power
  noReaction?: boolean;
  isReaction?: boolean;
  isEcho?: boolean;
  noCrit?: boolean;
  executeBonus?: number;
  label?: string;
  followUp?: boolean;
  skillBonus?: number;
}

export function hit(c: Ctx, src: Unit, dst: Unit, o: HitOpts): number {
  const s = c.s;
  if (!dst.alive || c.ended) return 0;

  // evasion (Dodge command)
  if (o.single && hasStatus(dst, 'evasion') && c.rng.chance(0.7)) {
    emit(c, { t: 'dodge', src: src.id, dst: dst.id });
    gainEnergy(dst, 5);
    return 0;
  }
  // Phase Shift passive
  if (dst.passives.includes('phase_shift') && !dst.counters.phaseUsed && src.side !== dst.side) {
    dst.counters.phaseUsed = 1;
    emit(c, { t: 'phase_shift', dst: dst.id });
    return 0;
  }
  if (dst.profile.immune.includes(o.element)) {
    emit(c, { t: 'immune', src: src.id, dst: dst.id, element: o.element });
    return 0;
  }

  const base = o.fixed ?? effAtk(src) * o.power * (1 + (o.skillBonus ?? 0));
  const def = effDef(dst) * (1 - (o.ignoreDef ?? 0));
  let dmg = base * (120 / (120 + def));

  const weak = dst.profile.weak.includes(o.element);
  const resist = dst.profile.resist.includes(o.element);
  if (weak) dmg *= 1.5;
  if (resist) dmg *= 0.5;
  if (o.element !== 'physical') dmg *= 1 + src.stats.elemBonus;

  let crit = false;
  if (!o.noCrit) {
    let rate = src.stats.critRate;
    if (hasStatus(dst, 'weakpoint')) rate += 0.3;
    if (c.rng.chance(Math.min(0.95, rate))) {
      crit = true;
      dmg *= 1 + src.stats.critDmg;
    }
  }

  // chain (consecutive ally hits on the same target in one round)
  let chain = 0;
  if (src.side === 'ally' && dst.side === 'enemy' && !o.isEcho) {
    chain = (s.chain[dst.id] ?? 0) + 1;
    s.chain[dst.id] = chain;
    s.stats.maxChain = Math.max(s.stats.maxChain, chain);
    const master = src.passives.includes('chain_master');
    const cap = master ? 8 : 5;
    dmg *= 1 + Math.min(chain - 1, cap) * (master ? 0.15 : 0.1);
    if (chain > 1 && chain % 5 === 0) gainTeam(c, 5);
  }

  if (hasStatus(dst, 'broken')) dmg *= 1.25;
  if (hasStatus(dst, 'guard')) dmg *= 0.5;
  if (hasStatus(dst, 'barrier')) dmg *= 0.2;
  const lowHp = dst.hp < dst.stats.hp * 0.3;
  if (lowHp && src.passives.includes('reaper')) dmg *= 1.3;
  if (lowHp && o.executeBonus) dmg *= 1 + o.executeBonus;

  dmg *= c.rng.range(0.94, 1.06);
  let amount = Math.max(1, Math.round(dmg));

  // shields absorb first
  let absorbed = 0;
  const sh = hasStatus(dst, 'shield');
  if (sh && sh.value) {
    absorbed = Math.min(sh.value, amount);
    sh.value -= absorbed;
    amount -= absorbed;
    if (sh.value <= 0) dst.statuses = dst.statuses.filter((x) => x !== sh);
  }

  const hadStatuses = dst.statuses.map((x) => x.id);
  dst.hp = Math.max(0, dst.hp - amount);
  emit(c, {
    t: 'dmg', src: src.id, dst: dst.id, amount, absorbed, crit, weak, resist, element: o.element, chain,
    reaction: o.isReaction ? o.label : undefined, follow: o.followUp || undefined, echo: o.isEcho || undefined, ...snapshot(dst),
  });

  // energy / ult gains
  if (src.side === 'ally') {
    gainUlt(src, 4 + (crit ? 2 : 0));
    if (src.passives.includes('energy_siphon')) gainEnergy(src, 6);
    if (weak) gainTeam(c, 3);
  } else {
    gainEnergy(dst, 5);
    gainUlt(dst, 6);
  }

  // armor / break
  if (dst.maxArmor > 0 && dst.armor > 0 && !hasStatus(dst, 'broken') && o.armorDmg > 0) {
    let a = o.armorDmg;
    if (weak) a *= 2;
    if (o.element === 'physical') a *= 1.5;
    if (src.passives.includes('breaker')) a *= 1.5;
    dst.armor = Math.max(0, Math.round(dst.armor - a));
    emit(c, { t: 'armor', dst: dst.id, armor: dst.armor, maxArmor: dst.maxArmor });
    if (dst.armor <= 0 && dst.hp > 0) breakUnit(c, dst, src);
  }

  // Reactor Beast: ice hits remove meltdown stacks
  if (o.element === 'ice') {
    const melt = hasStatus(dst, 'meltdown');
    if (melt && melt.stacks > 0) {
      melt.stacks -= 1;
      emit(c, { t: 'status', dst: dst.id, status: 'meltdown', on: melt.stacks > 0, stacks: melt.stacks });
      if (melt.stacks <= 0) dst.statuses = dst.statuses.filter((x) => x !== melt);
    }
  }

  if (dst.hp <= 0) {
    kill(c, dst, src);
    return amount;
  }

  // elemental reactions (only on machines - the tactical layer belongs to the hunters)
  if (!o.noReaction && dst.side === 'enemy' && src.side === 'ally') {
    triggerReaction(c, src, dst, o.element, hadStatuses);
  }

  // entangled echo
  const ent = hasStatus(dst, 'entangled');
  if (ent && !o.isEcho && !o.isReaction && dst.alive && src.side !== dst.side) {
    dst.statuses = dst.statuses.filter((x) => x !== ent);
    emit(c, { t: 'status', dst: dst.id, status: 'entangled', on: false });
    hit(c, src, dst, { power: 0, fixed: amount * 0.4 * (120 + effDef(dst)) / 120, element: 'quantum', armorDmg: 5, noReaction: true, isEcho: true, noCrit: true, label: 'Quantum Echo' });
  }

  if (dst.alive) checkPhase(c, dst);

  // follow-up passives (queued; executed after the current action)
  if (src.side === 'ally' && dst.alive && !o.followUp && hasStatus(dst, 'shock')) {
    for (const ally of friends(s, src)) {
      if (ally.id !== src.id && ally.passives.includes('followup_shock') && !ally.flags.followUsed) {
        ally.flags.followUsed = 1;
        c.followUps.push({ unit: ally.id, target: dst.id, power: 0.6, element: 'electric', label: 'Static Echo' });
      }
    }
  }
  return amount;
}

function breakUnit(c: Ctx, dst: Unit, src: Unit) {
  dst.armor = 0;
  dst.statuses.push({ id: 'broken', turns: 2, stacks: 1, source: src.id });
  dst.flags.stunned = 1;
  c.s.stats.breaks++;
  emit(c, { t: 'break', src: src.id, dst: dst.id });
  gainTeam(c, 20);
  // interrupts
  if (hasStatus(dst, 'charging')) {
    dst.statuses = dst.statuses.filter((x) => x.id !== 'charging');
    delete c.s.intents[dst.id];
    emit(c, { t: 'interrupt', dst: dst.id });
  }
  const cd = hasStatus(dst, 'countdown');
  if (cd) {
    cd.value = 3;
    emit(c, { t: 'countdown', dst: dst.id, value: 3, reset: true });
  }
  for (const ally of friends(c.s, src)) {
    if (ally.passives.includes('overwatch') && !ally.flags.overwatchUsed) {
      ally.flags.overwatchUsed = 1;
      c.followUps.push({ unit: ally.id, target: dst.id, power: 0.8, element: 'electric', label: 'Overwatch' });
    }
  }
}

function kill(c: Ctx, dst: Unit, src: Unit) {
  dst.alive = false;
  dst.hp = 0;
  dst.statuses = [];
  emit(c, { t: 'death', src: src.id, dst: dst.id });
  if (dst.side === 'enemy') {
    c.s.kills[dst.templateId] = (c.s.kills[dst.templateId] ?? 0) + 1;
    gainTeam(c, 5);
    if (src.passives.includes('reaper')) gainEnergy(src, 20);
    // Data Shield falls when no drones remain
    if (dst.templateId === 'memory_drone') {
      const drones = living(c.s, 'enemy').filter((u) => u.templateId === 'memory_drone');
      if (drones.length === 0) {
        for (const b of living(c.s, 'enemy')) {
          if (hasStatus(b, 'barrier')) {
            removeStatus(c, b, 'barrier');
            emit(c, { t: 'barrier_down', dst: b.id });
          }
        }
      }
    }
  }
  checkEnd(c);
}

function checkPhase(c: Ctx, u: Unit) {
  const def = ENEMY_MAP[u.templateId];
  if (!def?.phases) return;
  const next = def.phases[u.phase + 1];
  if (!next || u.hp / u.stats.hp > next.at) return;
  u.phase += 1;
  u.skills = [...next.skills];
  emit(c, { t: 'phase', dst: u.id, phase: u.phase, name: next.name, line: next.line });
  const fx = next.onEnter;
  if (fx.restoreArmor) {
    u.armor = u.maxArmor;
    u.statuses = u.statuses.filter((x) => x.id !== 'broken');
    u.flags.stunned = 0;
    emit(c, { t: 'armor', dst: u.id, armor: u.armor, maxArmor: u.maxArmor, restore: true });
  }
  for (const b of fx.buff ?? []) applyStatus(c, u, b as StatusId, 3, 1, undefined, u);
  if (fx.profile) {
    u.profile = { weak: fx.profile.weak ?? [], resist: fx.profile.resist ?? [], immune: fx.profile.immune ?? [] };
    u.scanned = false;
    emit(c, { t: 'adapt', dst: u.id });
  }
  if (fx.adapt) adapt(c, u);
  if (fx.summon) summon(c, u, fx.summon.template, fx.summon.count);
  if (fx.countdown) {
    applyStatus(c, u, 'countdown', -1, 1, 3, u);
    emit(c, { t: 'countdown', dst: u.id, value: 3 });
  }
  // a new phase drops any pending charged attack
  if (hasStatus(u, 'charging')) removeStatus(c, u, 'charging');
}

function adapt(c: Ctx, u: Unit) {
  const pool: Element[] = ['physical', 'electric', 'fire', 'ice', 'plasma', 'gravity', 'quantum'];
  const choices = c.rng.shuffle(pool.filter((e) => !u.profile.weak.includes(e) && e !== u.element));
  u.profile = { weak: choices.slice(0, 2), resist: [...u.profile.weak], immune: [] };
  u.scanned = false;
  u.statuses = u.statuses.filter((x) => x.id !== 'weakpoint');
  emit(c, { t: 'adapt', dst: u.id });
}

function summon(c: Ctx, owner: Unit, template: string, count: number) {
  const s = c.s;
  const current = living(s, 'enemy').length;
  const n = Math.min(count, Math.max(0, 5 - current));
  for (let i = 0; i < n; i++) {
    s.spawnCounter++;
    const lvl = Math.max(1, owner.level - 1);
    const u = makeEnemyUnit(template, lvl, s.difficulty, 10 + s.spawnCounter, { idPrefix: 's' });
    u.slot = 10 + s.spawnCounter;
    s.units.push(u);
    emit(c, { t: 'summon', src: owner.id, dst: u.id, unit: JSON.parse(JSON.stringify(u)) });
  }
}

function triggerReaction(c: Ctx, src: Unit, dst: Unit, element: Element, before: StatusId[]) {
  for (const r of REACTIONS) {
    const pair = r.pairs.find(([e, st]) => e === element && before.includes(st) && hasStatus(dst, st));
    if (!pair) continue;
    const st = pair[1];
    if (r.consume) {
      dst.statuses = dst.statuses.filter((x) => x.id !== st);
      emit(c, { t: 'status', dst: dst.id, status: st, on: false });
    }
    c.s.stats.reactions++;
    emit(c, { t: 'reaction', src: src.id, dst: dst.id, name: r.name, effect: r.effect });
    gainTeam(c, 10);
    for (const ally of friends(c.s, src)) {
      if (ally.id !== src.id && ally.passives.includes('followup_protocol') && !ally.flags.protoUsed) {
        ally.flags.protoUsed = 1;
        c.followUps.push({ unit: ally.id, target: dst.id, power: 0.5, element: ally.element, label: 'Follow-up Protocol' });
      }
    }
    gainUlt(src, 6);
    const R = { noReaction: true, isReaction: true, label: r.name, noCrit: true } as const;
    switch (r.effect) {
      case 'plasma_burst': {
        const d = hit(c, src, dst, { ...R, power: 1.2, element: 'plasma', armorDmg: 30 });
        for (const o of living(c.s, 'enemy')) if (o.id !== dst.id) hit(c, src, o, { ...R, power: 0, fixed: d * 0.5 * (120 + effDef(o)) / 120, element: 'plasma', armorDmg: 10 });
        break;
      }
      case 'shatter':
        hit(c, src, dst, { ...R, power: 2.0, element: 'physical', armorDmg: 40 });
        break;
      case 'thermal':
        hit(c, src, dst, { ...R, power: 0.8, element: 'fire', armorDmg: 60 });
        break;
      case 'superconduct':
        applyStatus(c, dst, 'superconduct', 2, 1, undefined, src);
        hit(c, src, dst, { ...R, power: 0.5, element: 'ice', armorDmg: 20 });
        break;
      case 'overload':
        for (const o of living(c.s, 'enemy')) hit(c, src, o, { ...R, power: 0.9, element: 'fire', armorDmg: 15 });
        break;
      case 'fusion':
        hit(c, src, dst, { ...R, power: 1.5, element: 'fire', armorDmg: 20 });
        if (dst.alive) applyStatus(c, dst, 'burn', 3, 1, dotValue('burn', src), src);
        break;
      case 'singularity':
        for (const o of living(c.s, 'enemy')) {
          hit(c, src, o, { ...R, power: 0.9, element: 'gravity', armorDmg: 20 });
          if (o.alive) applyStatus(c, o, 'delay', 2, 1, undefined, src);
        }
        break;
      case 'echo': {
        const el = STATUS_ELEMENT[st] ?? 'quantum';
        hit(c, src, dst, { ...R, power: 0.8, element: el, armorDmg: 15 });
        break;
      }
      case 'spread': {
        const inst = hasStatus(dst, st);
        for (const o of living(c.s, 'enemy')) if (o.id !== dst.id) applyStatus(c, o, st, inst?.turns ?? 2, 1, inst?.value, src);
        hit(c, src, dst, { ...R, power: 0.4, element: 'gravity', armorDmg: 25 });
        break;
      }
    }
    return; // one reaction per hit
  }
}

function checkEnd(c: Ctx) {
  const s = c.s;
  if (s.phase === 'ended') return;
  const enemies = s.units.filter((u) => u.side === 'enemy' && u.alive);
  const allies = s.units.filter((u) => u.side === 'ally' && u.alive);
  if (enemies.length === 0) finish(c, 'victory');
  else if (allies.length === 0) finish(c, 'defeat');
}

function finish(c: Ctx, result: 'victory' | 'defeat' | 'fled') {
  c.s.phase = 'ended';
  c.s.result = result;
  c.ended = true;
  emit(c, { t: 'end', result });
}

// ---------------------------------------------------------------------------
// targeting
// ---------------------------------------------------------------------------

function resolveTargets(c: Ctx, u: Unit, mode: TargetMode, targetId?: string, randomHits = 1): Unit[] {
  const s = c.s;
  const opp = opponents(s, u);
  const fr = friends(s, u);
  switch (mode) {
    case 'enemy': {
      const t = getUnit(s, targetId);
      if (t && t.alive && t.onField && t.side !== u.side) return [t];
      return opp.length ? [c.rng.pick(opp)] : [];
    }
    case 'all_enemies':
      return opp;
    case 'random_enemies': {
      const out: Unit[] = [];
      for (let i = 0; i < randomHits && opp.length; i++) out.push(c.rng.pick(opp));
      return out;
    }
    case 'ally': {
      const t = getUnit(s, targetId);
      if (t && t.alive && t.onField && t.side === u.side) return [t];
      const sorted = [...fr].sort((a, b) => a.hp / a.stats.hp - b.hp / b.stats.hp);
      return sorted.length ? [sorted[0]] : [];
    }
    case 'all_allies':
      return fr;
    case 'self':
      return [u];
    case 'dead_ally': {
      const t = getUnit(s, targetId);
      if (t && !t.alive && t.side === u.side) return [t];
      const dead = s.units.filter((x) => x.side === u.side && !x.alive && x.onField);
      return dead.length ? [dead[0]] : [];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// skills
// ---------------------------------------------------------------------------

function skillBonusFor(u: Unit): number {
  return u.counters.weaponLevel ? weaponSkillBonus(u.counters.weaponLevel) : 0;
}

export function useSkill(c: Ctx, u: Unit, sk: SkillDef, targetId?: string, opts: { label?: string; powerMult?: number; anim?: string } = {}) {
  const targets = resolveTargets(c, u, sk.target, targetId, sk.randomHits ?? 1);
  emit(c, {
    t: 'action', src: u.id, name: opts.label ?? sk.name, skill: sk.id, anim: opts.anim ?? sk.anim, vfx: sk.vfx, element: sk.element,
    targets: [...new Set(targets.map((x) => x.id))], telegraph: sk.telegraph || undefined,
  });
  if (sk.cooldown) u.cooldowns[sk.id] = sk.cooldown + 1;

  const powerMult = (opts.powerMult ?? 1) * (sk.special === 'meltdown_scale' ? 1 + 0.35 * (hasStatus(u, 'meltdown')?.stacks ?? 0) : 1);
  const bonus = u.side === 'ally' ? skillBonusFor(u) : 0;

  for (const t of targets) {
    if (c.ended) break;
    if (sk.power > 0) {
      for (let h = 0; h < (sk.hits ?? 1); h++) {
        if (!t.alive || c.ended) break;
        hit(c, u, t, {
          power: sk.power * powerMult, element: sk.element, armorDmg: sk.armorDmg, ignoreDef: sk.ignoreDef,
          single: sk.target === 'enemy' || sk.target === 'random_enemies', executeBonus: sk.executeBonus, skillBonus: bonus,
        });
      }
    }
    if (!t.alive && sk.target !== 'dead_ally') continue;
    for (const a of sk.apply ?? []) {
      if (a.self || a.party) continue;
      if (c.rng.chance(a.chance)) applyStatus(c, t, a.status, a.turns, a.stacks ?? 1, a.value ?? dotValue(a.status, u), u);
    }
    if (sk.delay && t.alive) applyStatus(c, t, 'delay', 2, 1, undefined, u);
    if (sk.haste && t.alive) applyStatus(c, t, 'haste', 2, 1, undefined, u);
    if (sk.dispel) for (const b of BUFFS) if (hasStatus(t, b)) removeStatus(c, t, b);
    if (sk.heal && t.alive) heal(c, t, t.stats.hp * sk.heal, u);
    if (sk.shield && t.alive) applyStatus(c, t, 'shield', 3, 1, Math.round(u.stats.hp * sk.shield), u);
    if (sk.energyGain) {
      gainEnergy(t, sk.energyGain);
      emit(c, { t: 'energy', dst: t.id, ...snapshot(t) });
    }
    if (sk.revive && !t.alive) revive(c, t, sk.revive, u);
    if (sk.cleanse) cleanse(c, t);
  }
  for (const a of sk.apply ?? []) {
    if (a.self) applyStatus(c, u, a.status, a.turns, a.stacks ?? 1, a.value, u);
    if (a.party) for (const f of friends(c.s, u)) applyStatus(c, f, a.status, a.status === 'haste' ? 2 : a.turns, 1, undefined, u);
  }
  if (sk.healParty) for (const f of friends(c.s, u)) heal(c, f, f.stats.hp * sk.healParty, u);
  if (sk.summon) summon(c, u, sk.summon.template, sk.summon.count);
  if (sk.charge) {
    applyStatus(c, u, 'charging', sk.charge.turns + 1, 1, undefined, u, sk.charge.release);
    emit(c, { t: 'charging', src: u.id, release: sk.charge.release, name: getSkill(sk.charge.release).name });
  }
  switch (sk.special) {
    case 'restore_armor':
      if (!hasStatus(u, 'broken')) {
        u.armor = Math.min(u.maxArmor, u.armor + Math.round(u.maxArmor * 0.5));
        emit(c, { t: 'armor', dst: u.id, armor: u.armor, maxArmor: u.maxArmor, restore: true });
      }
      break;
    case 'data_shield':
      if (living(c.s, 'enemy').some((x) => x.templateId === 'memory_drone')) applyStatus(c, u, 'barrier', -1, 1, undefined, u);
      break;
    case 'adapt':
      adapt(c, u);
      break;
    case 'reset_meltdown':
      removeStatus(c, u, 'meltdown');
      break;
    case 'start_countdown':
      if (!hasStatus(u, 'countdown')) applyStatus(c, u, 'countdown', -1, 1, 3, u);
      break;
  }
}

function heal(c: Ctx, t: Unit, amount: number, src?: Unit) {
  if (!t.alive) return;
  const before = t.hp;
  t.hp = Math.min(t.stats.hp, Math.round(t.hp + amount));
  emit(c, { t: 'heal', src: src?.id, dst: t.id, amount: t.hp - before, ...snapshot(t) });
}

function revive(c: Ctx, t: Unit, frac: number, src?: Unit) {
  if (t.alive) return;
  t.alive = true;
  t.hp = Math.max(1, Math.round(t.stats.hp * frac));
  t.statuses = [];
  emit(c, { t: 'revive', src: src?.id, dst: t.id, ...snapshot(t) });
}

function cleanse(c: Ctx, t: Unit) {
  for (const d of DEBUFFS) if (hasStatus(t, d)) removeStatus(c, t, d);
}

// ---------------------------------------------------------------------------
// planning helpers / validation
// ---------------------------------------------------------------------------

export function actionPriority(s: BattleState, u: Unit, a: Action): number {
  let p = 0;
  switch (a.type) {
    case 'team_ultimate':
      p = 5;
      break;
    case 'switch':
      p = 4;
      break;
    case 'defend':
    case 'dodge':
      p = 3;
      break;
    case 'item':
    case 'flee':
      p = 1;
      break;
    case 'skill':
      p = getSkill(a.skillId).priority ?? 0;
      break;
    case 'enemy':
      p = getSkill(a.skillId).priority ?? 0;
      break;
  }
  if (p < 3) {
    if (hasStatus(u, 'haste')) p += 1;
    if (hasStatus(u, 'delay')) p -= 1;
  }
  void s;
  return p;
}

export interface OrderEntry {
  id: string;
  priority: number;
  spd: number;
  skip?: string;
}

/** predicted resolution order for the coming round (deterministic tiebreak by id for display) */
export function predictOrder(s: BattleState, plans: Record<string, Action>): OrderEntry[] {
  const out: OrderEntry[] = [];
  for (const u of s.units) {
    if (!u.alive || !u.onField) continue;
    const a = u.side === 'enemy' ? s.intents[u.id] : plans[u.id];
    const pr = a ? actionPriority(s, u, a) : 0;
    let skip: string | undefined;
    if (u.flags.stunned) skip = 'Broken';
    else if (hasStatus(u, 'frozen')) skip = 'Frozen';
    out.push({ id: u.id, priority: pr, spd: effSpd(u), skip });
  }
  out.sort((a, b) => b.priority - a.priority || b.spd - a.spd || (a.id < b.id ? -1 : 1));
  return out;
}

export function bagFor(s: BattleState, u: Unit): Record<string, number> {
  const key = u.ownerId ?? 'local';
  if (!s.bags[key]) s.bags[key] = {};
  return s.bags[key];
}

export function validateAction(s: BattleState, unitId: string, a: Action, ownerId?: string): string | null {
  if (s.phase !== 'planning') return 'Battle is not accepting commands';
  const u = getUnit(s, unitId);
  if (!u) return 'Unknown unit';
  if (u.side !== 'ally') return 'Not your unit';
  if (ownerId !== undefined && u.ownerId !== ownerId) return 'You do not control this unit';
  if (!u.alive || !u.onField) return 'Unit cannot act';
  const enemyTarget = (id: string | undefined) => {
    const t = getUnit(s, id);
    return !!t && t.side === 'enemy' && t.alive && t.onField;
  };
  switch (a.type) {
    case 'attack':
      return enemyTarget(a.target) ? null : 'Invalid target';
    case 'scan':
      return enemyTarget(a.target) ? null : 'Invalid target';
    case 'skill': {
      if (!u.skills.includes(a.skillId)) return 'Skill not known';
      const sk = getSkill(a.skillId);
      if ((sk.energyCost ?? 0) > u.energy) return 'Not enough energy';
      if ((u.cooldowns[a.skillId] ?? 0) > 0) return 'Skill on cooldown';
      return validateTarget(s, u, sk.target, a.target);
    }
    case 'ultimate': {
      if (!u.ultimate) return 'No ultimate';
      if (u.ult < 100) return 'Ultimate not charged';
      return validateTarget(s, u, getSkill(u.ultimate).target, a.target);
    }
    case 'defend':
    case 'dodge':
    case 'pass':
      return null;
    case 'item': {
      const def = CONSUMABLE_MAP[a.itemId];
      if (!def) return 'Unknown item';
      if ((bagFor(s, u)[a.itemId] ?? 0) <= 0) return 'No item left';
      return validateTarget(s, u, def.target, a.target);
    }
    case 'switch': {
      if (s.mode !== 'single') return 'Switching is single-player only';
      const r = getUnit(s, a.reserveId);
      if (!r || r.side !== 'ally' || r.onField || !r.alive) return 'Invalid reserve';
      return null;
    }
    case 'combo': {
      if (s.teamGauge < TEAM_COMBO_COST) return 'Team gauge too low';
      const p = getUnit(s, a.partner);
      if (!p || p.id === u.id || p.side !== 'ally' || !p.alive || !p.onField) return 'Invalid partner';
      return enemyTarget(a.target) ? null : 'Invalid target';
    }
    case 'team_ultimate':
      return s.teamGauge >= TEAM_ULT_COST ? null : 'Team gauge not full';
    case 'flee':
      return s.canFlee ? null : 'Cannot flee from this battle';
    default:
      return 'Illegal action';
  }
}

function validateTarget(s: BattleState, u: Unit, mode: TargetMode | 'ally' | 'dead_ally' | 'enemy' | 'all_enemies', target?: string): string | null {
  if (mode === 'enemy') {
    const t = getUnit(s, target);
    return t && t.side !== u.side && t.alive && t.onField ? null : 'Invalid target';
  }
  if (mode === 'ally') {
    const t = getUnit(s, target);
    return t && t.side === u.side && t.alive && t.onField ? null : 'Invalid ally';
  }
  if (mode === 'dead_ally') {
    const t = getUnit(s, target);
    return t && t.side === u.side && !t.alive ? null : 'Target is not downed';
  }
  return null;
}

/** validate a whole plan set: also checks item counts across multiple users of the same bag */
export function validatePlans(s: BattleState, plans: Record<string, Action>): Record<string, string> {
  const errors: Record<string, string> = {};
  const itemUse: Record<string, number> = {};
  for (const [id, a] of Object.entries(plans)) {
    const e = validateAction(s, id, a);
    if (e) errors[id] = e;
    if (a.type === 'item') {
      const u = getUnit(s, id)!;
      const key = (u?.ownerId ?? 'local') + ':' + a.itemId;
      itemUse[key] = (itemUse[key] ?? 0) + 1;
      if (u && itemUse[key] > (bagFor(s, u)[a.itemId] ?? 0)) errors[id] = 'Not enough items';
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// battle lifecycle
// ---------------------------------------------------------------------------

export function createBattle(cfg: BattleConfig): BattleState {
  const s: BattleState = {
    id: `b${cfg.seed.toString(36)}`,
    round: 1,
    phase: 'planning',
    units: [...cfg.allies, ...cfg.enemies].map((u) => JSON.parse(JSON.stringify(u))),
    teamGauge: 0,
    rng: cfg.seed >>> 0,
    intents: {},
    difficulty: cfg.difficulty,
    mode: cfg.mode,
    canFlee: cfg.canFlee,
    bags: JSON.parse(JSON.stringify(cfg.bags)),
    used: {},
    kills: {},
    spawnCounter: 0,
    label: cfg.label,
    arena: cfg.arena,
    chain: {},
    stats: { reactions: 0, breaks: 0, maxChain: 0, combos: 0, teamUlts: 0 },
  };
  // weapon level for skill bonus
  for (const u of s.units) {
    if (u.side === 'ally' && u.weaponId && u.counters.weaponLevel === undefined) u.counters.weaponLevel = 0;
  }
  const c: Ctx = { s, rng: new Rng(s.rng), ev: [], followUps: [], ended: false };
  // bosses with barrier mechanics open with their summon
  for (const u of living(s, 'enemy')) {
    if (u.templateId === 'reactor_beast') applyStatus(c, u, 'meltdown', -1, 1, undefined, u);
  }
  planIntents(c);
  s.rng = c.rng.state;
  return s;
}

function planIntents(c: Ctx) {
  const s = c.s;
  s.intents = {};
  for (const u of living(s, 'enemy')) {
    s.intents[u.id] = planEnemyIntent(s, u, c.rng);
  }
}

/** Resolve one full round. Never mutates the input state. */
export function resolveRound(input: BattleState, plans: Record<string, Action>): RoundResult {
  if (input.phase !== 'planning') return { state: input, events: [] };
  const s = cloneState(input);
  const c: Ctx = { s, rng: new Rng(s.rng), ev: [], followUps: [], ended: false };
  emit(c, { t: 'round', round: s.round });

  // sanitise plans - illegal or missing allied actions become Defend
  const finalPlans: Record<string, Action> = {};
  const errors = validatePlans(s, plans);
  for (const u of living(s, 'ally')) {
    const a = plans[u.id];
    finalPlans[u.id] = a && !errors[u.id] ? a : { type: 'defend' };
  }
  // team ultimate requires all controlling players in co-op; in single player one hunter triggers it
  const tuUsers = Object.entries(finalPlans).filter(([, a]) => a.type === 'team_ultimate').map(([id]) => id);
  let teamUltOk = tuUsers.length > 0 && s.teamGauge >= TEAM_ULT_COST;
  if (teamUltOk && s.mode === 'coop') {
    const owners = new Set(living(s, 'ally').filter((u) => u.ownerId && !u.autoControl).map((u) => u.ownerId));
    const agreed = new Set(tuUsers.map((id) => getUnit(s, id)!.ownerId));
    for (const o of owners) if (!agreed.has(o)) teamUltOk = false;
  }
  // combo partners give up their own action
  const consumed = new Set<string>();
  const comboOk = new Set<string>();
  for (const [id, a] of Object.entries(finalPlans)) {
    if (a.type !== 'combo' || consumed.has(id)) continue;
    const partnerPlan = finalPlans[a.partner];
    const reciprocal = partnerPlan?.type === 'combo' && partnerPlan.partner === id;
    const u = getUnit(s, id)!;
    const p = getUnit(s, a.partner)!;
    const sameOwner = s.mode === 'single' || u.ownerId === p.ownerId || p.autoControl;
    if (reciprocal || sameOwner) {
      consumed.add(a.partner);
      comboOk.add(id);
    }
  }
  if (teamUltOk) for (const u of living(s, 'ally')) if (u.id !== tuUsers[0]) consumed.add(u.id);
  c.comboOk = comboOk;

  const queue: { u: Unit; a: Action; pr: number; spd: number; tb: number }[] = [];
  for (const u of s.units) {
    if (!u.alive || !u.onField) continue;
    const a = u.side === 'ally' ? finalPlans[u.id] : s.intents[u.id] ?? { type: 'enemy', skillId: 'e_strike' };
    if (u.side === 'ally' && consumed.has(u.id)) continue;
    queue.push({ u, a, pr: actionPriority(s, u, a), spd: effSpd(u), tb: c.rng.next() });
  }
  queue.sort((x, y) => y.pr - x.pr || y.spd - x.spd || x.tb - y.tb);
  emit(c, { t: 'order', order: queue.map((q) => q.u.id) });

  let teamUltDone = false;
  for (const q of queue) {
    if (c.ended) break;
    const u = q.u;
    if (!u.alive || !u.onField) continue;
    if (u.flags.stunned) {
      u.flags.stunned = 0;
      emit(c, { t: 'skip', src: u.id, reason: 'Broken' });
      continue;
    }
    if (hasStatus(u, 'frozen')) {
      removeStatus(c, u, 'frozen');
      emit(c, { t: 'skip', src: u.id, reason: 'Frozen' });
      continue;
    }
    if (q.a.type === 'team_ultimate') {
      if (teamUltDone) continue;
      if (teamUltOk) {
        teamUltDone = true;
        doTeamUltimate(c, u);
        continue;
      }
      emit(c, { t: 'info', src: u.id, text: 'Team Ultimate needs every hunter to agree!' });
      q.a = { type: 'defend' };
    }
    if (hasStatus(u, 'hacked') && u.side === 'ally') {
      const others = friends(s, u).filter((x) => x.id !== u.id);
      const victim = others.length ? c.rng.pick(others) : u;
      emit(c, { t: 'action', src: u.id, name: 'HACKED!', skill: 'basic_attack', anim: 'slash', vfx: 'hack', element: 'quantum', targets: [victim.id] });
      hit(c, u, victim, { power: 0.8, element: u.element, armorDmg: 0, noReaction: true });
      removeStatus(c, u, 'hacked');
      runFollowUps(c);
      continue;
    }
    executeAction(c, u, q.a);
    runFollowUps(c);
    checkEnd(c);
  }

  if (!c.ended) endRound(c);
  s.rng = c.rng.state;
  return { state: s, events: c.ev };
}

function runFollowUps(c: Ctx) {
  let guard = 0;
  while (c.followUps.length && !c.ended && guard++ < 8) {
    const f = c.followUps.shift()!;
    const u = getUnit(c.s, f.unit);
    const t = getUnit(c.s, f.target);
    if (!u || !t || !u.alive || !t.alive || !u.onField) continue;
    emit(c, { t: 'action', src: u.id, name: f.label, skill: 'basic_attack', anim: WEAPON_MAP[u.weaponId ?? '']?.ranged ? 'shoot' : 'slash', vfx: 'electric', element: f.element, targets: [t.id], follow: true });
    hit(c, u, t, { power: f.power, element: f.element, armorDmg: 12, followUp: true, single: false });
  }
  c.followUps = [];
}

function executeAction(c: Ctx, u: Unit, a: Action) {
  const s = c.s;
  switch (a.type) {
    case 'attack': {
      const w = WEAPON_MAP[u.weaponId ?? ''];
      const t = resolveTargets(c, u, 'enemy', a.target)[0];
      emit(c, { t: 'action', src: u.id, name: 'Attack', skill: 'basic_attack', anim: w ? animForWeapon(w.cls) : 'slash', vfx: 'hit', element: u.element, targets: t ? [t.id] : [] });
      if (t) hit(c, u, t, { power: 1, element: u.element, armorDmg: 12, single: true });
      if (t && t.alive && c.rng.chance(0.25)) {
        const st = ELEMENT_STATUS[u.element];
        if (st) applyStatus(c, t, st, 2, 1, dotValue(st, u), u);
      }
      gainEnergy(u, 15);
      gainUlt(u, 12);
      emit(c, { t: 'energy', dst: u.id, ...snapshot(u) });
      break;
    }
    case 'skill': {
      const sk = getSkill(a.skillId);
      if ((sk.energyCost ?? 0) > u.energy || (u.cooldowns[sk.id] ?? 0) > 0) {
        emit(c, { t: 'info', src: u.id, text: 'Not enough energy — defending instead' });
        doDefend(c, u);
        break;
      }
      u.energy -= sk.energyCost ?? 0;
      gainUlt(u, 15);
      useSkill(c, u, sk, a.target);
      emit(c, { t: 'energy', dst: u.id, ...snapshot(u) });
      break;
    }
    case 'ultimate': {
      if (!u.ultimate || u.ult < 100) {
        doDefend(c, u);
        break;
      }
      u.ult = 0;
      emit(c, { t: 'ultimate', src: u.id, name: getSkill(u.ultimate).name });
      useSkill(c, u, getSkill(u.ultimate), a.target, { powerMult: u.passives.includes('ult_amp') ? 1.25 : 1 });
      emit(c, { t: 'energy', dst: u.id, ...snapshot(u) });
      break;
    }
    case 'defend':
      doDefend(c, u);
      break;
    case 'dodge':
      emit(c, { t: 'action', src: u.id, name: 'Dodge', skill: 'dodge', anim: 'buff', vfx: 'dodge', element: 'physical', targets: [u.id] });
      applyStatus(c, u, 'evasion', 1, 1, undefined, u);
      gainEnergy(u, 10);
      gainUlt(u, 6);
      break;
    case 'item': {
      const def = CONSUMABLE_MAP[a.itemId];
      const bag = bagFor(s, u);
      if (!def || (bag[a.itemId] ?? 0) <= 0) {
        doDefend(c, u);
        break;
      }
      bag[a.itemId] -= 1;
      const key = u.ownerId ?? 'local';
      s.used[key] = s.used[key] ?? {};
      s.used[key][a.itemId] = (s.used[key][a.itemId] ?? 0) + 1;
      const targets = resolveTargets(c, u, def.target, a.target);
      emit(c, { t: 'action', src: u.id, name: def.name, skill: 'item', item: def.id, anim: 'cast', vfx: def.damage ? (def.damage.element === 'fire' ? 'explosion' : 'emp') : 'heal', element: def.damage?.element ?? 'physical', targets: targets.map((x) => x.id) });
      for (const t of targets) {
        if (def.heal) heal(c, t, t.stats.hp * def.heal, u);
        if (def.revive) revive(c, t, def.revive, u);
        if (def.energy) {
          gainEnergy(t, def.energy);
          emit(c, { t: 'energy', dst: t.id, ...snapshot(t) });
        }
        if (def.cleanse) cleanse(c, t);
        if (def.damage) {
          hit(c, u, t, { power: 0, fixed: def.damage.base + def.damage.perLevel * u.level, element: def.damage.element, armorDmg: 25, noCrit: true });
          if (t.alive && def.damage.status) applyStatus(c, t, def.damage.status, def.damage.turns ?? 2, 1, dotValue(def.damage.status, u), u);
        }
      }
      break;
    }
    case 'switch': {
      const r = getUnit(s, a.reserveId);
      if (!r || r.onField || !r.alive) break;
      const slot = u.slot;
      u.onField = false;
      r.onField = true;
      r.slot = slot;
      u.slot = 99;
      u.statuses = u.statuses.filter((x) => !['evasion', 'guard'].includes(x.id));
      emit(c, { t: 'switch', src: u.id, dst: r.id, slot });
      break;
    }
    case 'scan': {
      const t = resolveTargets(c, u, 'enemy', a.target)[0];
      if (!t) break;
      emit(c, { t: 'action', src: u.id, name: 'Scan', skill: 'scan', anim: 'cast', vfx: 'scan', element: 'physical', targets: [t.id] });
      t.scanned = true;
      applyStatus(c, t, 'weakpoint', 3, 1, undefined, u);
      emit(c, { t: 'scan', src: u.id, dst: t.id, profile: t.profile, hp: t.hp, maxHp: t.stats.hp, armor: t.armor });
      gainEnergy(u, 20);
      gainUlt(u, 8);
      gainTeam(c, 5);
      break;
    }
    case 'combo':
      if (c.comboOk && !c.comboOk.has(u.id)) {
        emit(c, { t: 'info', src: u.id, text: 'Partner did not join the combo — attacking alone' });
        executeAction(c, u, { type: 'attack', target: a.target });
      } else doCombo(c, u, a.partner, a.target);
      break;
    case 'flee': {
      const allySpd = living(s, 'ally').reduce((m, x) => Math.max(m, effSpd(x)), 0);
      const enemySpd = living(s, 'enemy').reduce((m, x) => Math.max(m, effSpd(x)), 0);
      const p = Math.min(0.9, Math.max(0.3, 0.6 + (allySpd - enemySpd) / 200));
      emit(c, { t: 'action', src: u.id, name: 'Escape', skill: 'flee', anim: 'buff', vfx: 'dodge', element: 'physical', targets: [] });
      if (c.rng.chance(p)) finish(c, 'fled');
      else emit(c, { t: 'info', src: u.id, text: 'Escape failed!' });
      break;
    }
    case 'enemy': {
      const sk = getSkill(a.skillId);
      const ch = hasStatus(u, 'charging');
      if (ch && ch.data === a.skillId) removeStatus(c, u, 'charging');
      useSkill(c, u, sk, a.target);
      break;
    }
    case 'pass':
      break;
  }
}

export function animForWeapon(cls: string): string {
  return ({ katana: 'slash', dual: 'dual', rifle: 'shoot', railgun: 'rail', hammer: 'smash', greatsword: 'cleave', spear: 'thrust', scythe: 'reap' } as Record<string, string>)[cls] ?? 'slash';
}

function doDefend(c: Ctx, u: Unit) {
  emit(c, { t: 'action', src: u.id, name: 'Defend', skill: 'defend', anim: 'buff', vfx: 'shield', element: 'physical', targets: [u.id] });
  applyStatus(c, u, 'guard', 1, 1, undefined, u);
  gainEnergy(u, 20);
  gainUlt(u, 6);
  emit(c, { t: 'energy', dst: u.id, ...snapshot(u) });
}

function doCombo(c: Ctx, u: Unit, partnerId: string, targetId: string) {
  const s = c.s;
  const p = getUnit(s, partnerId);
  if (!p || !p.alive || !p.onField || s.teamGauge < TEAM_COMBO_COST) {
    emit(c, { t: 'info', src: u.id, text: 'Combo failed — attacking alone' });
    executeAction(c, u, { type: 'attack', target: targetId });
    return;
  }
  const t = resolveTargets(c, u, 'enemy', targetId)[0];
  if (!t) return;
  s.teamGauge -= TEAM_COMBO_COST;
  emit(c, { t: 'team', value: s.teamGauge });
  const finisher = !!hasStatus(t, 'broken');
  const sk = getSkill(finisher ? 'team_finisher' : 'team_combo');
  s.stats.combos++;
  emit(c, { t: 'action', src: u.id, partner: p.id, name: finisher ? 'TEAM FINISHER' : 'Team Combination', skill: sk.id, anim: 'combo', vfx: 'combo', element: u.element, targets: [t.id], combo: true });
  // first strike primes the target with the leader's element, partner's strike can react with it
  hit(c, u, t, { power: sk.power, element: u.element, armorDmg: finisher ? 0 : sk.armorDmg, single: false });
  const st1 = ELEMENT_STATUS[u.element];
  if (t.alive && st1 && p.element !== u.element) applyStatus(c, t, st1, 2, 1, dotValue(st1, u), u);
  if (t.alive) hit(c, p, t, { power: sk.power, element: p.element, armorDmg: finisher ? 0 : sk.armorDmg, single: false });
  const st2 = ELEMENT_STATUS[p.element];
  if (t.alive && st2) applyStatus(c, t, st2, 2, 1, dotValue(st2, p), p);
  for (const x of [u, p]) {
    gainEnergy(x, 10);
    gainUlt(x, 10);
    emit(c, { t: 'energy', dst: x.id, ...snapshot(x) });
  }
}

function doTeamUltimate(c: Ctx, leader: Unit) {
  const s = c.s;
  s.teamGauge = 0;
  s.stats.teamUlts++;
  const party = living(s, 'ally');
  emit(c, { t: 'team', value: 0 });
  emit(c, { t: 'team_ultimate', src: leader.id, party: party.map((x) => x.id) });
  const sk = getSkill('team_ultimate');
  for (const h of party) {
    if (c.ended) break;
    const targets = living(s, 'enemy');
    emit(c, { t: 'action', src: h.id, name: sk.name, skill: sk.id, anim: animForWeapon(WEAPON_MAP[h.weaponId ?? '']?.cls ?? 'katana'), vfx: 'team_ult', element: h.element, targets: targets.map((x) => x.id), teamUlt: true });
    for (const t of targets) {
      hit(c, h, t, { power: sk.power, element: h.element, armorDmg: sk.armorDmg });
      const st = ELEMENT_STATUS[h.element];
      if (t.alive && st) applyStatus(c, t, st, 2, 1, dotValue(st, h), h);
    }
    runFollowUps(c);
  }
}

function endRound(c: Ctx) {
  const s = c.s;
  emit(c, { t: 'round_end', round: s.round });
  for (const u of s.units) {
    if (!u.alive || !u.onField) continue;
    for (const st of [...u.statuses]) {
      if ((st.id === 'burn' || st.id === 'shock') && u.alive) {
        const src = getUnit(s, st.source) ?? u;
        const dmg = Math.max(1, Math.round((st.value ?? u.stats.hp * 0.04) * (u.isBoss ? 0.8 : 1)));
        u.hp = Math.max(0, u.hp - dmg);
        emit(c, { t: 'dmg', src: src.id, dst: u.id, amount: dmg, dot: st.id, element: st.id === 'burn' ? 'fire' : 'electric', ...snapshot(u) });
        if (u.hp <= 0) kill(c, u, src);
      }
      if (st.id === 'regen' && u.alive) heal(c, u, u.stats.hp * 0.08);
    }
    if (!u.alive) continue;
    // Reactor Beast meltdown
    if (u.passives.includes('meltdown')) applyStatus(c, u, 'meltdown', -1, 1, undefined, u);
    const cd = hasStatus(u, 'countdown');
    if (cd && !c.ended) {
      cd.value = (cd.value ?? 3) - 1;
      emit(c, { t: 'countdown', dst: u.id, value: cd.value });
      if (cd.value <= 0) {
        cd.value = 3;
        useSkill(c, u, getSkill('b_omega_end'));
      }
    }
  }
  if (c.ended) return;
  for (const u of s.units) {
    const keep: StatusInst[] = [];
    for (const st of u.statuses) {
      if (st.turns < 0) {
        keep.push(st);
        continue;
      }
      st.turns -= 1;
      if (st.turns > 0) keep.push(st);
      else {
        emit(c, { t: 'status', dst: u.id, status: st.id, on: false });
        if (st.id === 'broken' && u.alive) {
          u.armor = u.maxArmor;
          u.flags.stunned = 0;
          emit(c, { t: 'armor', dst: u.id, armor: u.armor, maxArmor: u.maxArmor, restore: true });
        }
      }
    }
    u.statuses = keep;
    for (const k of Object.keys(u.cooldowns)) {
      u.cooldowns[k] = Math.max(0, u.cooldowns[k] - 1);
    }
    if (u.counters.freezeImmune > 0) u.counters.freezeImmune -= 1;
    u.flags.followUsed = 0;
    u.flags.overwatchUsed = 0;
    u.flags.protoUsed = 0;
    if (u.side === 'ally' && u.alive && u.onField) gainEnergy(u, 5);
  }
  s.chain = {};
  // auto-bring in a reserve if the whole field is down (single player)
  const fieldAllies = living(s, 'ally');
  if (fieldAllies.length === 0) {
    const reserve = s.units.find((u) => u.side === 'ally' && !u.onField && u.alive);
    if (reserve) {
      reserve.onField = true;
      reserve.slot = 0;
      emit(c, { t: 'switch', dst: reserve.id, slot: 0 });
    }
  }
  checkEnd(c);
  if (c.ended) return;
  s.round += 1;
  planIntents(c);
  emit(c, { t: 'intents', intents: s.intents });
}

/** strip RNG state before sending to untrusted clients */
export function publicState(s: BattleState): BattleState {
  return { ...s, rng: 0 };
}

export const __test = { hit, applyStatus, triggerReaction, breakUnit };
export type { Ctx };
export function makeCtx(s: BattleState): Ctx {
  return { s, rng: new Rng(s.rng), ev: [], followUps: [], ended: false };
}
