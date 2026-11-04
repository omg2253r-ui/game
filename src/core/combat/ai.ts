/**
 * Utility-based AI for machines (enemy intents) and for hunters that are AI-controlled
 * (single-player auto battle, disconnected co-op players).
 */
import type { Rng } from '../rng';
import { ENEMY_MAP } from '../data/enemies';
import { CONSUMABLE_MAP } from '../data/items';
import { getSkill } from '../data/skills';
import type { Element } from '../types';
import type { Action, BattleState, StatusId, Unit } from './types';

const has = (u: Unit, id: StatusId) => u.statuses.some((s) => s.id === id);
const stacks = (u: Unit, id: StatusId) => u.statuses.find((s) => s.id === id)?.stacks ?? 0;
const live = (s: BattleState, side: 'ally' | 'enemy') => s.units.filter((u) => u.side === side && u.alive && u.onField);
const hpPct = (u: Unit) => u.hp / u.stats.hp;

const PROFILE_WEIGHTS: Record<string, Record<string, number>> = {
  brute: { heavy: 1.4, aoe: 1.1 },
  support: { buff: 1.6 },
  guardian: { barrier: 1.6, guard: 1.2 },
  healer: { heal: 1.7 },
  tank: { harden: 1.5, heavy: 1.2 },
  controller: { aoe: 1.4 },
  bomber: { charge: 1.4 },
  boss: { summon: 1.2, charge: 1.2, aoe: 1.1 },
};

function category(id: string): string {
  const sk = getSkill(id);
  if (sk.charge || sk.special === 'start_countdown') return 'charge';
  if (sk.summon) return 'summon';
  if (sk.heal) return 'heal';
  if (sk.id === 'e_guard') return 'guard';
  if (sk.special === 'restore_armor') return 'harden';
  if (sk.special === 'adapt') return 'adapt';
  if (sk.target === 'ally' && sk.shield) return 'barrier';
  if (sk.target === 'all_allies') return 'buff';
  if (sk.target === 'all_enemies' || sk.target === 'random_enemies') return 'aoe';
  if (sk.apply?.some((a) => a.status === 'hacked')) return 'hack';
  if (sk.power >= 1.5) return 'heavy';
  return 'basic';
}

export function planEnemyIntent(s: BattleState, u: Unit, rng: Rng): Action {
  // forced moves
  const charging = u.statuses.find((x) => x.id === 'charging');
  if (charging?.data) return { type: 'enemy', skillId: charging.data };
  if (stacks(u, 'meltdown') >= 5) return { type: 'enemy', skillId: 'b_reactor_explosion' };

  const hunters = live(s, 'ally');
  const mates = live(s, 'enemy');
  const def = ENEMY_MAP[u.templateId];
  const weights = PROFILE_WEIGHTS[def?.ai ?? 'brute'] ?? {};
  const options: { w: number; v: Action }[] = [];

  for (const id of u.skills) {
    if ((u.cooldowns[id] ?? 0) > 0) continue;
    const sk = getSkill(id);
    const cat = category(id);
    let score = 1;
    let target: string | undefined;
    switch (cat) {
      case 'basic':
        score = 1;
        break;
      case 'heavy':
        score = 1.6;
        break;
      case 'aoe':
        score = hunters.length >= 3 ? 2.0 : hunters.length === 2 ? 1.4 : 0.8;
        break;
      case 'heal': {
        const hurt = [...mates].sort((a, b) => hpPct(a) - hpPct(b))[0];
        score = hurt && hpPct(hurt) < 0.6 ? 2.5 + (1 - hpPct(hurt)) * 3 : 0;
        target = hurt?.id;
        break;
      }
      case 'buff':
        score = mates.length >= 2 && !mates.some((m) => has(m, 'atk_up')) ? 2.4 : 0.2;
        break;
      case 'barrier': {
        const cand = mates.filter((m) => !has(m, 'shield')).sort((a, b) => hpPct(a) - hpPct(b))[0];
        score = cand && hpPct(cand) < 0.75 ? 2.6 : cand ? 0.8 : 0;
        target = cand?.id;
        break;
      }
      case 'guard':
        score = hpPct(u) < 0.35 && !u.isBoss ? 1.8 : 0.2;
        break;
      case 'harden':
        score = u.armor < u.maxArmor * 0.4 && !has(u, 'broken') ? 2.6 : 0.3;
        break;
      case 'summon':
        score = mates.length < 3 ? 2.8 : 0;
        if (sk.special === 'data_shield' && !mates.some((m) => m.templateId === 'memory_drone')) score += 1.5;
        if (s.round === 1 && u.isBoss) score += 3;
        break;
      case 'charge':
        score = sk.special === 'start_countdown' ? (u.statuses.some((x) => x.id === 'countdown') ? 0 : 4) : 2.2;
        break;
      case 'adapt':
        score = u.scanned ? 3 : 0.6;
        break;
      case 'hack':
        score = hunters.length >= 2 ? 2.3 : 0;
        break;
    }
    score *= weights[cat] ?? 1;
    if (score <= 0) continue;
    score += rng.next() * 0.6;
    if (sk.target === 'enemy' && !target) target = pickHunterTarget(hunters, rng)?.id;
    if (sk.target === 'ally' && !target) target = u.id;
    options.push({ w: score * score, v: { type: 'enemy', skillId: id, target } });
  }
  if (!options.length) {
    const t = pickHunterTarget(hunters, rng);
    return { type: 'enemy', skillId: 'e_strike', target: t?.id };
  }
  return rng.weighted(options);
}

