import { makeEnemyUnit, makeHunterUnit, type HunterBuild } from '../src/core/combat/units';
import { createBattle } from '../src/core/combat/engine';
import { WEAPON_MAP } from '../src/core/data/weapons';
import type { BattleState } from '../src/core/combat/types';

export function hunter(id: string, weaponId: string, level = 5, extra: Partial<HunterBuild> = {}): HunterBuild {
  const w = WEAPON_MAP[weaponId];
  return {
    id, name: id, level, weaponId, element: w.element,
    stats: { hp: 900, atk: 140, def: 60, spd: 100 + w.speed, critRate: 0, critDmg: 0.5, energy: 100, elemBonus: 0 },
    skills: [w.skill], ultimate: w.ultimate, passives: [w.passive], ...extra,
  };
}

export function battle(allies: HunterBuild[], enemies: string[], level = 5, opts: { seed?: number; mode?: 'single' | 'coop'; bags?: any } = {}): BattleState {
  return createBattle({
    seed: opts.seed ?? 1234,
    allies: allies.map((h, i) => makeHunterUnit(h, i, i < 3)),
    enemies: enemies.map((e, i) => makeEnemyUnit(e, level, 0, i)),
    difficulty: 0,
    mode: opts.mode ?? 'single',
    canFlee: true,
    bags: opts.bags ?? { local: { repair_kit: 2, nano_revive: 1 } },
  });
}
