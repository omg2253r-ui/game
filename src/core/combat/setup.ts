/** Builds battles from encounters for both single player and co-op raids. */
import { Rng } from '../rng';
import type { Encounter } from '../dungeon/generator';
import { DUNGEON_MAP, DIFF_LEVEL_OFFSET } from '../data/regions';
import { createBattle } from './engine';
import { makeEnemyUnit, makeHunterUnit, type HunterBuild } from './units';
import type { BattleState, Unit } from './types';

export function enemiesFor(enc: Encounter, difficulty: number, partyScale = 1): Unit[] {
  return enc.enemies.map((e, i) => makeEnemyUnit(e.template, e.level, difficulty, i, { elite: e.elite, partyScale: ENEMY_BOSS(e.template) || e.elite ? partyScale : 1 }));
}

function ENEMY_BOSS(t: string) {
  return ['server_golem', 'titan_mech', 'reactor_beast', 'neural_overlord', 'omega_machine'].includes(t);
}

export interface CarryOver {
  hp: Record<string, number>;
  energy: Record<string, number>;
}

export function buildBattle(opts: {
  seed: number;
  hunters: HunterBuild[];
  enc: Encounter;
  difficulty: number;
  mode: 'single' | 'coop';
  bags: Record<string, Record<string, number>>;
  carry?: CarryOver;
  arena?: string;
  label?: string;
  partyScale?: number;
}): BattleState {
  const allies = opts.hunters.map((h, i) => {
    const u = makeHunterUnit(h, i, opts.mode === 'coop' ? true : i < 3);
    const hp = opts.carry?.hp[h.id];
    if (hp !== undefined) {
      u.hp = Math.max(0, Math.min(u.stats.hp, hp));
      if (u.hp <= 0) u.alive = false;
    }
    const en = opts.carry?.energy[h.id];
    if (en !== undefined) u.energy = Math.max(0, Math.min(u.stats.energy, en));
    return u;
  });
  // make sure at least one hunter is standing on the field
  if (!allies.some((a) => a.onField && a.alive)) {
    const r = allies.find((a) => a.alive);
    if (r) {
      r.onField = true;
      r.slot = 0;
    } else {
      allies[0].alive = true;
      allies[0].hp = Math.round(allies[0].stats.hp * 0.3);
    }
  }
  const enemies = enemiesFor(opts.enc, opts.difficulty, opts.partyScale ?? 1);
  return createBattle({
    seed: opts.seed,
    allies,
    enemies,
    difficulty: opts.difficulty,
    mode: opts.mode,
    canFlee: !opts.enc.boss && opts.mode === 'single',
    bags: opts.bags,
    label: opts.label,
    arena: opts.arena,
  });
}

/** Co-op raid: a gauntlet of waves ending with the region boss */
export function raidWaves(dungeonId: string, difficulty: number, partyLevel: number, seed: number, players: number): Encounter[] {
  const d = DUNGEON_MAP[dungeonId];
  const rng = new Rng(seed);
  const off = DIFF_LEVEL_OFFSET[difficulty];
  const lv = Math.max(d.levels[0], Math.min(d.levels[1], partyLevel)) + off;
  const count = Math.min(4, 1 + players);
  const wave = (n: number, l: number): Encounter => ({ enemies: Array.from({ length: n }, () => ({ template: rng.pick(d.pool), level: l })) });
  const w1 = wave(Math.min(4, count), lv);
  const w2: Encounter = { enemies: [{ template: d.miniBoss, level: lv + 1, elite: true }, ...wave(Math.max(1, count - 2), lv).enemies] };
  const boss: Encounter = { boss: true, enemies: [{ template: d.boss, level: d.levels[1] + off + 1 }] };
  if (players >= 3 || difficulty >= 2) boss.enemies.push({ template: rng.pick(d.pool), level: lv });
  return [w1, w2, boss];
}

export function coopPartyScale(players: number): number {
  return 0.45 + 0.2 * players;
}