function pickHunterTarget(hunters: Unit[], rng: Rng): Unit | undefined {
  if (!hunters.length) return undefined;
  const r = rng.next();
  if (r < 0.45) return [...hunters].sort((a, b) => hpPct(a) - hpPct(b))[0];
  if (r < 0.65) return [...hunters].sort((a, b) => b.stats.atk - a.stats.atk)[0];
  return rng.pick(hunters);
}

// ---------------------------------------------------------------------------
// hunter AI
// ---------------------------------------------------------------------------

const REACTS_WITH: Record<Element, StatusId[]> = {
  electric: ['ionized', 'chill', 'burn'],
  plasma: ['shock', 'burn'],
  fire: ['shock', 'chill', 'frozen', 'ionized'],
  ice: ['shock', 'burn'],
  gravity: ['entangled', 'frozen', 'shock', 'burn', 'ionized', 'chill'],
  quantum: ['crushed', 'shock', 'burn', 'ionized', 'chill'],
  physical: ['frozen'],
};

function targetScore(t: Unit, element: Element, armorDmg: number, chargingBonus = true): number {
  if (t.profile.immune.includes(element)) return -99;
  let sc = 0;
  if (t.profile.weak.includes(element)) sc += 2;
  if (t.profile.resist.includes(element)) sc -= 1;
  if (REACTS_WITH[element].some((st) => has(t, st))) sc += 2.5;
  if (has(t, 'broken')) sc += 1;
  if (has(t, 'barrier')) sc -= 2;
  if (chargingBonus && (has(t, 'charging') || has(t, 'countdown'))) sc += 2 + (armorDmg > 0 && t.armor < 120 ? 2 : 0);
  sc += (1 - hpPct(t)) * 1.5;
  if (t.templateId === 'memory_drone' && t.side === 'enemy') sc += 1;
  return sc;
}

