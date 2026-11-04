import { it, expect } from 'vitest';
import { generateDungeon } from '../src/core/dungeon/generator';
import { buildBattle } from '../src/core/combat/setup';
import { resolveRound } from '../src/core/combat/engine';
import { chooseAllyAction } from '../src/core/combat/ai';
import { newSave } from '../src/core/save';
import { COMPANION_MAP, hunterBuild } from '../src/core/progression';
import { DUNGEONS } from '../src/core/data/regions';
import type { BattleState } from '../src/core/combat/types';

import { WEAPONS } from '../src/core/data/weapons';
import { ENEMY_MAP } from '../src/core/data/enemies';
function party(level: number, weapons?: string[]) {
  const s = newSave('T', COMPANION_MAP.rin.look, weapons?.[0] ?? 'energy_katana');
  s.hunters.forEach((h, i) => {
    h.level = level;
    if (weapons) { const w = s.inventory.find((x) => x.uid === h.weaponUid)!; w.defId = weapons[i]; }
    const trees = [['atk1', 'crit1', 'critdmg', 'ult_amp', 'hp1'], ['hp1', 'nano', 'def1', 'barrier', 'reboot'], ['energy1', 'elem1', 'spd1', 'overclock', 'emp']];
    let pts = level; h.tree = [];
    for (const n of trees[i]) { const c = n.length > 0 ? ({ atk1: 1, crit1: 1, critdmg: 2, ult_amp: 3, hp1: 1, nano: 2, def1: 1, barrier: 2, reboot: 3, energy1: 1, elem1: 1, spd1: 1, overclock: 2, emp: 2 } as any)[n] : 1; if (pts >= c) { h.tree.push(n); pts -= c; } }
  });
  for (const i of s.inventory) if (i.kind === 'weapon') { i.rarity = Math.min(3, Math.floor(level / 7)) as any; i.level = Math.min(10, Math.floor(level / 3)); }
  return s.hunters.map((h) => hunterBuild(h, s.inventory));
}
function tailored(boss: string) {
  const weak = ENEMY_MAP[boss].profile.weak;
  const pick = (el: string) => WEAPONS.find((w) => w.element === el)?.id ?? 'gravity_hammer';
  return [pick(weak[0]), weak[1] ? pick(weak[1]) : 'gravity_hammer', 'gravity_hammer'];
}
function sim(st: BattleState) {
  let r = 0;
  while (st.phase === 'planning' && r < 60) {
    const plans: any = {};
    for (const u of st.units) if (u.side === 'ally' && u.alive && u.onField) plans[u.id] = chooseAllyAction(st, u, st.bags.local);
    st = resolveRound(st, plans).state;
    r++;
  }
  const hp = st.units.filter((u) => u.side === 'ally').reduce((s, u) => s + u.hp / u.stats.hp, 0) / 3;
  return { win: st.result === 'victory', rounds: r, hp };
}
it('balance: dungeons are winnable at level, bosses need preparation', () => {
  const table: string[] = [];
  for (const d of DUNGEONS) {
    for (const lv of [d.levels[0], Math.round((d.levels[0] + d.levels[1]) / 2), d.levels[1]]) {
      const L = generateDungeon(d.id, 0, lv, 42);
      const hunters = party(lv);
      let wins = 0, n = 0, rounds = 0, hpSum = 0;
      for (const r of L.rooms) for (const enc of r.encounters) {
        if (enc.boss) continue;
        for (let k = 0; k < 3; k++) { const o = sim(buildBattle({ seed: 100 + n, hunters, enc, difficulty: 0, mode: 'single', bags: { local: { repair_kit: 1 } } })); wins += +o.win; n++; rounds += o.rounds; hpSum += o.hp; }
      }
      const boss = L.rooms[L.bossRoom].encounters[0];
      let bw = 0, br = 0, tw = 0, tr = 0;
      const th = party(lv, tailored(d.boss));
      for (let k = 0; k < 10; k++) { const o = sim(buildBattle({ seed: 900 + k, hunters, enc: boss, difficulty: 0, mode: 'single', bags: { local: { repair_kit: 2, nano_revive: 1 } } })); bw += +o.win; br += o.rounds; }
      for (let k = 0; k < 10; k++) { const o = sim(buildBattle({ seed: 700 + k, hunters: th, enc: boss, difficulty: 0, mode: 'single', bags: { local: { repair_kit: 2, nano_revive: 1 } } })); tw += +o.win; tr += o.rounds; }
      const line = `${d.id.padEnd(14)} party Lv${String(lv).padStart(2)} | normal ${wins}/${n} rounds ${(rounds / n).toFixed(1)} hpLeft ${(hpSum / n * 100).toFixed(0)}% | boss Lv${boss.enemies[0].level} default ${bw}/10 r${(br / 10).toFixed(0)} · tailored ${tw}/10 r${(tr / 10).toFixed(0)}`;
      table.push(line);
      if (lv === d.levels[0]) expect(wins / n).toBeGreaterThanOrEqual(0.95);
      if (lv === d.levels[1]) expect(tw).toBeGreaterThanOrEqual(8);
      if (d.id === 'data_center' && lv === 1) expect(bw).toBeLessThanOrEqual(6);
    }
  }
  console.log(table.join('\n'));
}, 60000);

import { raidWaves, coopPartyScale } from '../src/core/combat/setup';
it('balance: co-op raids are winnable for 2-4 players at region level', () => {
  const rows: string[] = [];
  const results: number[] = [];
  for (const d of DUNGEONS.slice(0, 3)) {
    for (const players of [2, 4]) {
      const lv = Math.round((d.levels[0] + d.levels[1]) / 2);
      let wins = 0;
      for (let k = 0; k < 10; k++) {
        // a typical mixed group: ice, electric, plasma, gravity
        const hunters = [...party(lv, ['photon_scythe', 'energy_katana', 'plasma_rifle']), party(lv, ['gravity_hammer', 'railgun', 'quantum_spear'])[0]].slice(0, players);
        hunters.forEach((h, i) => { h.ownerId = `p${i}`; h.id = `p${i}`; });
        const waves = raidWaves(d.id, 0, lv, 1000 + k, players);
        let carry: any;
        let ok = true;
        for (let w = 0; w < waves.length && ok; w++) {
          let st = buildBattle({ seed: 50 + k * 7 + w, hunters, enc: waves[w], difficulty: 0, mode: 'coop', bags: Object.fromEntries(hunters.map((h) => [h.ownerId, { repair_kit: 2, nano_revive: 1 }])), carry, partyScale: coopPartyScale(players) });
          let r = 0;
          while (st.phase === 'planning' && r < 60) {
            const plans: any = {};
            for (const u of st.units) if (u.side === 'ally' && u.alive && u.onField) plans[u.id] = chooseAllyAction(st, u, st.bags[u.ownerId!]);
            st = resolveRound(st, plans).state;
            r++;
          }
          ok = st.result === 'victory';
          carry = { hp: Object.fromEntries(st.units.filter((u) => u.side === 'ally').map((u) => [u.templateId, u.alive ? u.hp : Math.round(u.stats.hp * 0.25)])), energy: {} };
        }
        wins += +ok;
      }
      rows.push(`${d.id.padEnd(14)} ${players}P Lv${lv}: raid wins ${wins}/10`);
      results.push(wins);
    }
  }
  console.log(rows.join('\n'));
  for (const w of results) expect(w).toBeGreaterThanOrEqual(5);
}, 60000);
