import type { Appearance, Stats } from '../types';
import { ENEMY_MAP } from '../data/enemies';
import type { Unit } from './types';

export interface HunterBuild {
  id: string;
  name: string;
  level: number;
  stats: Stats;
  weaponId: string;
  element: Unit['element'];
  skills: string[];
  ultimate: string;
  passives: string[];
  look?: Appearance;
  ownerId?: string;
  weaponLevel?: number;
}

export function makeHunterUnit(b: HunterBuild, slot: number, onField = true): Unit {
  return {
    id: `h_${b.id}`,
    side: 'ally',
    name: b.name,
    templateId: b.id,
    ownerId: b.ownerId,
    level: b.level,
    stats: { ...b.stats },
    hp: b.stats.hp,
    energy: Math.round(b.stats.energy * 0.4),
    ult: 0,
    armor: 0,
    maxArmor: 0,
    element: b.element,
    profile: { weak: [], resist: [], immune: [] },
    statuses: [],
    skills: [...b.skills],
    ultimate: b.ultimate,
    passives: [...b.passives],
    onField,
    alive: true,
    phase: 0,
    cooldowns: {},
    scanned: true,
    weaponId: b.weaponId,
    look: b.look,
    flags: {},
    counters: { weaponLevel: b.weaponLevel ?? 0 },
    slot,
  };
}

export const DIFF_HP = [1, 1.35, 1.75, 2.3];
export const DIFF_ATK = [1, 1.15, 1.3, 1.5];
export const DIFF_DEF = [1, 1.1, 1.2, 1.35];

/** global tuning knobs (see balance report in TEST_REPORT.md) */
export const TUNING = { normalHp: 2.1, normalAtk: 2.0, bossHp: 0.8, bossAtk: 1.1 };

export function enemyStats(templateId: string, level: number, difficulty: number, elite = false, partyScale = 1): Stats {
  const d = ENEMY_MAP[templateId];
  const g = 1 + 0.11 * (level - 1);
  const def = d.base;
  const hpK = d.boss ? TUNING.bossHp : TUNING.normalHp;
  const atkK = d.boss ? TUNING.bossAtk : TUNING.normalAtk;
  return {
    hp: Math.round(def.hp * g * DIFF_HP[difficulty] * (elite ? 2.2 : 1) * partyScale * hpK),
    atk: Math.round(def.atk * g * DIFF_ATK[difficulty] * (elite ? 1.25 : 1) * atkK),
    def: Math.round(def.def * (1 + 0.08 * (level - 1)) * DIFF_DEF[difficulty]),
    spd: Math.round(def.spd * (1 + 0.006 * (level - 1)) + (difficulty >= 2 ? 4 : 0)),
    critRate: def.critRate + difficulty * 0.02,
    critDmg: def.critDmg,
    energy: 100,
    elemBonus: 0,
  };
}

export function makeEnemyUnit(templateId: string, level: number, difficulty: number, index: number, opts: { elite?: boolean; partyScale?: number; idPrefix?: string } = {}): Unit {
  const d = ENEMY_MAP[templateId];
  if (!d) throw new Error(`Unknown enemy ${templateId}`);
  const stats = enemyStats(templateId, level, difficulty, opts.elite, opts.partyScale ?? 1);
  const armor = Math.round(d.armor * (1 + 0.04 * (level - 1)) * (opts.elite ? 1.5 : 1) * (1 + difficulty * 0.12));
  return {
    id: `${opts.idPrefix ?? 'e'}${index}_${templateId}`,
    side: 'enemy',
    name: (opts.elite ? 'Elite ' : '') + d.name,
    templateId,
    level,
    stats,
    hp: stats.hp,
    energy: 0,
    ult: 0,
    armor,
    maxArmor: armor,
    element: d.element,
    profile: { weak: [...d.profile.weak], resist: [...d.profile.resist], immune: [...d.profile.immune] },
    statuses: [],
    skills: d.phases ? [...d.phases[0].skills] : [...d.skills],
    passives: [...(d.passives ?? [])],
    onField: true,
    alive: true,
    isBoss: !!d.boss,
    isElite: !!opts.elite,
    phase: 0,
    cooldowns: {},
    scanned: false,
    flags: {},
    counters: {},
    slot: index,
  };
}
