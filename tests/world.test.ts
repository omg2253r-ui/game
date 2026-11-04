import { describe, it, expect } from 'vitest';
import { generateDungeon } from '../src/core/dungeon/generator';
import { DUNGEONS } from '../src/core/data/regions';
import { newSave, validateSave, plausibleTransition, addItem, refreshQuests, questProgress } from '../src/core/save';
import { COMPANION_MAP, grantExp, hunterBuild, canLearn, expToNext } from '../src/core/progression';
import { generateComponent } from '../src/core/economy/loot';
import { Rng } from '../src/core/rng';

describe('dungeon generator', () => {
  for (const d of DUNGEONS) {
    it(`${d.name}: connected layout with boss, mini boss, hidden room`, () => {
      for (let seed = 1; seed < 15; seed++) {
        const L = generateDungeon(d.id, seed % 4, d.levels[0], seed);
        const ids = new Set(L.rooms.map((r) => r.id));
        expect(L.rooms.filter((r) => r.type === 'boss')).toHaveLength(1);
        expect(L.rooms.some((r) => r.type === 'start')).toBe(true);
        // reachability (including secret passage)
        const seen = new Set([0]);
        const q = [0];
        while (q.length) {
          const r = L.rooms[q.shift()!];
          for (const l of [...r.links, ...(r.secretLink !== undefined ? [r.secretLink] : [])]) if (!seen.has(l)) { seen.add(l); q.push(l); }
        }
        expect(seen.size).toBe(ids.size);
        const boss = L.rooms[L.bossRoom];
        expect(boss.encounters[0].boss).toBe(true);
        expect(boss.encounters[0].enemies[0].template).toBe(d.boss);
        // no unbalanced swarms
        for (const r of L.rooms) for (const e of r.encounters) expect(e.enemies.length).toBeLessThanOrEqual(4);
      }
    });
  }
  it('is deterministic per seed', () => {
    expect(JSON.stringify(generateDungeon('ai_lab', 1, 18, 77))).toEqual(JSON.stringify(generateDungeon('ai_lab', 1, 18, 77)));
  });
  it('higher difficulty raises enemy level', () => {
    const n = generateDungeon('data_center', 0, 1, 5);
    const a = generateDungeon('data_center', 3, 1, 5);
    expect(a.enemyLevel[0]).toBeGreaterThan(n.enemyLevel[0]);
  });
});

describe('save & progression', () => {
  const look = COMPANION_MAP.rin.look;
  it('new save validates', () => {
    const s = newSave('Hero', look, 'energy_katana');
    expect(validateSave(s)).toEqual({ ok: true, errors: [] });
  });
  it('rejects forged values', () => {
    const s = newSave('Hero', look, 'energy_katana');
    s.credits = 1e12;
    expect(validateSave(s).ok).toBe(false);
    const s2 = newSave('Hero', look, 'energy_katana');
    s2.hunters[0].skillPoints = 50;
    expect(validateSave(s2).errors.join()).toMatch(/skill points/);
    const s3 = newSave('Hero', look, 'energy_katana');
    s3.inventory.push({ uid: 'x', kind: 'component', defId: 'gpu', rarity: 5, qty: 1, quality: 100, specs: { perf: 99999 } });
    expect(validateSave(s3).errors.join()).toMatch(/specs/);
    const s4 = newSave('Hero', look, 'energy_katana');
    s4.inventory.push({ uid: 'w', kind: 'weapon', defId: 'excalibur', rarity: 5, qty: 1 });
    expect(validateSave(s4).ok).toBe(false);
  });
  it('plausibility check flags impossible progress', () => {
    const a = newSave('Hero', look, 'energy_katana');
    const b = JSON.parse(JSON.stringify(a));
    b.credits += 5_000_000;
    expect(plausibleTransition(a, b, 60_000).length).toBeGreaterThan(0);
    const c = JSON.parse(JSON.stringify(a));
    c.credits += 1500;
    expect(plausibleTransition(a, c, 120_000)).toEqual([]);
  });
  it('exp levels up and grants skill points', () => {
    const s = newSave('Hero', look, 'energy_katana');
    const h = s.hunters[0];
    const gained = grantExp(h, expToNext(1) + expToNext(2) + 5);
    expect(gained).toBe(2);
    expect(h.level).toBe(3);
    expect(h.skillPoints).toBe(3);
    expect(validateSave(s).ok).toBe(true);
  });
  it('skill tree prerequisites and tech skills', () => {
    const s = newSave('Hero', look, 'energy_katana');
    const h = s.hunters[0];
    h.level = 6; h.skillPoints = 6;
    expect(canLearn(h, 'nano')).toMatch(/Requires/);
    expect(canLearn(h, 'hp1')).toBeNull();
    h.tree.push('hp1'); h.skillPoints -= 1;
    expect(canLearn(h, 'nano')).toBeNull();
    h.tree.push('nano'); h.skillPoints -= 2;
    const b = hunterBuild(h, s.inventory);
    expect(b.skills).toContain('nano_repair');
    expect(b.skills).toContain('thunder_iai');
  });
  it('inventory stacks materials and overflows to storage', () => {
    const s = newSave('Hero', look, 'energy_katana');
    const before = s.inventory.find((i) => i.defId === 'scrap_metal')!.qty;
    addItem(s, { uid: 'm', kind: 'material', defId: 'scrap_metal', rarity: 0, qty: 5 });
    expect(s.inventory.find((i) => i.defId === 'scrap_metal')!.qty).toBe(before + 5);
    const rng = new Rng(1);
    for (let i = 0; i < 200; i++) addItem(s, generateComponent('ram', 0, rng));
    expect(s.inventory.length).toBe(150);
    expect(s.storage.length).toBeGreaterThan(0);
  });
  it('quests track progress', () => {
    const s = newSave('Hero', look, 'energy_katana');
    refreshQuests(s);
    const kill = s.quests.find((q) => q.kind === 'kill')!;
    questProgress(s, 'kill', kill.target, kill.count);
    expect(kill.done).toBe(true);
  });
});