export function chooseAllyAction(s: BattleState, u: Unit, bag: Record<string, number> = {}): Action {
  const enemies = live(s, 'enemy');
  const allies = live(s, 'ally');
  const dead = s.units.filter((x) => x.side === 'ally' && !x.alive && x.onField);
  if (!enemies.length) return { type: 'defend' };

  // revive
  if (dead.length) {
    if (u.skills.includes('reboot_protocol') && u.energy >= (getSkill('reboot_protocol').energyCost ?? 0)) return { type: 'skill', skillId: 'reboot_protocol', target: dead[0].id };
    if ((bag['nano_revive'] ?? 0) > 0) return { type: 'item', itemId: 'nano_revive', target: dead[0].id };
  }
  // heal
  const hurt = [...allies].sort((a, b) => hpPct(a) - hpPct(b))[0];
  if (hurt && hpPct(hurt) < 0.35) {
    if (u.skills.includes('nano_repair') && u.energy >= 30) return { type: 'skill', skillId: 'nano_repair', target: hurt.id };
    if ((bag['repair_kit'] ?? 0) > 0) return { type: 'item', itemId: 'repair_kit', target: hurt.id };
  }
  if (has(u, 'hacked') && (bag['coolant_spray'] ?? 0) > 0) return { type: 'item', itemId: 'coolant_spray', target: u.id };

  const best = (element: Element, armor: number) =>
    [...enemies].sort((a, b) => targetScore(b, element, armor) - targetScore(a, element, armor))[0];

  // ultimate
  if (u.ultimate && u.ult >= 100) {
    const sk = getSkill(u.ultimate);
    return { type: 'ultimate', target: sk.target === 'enemy' ? best(sk.element, sk.armorDmg).id : undefined };
  }
  // big telegraphed hit coming and we are fragile -> defend
  const danger = enemies.some((e) => has(e, 'charging')) || Object.values(s.intents).some((a) => a.type === 'enemy' && getSkill(a.skillId).power >= 2);
  if (danger && hpPct(u) < 0.45) return { type: 'defend' };

  // best skill
  let bestAct: Action | null = null;
  let bestScore = -Infinity;
  for (const id of u.skills) {
    const sk = getSkill(id);
    if ((sk.energyCost ?? 0) > u.energy || (u.cooldowns[id] ?? 0) > 0) continue;
    if (sk.power <= 0) {
      if (id === 'overclock') {
        const mate = allies.find((a) => a.id !== u.id && !has(a, 'haste'));
        if (mate && s.round % 3 === 1) {
          const sc = 2.2;
          if (sc > bestScore) {
            bestScore = sc;
            bestAct = { type: 'skill', skillId: id, target: mate.id };
          }
        }
      }
      if (id === 'barrier_field' && allies.filter((a) => hpPct(a) < 0.6).length >= 2) {
        bestScore = 3;
        bestAct = { type: 'skill', skillId: id };
      }
      continue;
    }
    if (sk.target === 'all_enemies') {
      const sc = enemies.reduce((m, e) => m + Math.max(-1, targetScore(e, sk.element, sk.armorDmg)), 0) * 0.6 + enemies.length * 0.8;
      if (sc > bestScore) {
        bestScore = sc;
        bestAct = { type: 'skill', skillId: id };
      }
    } else {
      const t = best(sk.element, sk.armorDmg);
      const sc = targetScore(t, sk.element, sk.armorDmg) + sk.power;
      if (sc > bestScore) {
        bestScore = sc;
        bestAct = { type: 'skill', skillId: id, target: t.id };
      }
    }
  }
  if (bestAct && bestScore > 1.5) return bestAct;
  const t = best(u.element, 12);
  return { type: 'attack', target: t.id };
}

/** helper for UI: best-guess target of a consumable */
export function defaultItemTarget(s: BattleState, u: Unit, itemId: string): string | undefined {
  const def = CONSUMABLE_MAP[itemId];
  if (!def) return undefined;
  if (def.target === 'dead_ally') return s.units.find((x) => x.side === 'ally' && !x.alive)?.id;
  if (def.target === 'ally') return [...live(s, 'ally')].sort((a, b) => hpPct(a) - hpPct(b))[0]?.id ?? u.id;
  if (def.target === 'enemy') return live(s, 'enemy')[0]?.id;
  return undefined;
}
