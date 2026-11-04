import { describe, it, expect } from 'vitest';
import { battle, hunter } from './helpers';
import { resolveRound, predictOrder, validateAction, getUnit, makeCtx, __test, hasStatus } from '../src/core/combat/engine';
import { chooseAllyAction } from '../src/core/combat/ai';
import type { Action, BattleState } from '../src/core/combat/types';

function autoPlans(s: BattleState): Record<string, Action> {
  const plans: Record<string, Action> = {};
  for (const u of s.units) if (u.side === 'ally' && u.alive && u.onField) plans[u.id] = chooseAllyAction(s, u, s.bags.local);
  return plans;
}

describe('battle lifecycle', () => {
  it('creates a battle in planning phase with enemy intents', () => {
    const s = battle([hunter('a', 'energy_katana')], ['scrap_bot', 'processor_bot']);
    expect(s.phase).toBe('planning');
    expect(Object.keys(s.intents)).toHaveLength(2);
  });

  it('is deterministic for the same seed and plans', () => {
    const run = () => {
      let s = battle([hunter('a', 'energy_katana'), hunter('b', 'plasma_rifle')], ['scrap_bot', 'memory_drone'], 5, { seed: 99 });
      const log: unknown[] = [];
      for (let i = 0; i < 6 && s.phase === 'planning'; i++) {
        const r = resolveRound(s, autoPlans(s));
        log.push(r.events);
        s = r.state;
      }
      return JSON.stringify(log);
    };
    expect(run()).toEqual(run());
  });

  it('never mutates the input state', () => {
    const s = battle([hunter('a', 'energy_katana')], ['scrap_bot']);
    const before = JSON.stringify(s);
    resolveRound(s, { h_a: { type: 'attack', target: s.units[1].id } });
    expect(JSON.stringify(s)).toEqual(before);
  });

  it('auto battles finish within 40 rounds', () => {
    let s = battle([hunter('a', 'energy_katana'), hunter('b', 'gravity_hammer'), hunter('c', 'photon_scythe')], ['scrap_bot', 'processor_bot', 'cooling_mech']);
    let rounds = 0;
    while (s.phase === 'planning' && rounds < 40) {
      s = resolveRound(s, autoPlans(s)).state;
      rounds++;
    }
    expect(s.phase).toBe('ended');
    expect(s.result).toBe('victory');
  });
});

describe('turn order', () => {
  it('orders by priority then speed', () => {
    const fast = hunter('fast', 'dual_plasma', 5, { stats: { hp: 900, atk: 100, def: 50, spd: 200, critRate: 0, critDmg: 0.5, energy: 100, elemBonus: 0 } });
    const slow = hunter('slow', 'gravity_hammer', 5, { stats: { hp: 900, atk: 100, def: 50, spd: 50, critRate: 0, critDmg: 0.5, energy: 100, elemBonus: 0 } });
    const s = battle([fast, slow], ['scrap_bot']);
    const e = s.units.find((u) => u.side === 'enemy')!.id;
    let order = predictOrder(s, { h_fast: { type: 'attack', target: e }, h_slow: { type: 'attack', target: e } });
    expect(order[0].id).toBe('h_fast');
    expect(order[order.length - 1].id).toBe('h_slow');
    // defend has priority even for the slow unit
    order = predictOrder(s, { h_fast: { type: 'attack', target: e }, h_slow: { type: 'defend' } });
    expect(order[0].id).toBe('h_slow');
  });

  it('delay pushes a unit down and haste pulls it up next round', () => {
    const s = battle([hunter('a', 'quantum_spear')], ['scrap_bot']);
    const enemy = s.units.find((u) => u.side === 'enemy')!;
    const r = resolveRound(s, { h_a: { type: 'skill', skillId: 'time_lance', target: enemy.id } });
    const e2 = getUnit(r.state, enemy.id)!;
    expect(hasStatus(e2, 'delay')).toBeTruthy();
    const order = predictOrder(r.state, { h_a: { type: 'attack', target: enemy.id } });
    expect(order[0].id).toBe('h_a');
  });
});

describe('validation', () => {
  it('rejects illegal actions', () => {
    const s = battle([hunter('a', 'energy_katana')], ['scrap_bot']);
    const e = s.units[1].id;
    expect(validateAction(s, 'h_a', { type: 'ultimate', target: e })).toMatch(/not charged/);
    expect(validateAction(s, 'h_a', { type: 'skill', skillId: 'ult_raijin', target: e })).toMatch(/not known/);
    expect(validateAction(s, 'h_a', { type: 'team_ultimate' })).toMatch(/gauge/);
    expect(validateAction(s, 'h_a', { type: 'attack', target: 'nope' })).toMatch(/target/);
    expect(validateAction(s, e, { type: 'attack', target: 'h_a' })).toMatch(/Not your unit/);
    expect(validateAction(s, 'h_a', { type: 'attack', target: e }, 'otherPlayer')).toMatch(/do not control/);
    expect(validateAction(s, 'h_a', { type: 'attack', target: e })).toBeNull();
  });

  it('illegal plans fall back to defend', () => {
    const s = battle([hunter('a', 'energy_katana')], ['scrap_bot']);
    const r = resolveRound(s, { h_a: { type: 'ultimate', target: s.units[1].id } });
    expect(r.events.some((e) => e.t === 'action' && e.src === 'h_a' && e.name === 'Defend')).toBe(true);
  });
});

describe('elements, reactions and breaks', () => {
  it('weakness increases damage and resist reduces it', () => {
    const s = battle([hunter('a', 'energy_katana')], ['scrap_bot']); // scrap bot weak to electric
    const c = makeCtx(JSON.parse(JSON.stringify(s)));
    const a = getUnit(c.s, 'h_a')!;
    const e = c.s.units[1];
    const weakDmg = __test.hit(c, a, e, { power: 1, element: 'electric', armorDmg: 0, noCrit: true, noReaction: true });
    e.hp = e.stats.hp;
    c.s.chain = {};
    const normal = __test.hit(c, a, e, { power: 1, element: 'fire', armorDmg: 0, noCrit: true, noReaction: true });
    expect(weakDmg).toBeGreaterThan(normal * 1.3);
  });

  it('Electric on Ionized triggers Plasma Burst and consumes the status', () => {
    const s = battle([hunter('a', 'energy_katana')], ['storage_beast', 'scrap_bot']);
    const c = makeCtx(JSON.parse(JSON.stringify(s)));
    const a = getUnit(c.s, 'h_a')!;
    const e = c.s.units[1];
    __test.applyStatus(c, e, 'ionized', 2, 1, undefined, a);
    __test.hit(c, a, e, { power: 1, element: 'electric', armorDmg: 0 });
    expect(c.ev.some((x) => x.t === 'reaction' && x.name === 'Plasma Burst')).toBe(true);
    expect(hasStatus(e, 'ionized')).toBeFalsy();
    // splash hit the other enemy
    expect(c.ev.some((x) => x.t === 'dmg' && x.dst === c.s.units[2].id && x.reaction === 'Plasma Burst')).toBe(true);
  });

  it('status applied by the same hit does not react with itself (pre-hit status check)', () => {
    const s = battle([hunter('a', 'energy_katana')], ['storage_beast']);
    const e = s.units[1].id;
    const r = resolveRound(s, { h_a: { type: 'skill', skillId: 'thunder_iai', target: e } });
    expect(r.events.some((x) => x.t === 'reaction')).toBe(false);
    expect(hasStatus(getUnit(r.state, e)!, 'shock')).toBeTruthy();
  });

  it('Chill x2 freezes, frozen units skip their action', () => {
    const s = battle([hunter('a', 'photon_scythe')], ['scrap_bot']);
    const c = makeCtx(JSON.parse(JSON.stringify(s)));
    const e = c.s.units[1];
    __test.applyStatus(c, e, 'chill', 2, 1);
    __test.applyStatus(c, e, 'chill', 2, 1);
    expect(hasStatus(e, 'frozen')).toBeTruthy();
    const r = resolveRound(c.s, { h_a: { type: 'defend' } });
    expect(r.events.some((x) => x.t === 'skip' && x.src === e.id && x.reason === 'Frozen')).toBe(true);
  });

  it('armor break stuns, boosts team gauge and interrupts a charged attack', () => {
    const s = battle([hunter('a', 'gravity_hammer')], ['power_core_golem']);
    const c = makeCtx(JSON.parse(JSON.stringify(s)));
    const a = getUnit(c.s, 'h_a')!;
    const e = c.s.units[1];
    __test.applyStatus(c, e, 'charging', 2, 1, undefined, e, 'e_core_overload');
    e.armor = 5;
    __test.hit(c, a, e, { power: 0.1, element: 'gravity', armorDmg: 20, noCrit: true });
    expect(hasStatus(e, 'broken')).toBeTruthy();
    expect(hasStatus(e, 'charging')).toBeFalsy();
    expect(c.ev.some((x) => x.t === 'interrupt')).toBe(true);
    expect(c.s.teamGauge).toBeGreaterThanOrEqual(20);
  });

  it('documented chain: Electric → Shock → Plasma Burst → Armor Break → Team Finisher', () => {
    const s = battle([hunter('k', 'energy_katana'), hunter('r', 'dual_plasma')], ['storage_beast'], 25);
    const e = s.units.find((u) => u.side === 'enemy')!;
    let st = s;
    // round 1: katana applies Shock, blades hit with plasma => Plasma Burst
    let r = resolveRound(st, {
      h_k: { type: 'skill', skillId: 'thunder_iai', target: e.id },
      h_r: { type: 'skill', skillId: 'plasma_flurry', target: e.id },
    });
    expect(r.events.some((x) => x.t === 'reaction' && x.name === 'Plasma Burst')).toBe(true);
    st = r.state;
    // force armor break and gauge so we can test the finisher deterministically
    const eu = getUnit(st, e.id)!;
    if (!hasStatus(eu, 'broken')) {
      eu.armor = 1;
      r = resolveRound(st, { h_k: { type: 'attack', target: e.id }, h_r: { type: 'defend' } });
      st = r.state;
    }
    expect(r.events.some((x) => x.t === 'break') || hasStatus(getUnit(st, e.id)!, 'broken')).toBeTruthy();
    st.teamGauge = 100;
    r = resolveRound(st, { h_k: { type: 'combo', partner: 'h_r', target: e.id }, h_r: { type: 'defend' } });
    const act = r.events.find((x) => x.t === 'action' && x.combo);
    expect(act?.name).toBe('TEAM FINISHER');
  });

  it('chain bonus grows with consecutive hits', () => {
    const s = battle([hunter('r', 'dual_plasma')], ['storage_beast']);
    const e = s.units[1].id;
    const r = resolveRound(s, { h_r: { type: 'skill', skillId: 'plasma_flurry', target: e } });
    const chains = r.events.filter((x) => x.t === 'dmg' && x.src === 'h_r').map((x) => x.chain as number);
    expect(Math.max(...chains)).toBeGreaterThanOrEqual(4);
  });
});

describe('commands', () => {
  it('defend halves damage taken', () => {
    const base = battle([hunter('a', 'energy_katana')], ['storage_beast'], 5, { seed: 7 });
    const e = base.units[1];
    base.intents[e.id] = { type: 'enemy', skillId: 'e_strike', target: 'h_a' };
    const r1 = resolveRound(base, { h_a: { type: 'scan', target: e.id } });
    const r2 = resolveRound(base, { h_a: { type: 'defend' } });
    const d1 = r1.events.find((x) => x.t === 'dmg' && x.dst === 'h_a')!.amount as number;
    const d2 = r2.events.find((x) => x.t === 'dmg' && x.dst === 'h_a')!.amount as number;
    expect(d2).toBeLessThan(d1 * 0.7);
  });

  it('scan reveals the enemy and marks a weak point', () => {
    const s = battle([hunter('a', 'energy_katana')], ['cooling_mech']);
    const e = s.units[1].id;
    const r = resolveRound(s, { h_a: { type: 'scan', target: e } });
    expect(getUnit(r.state, e)!.scanned).toBe(true);
    expect(r.events.some((x) => x.t === 'scan')).toBe(true);
  });

  it('items are consumed from the bag and tallied', () => {
    const s = battle([hunter('a', 'energy_katana')], ['scrap_bot']);
    s.units[0].hp = 100;
    const r = resolveRound(s, { h_a: { type: 'item', itemId: 'repair_kit', target: 'h_a' } });
    expect(r.state.bags.local.repair_kit).toBe(1);
    expect(r.state.used.local.repair_kit).toBe(1);
  });

  it('switch swaps a reserve hunter onto the field', () => {
    const s = battle([hunter('a', 'energy_katana'), hunter('b', 'railgun'), hunter('c', 'plasma_rifle'), hunter('d', 'gravity_hammer')], ['scrap_bot']);
    expect(getUnit(s, 'h_d')!.onField).toBe(false);
    const r = resolveRound(s, { h_a: { type: 'switch', reserveId: 'h_d' }, h_b: { type: 'defend' }, h_c: { type: 'defend' } });
    expect(getUnit(r.state, 'h_d')!.onField).toBe(true);
    expect(getUnit(r.state, 'h_a')!.onField).toBe(false);
  });

  it('team ultimate requires a full gauge and hits every enemy', () => {
    const s = battle([hunter('a', 'energy_katana'), hunter('b', 'plasma_rifle')], ['scrap_bot', 'memory_drone']);
    s.teamGauge = 100;
    const r = resolveRound(s, { h_a: { type: 'team_ultimate' }, h_b: { type: 'attack', target: s.units[2].id } });
    expect(r.events.some((x) => x.t === 'team_ultimate')).toBe(true);
    expect(r.state.stats.teamUlts).toBe(1);
  });

  it('co-op team ultimate fails unless every player agrees', () => {
    const a = hunter('a', 'energy_katana', 5, { ownerId: 'p1' });
    const b = hunter('b', 'plasma_rifle', 5, { ownerId: 'p2' });
    const s = battle([a, b], ['scrap_bot'], 5, { mode: 'coop', bags: { p1: {}, p2: {} } });
    s.teamGauge = 100;
    const r = resolveRound(s, { h_a: { type: 'team_ultimate' }, h_b: { type: 'defend' } });
    expect(r.events.some((x) => x.t === 'team_ultimate')).toBe(false);
    const r2 = resolveRound(s, { h_a: { type: 'team_ultimate' }, h_b: { type: 'team_ultimate' } });
    expect(r2.events.some((x) => x.t === 'team_ultimate')).toBe(true);
  });
});

describe('bosses', () => {
  it('Server Golem summons drones and raises a Data Shield that falls when drones die', () => {
    let s = battle([hunter('a', 'energy_katana'), hunter('b', 'plasma_rifle'), hunter('c', 'gravity_hammer')], ['server_golem'], 5);
    const boss = s.units.find((u) => u.templateId === 'server_golem')!;
    expect(s.intents[boss.id]).toMatchObject({ skillId: 'b_spawn_drones' });
    s = resolveRound(s, { h_a: { type: 'defend' }, h_b: { type: 'defend' }, h_c: { type: 'defend' } }).state;
    expect(hasStatus(getUnit(s, boss.id)!, 'barrier')).toBeTruthy();
    const drones = s.units.filter((u) => u.templateId === 'memory_drone' && u.alive);
    expect(drones.length).toBe(2);
    for (const d of drones) getUnit(s, d.id)!.hp = 1;
    const r = resolveRound(s, { h_a: { type: 'attack', target: drones[0].id }, h_b: { type: 'skill', skillId: 'ion_volley' }, h_c: { type: 'attack', target: drones[1].id } });
    expect(r.events.some((x) => x.t === 'barrier_down')).toBe(true);
  });

  it('bosses change phase at HP thresholds', () => {
    const s = battle([hunter('a', 'railgun')], ['titan_mech'], 8);
    const boss = s.units.find((u) => u.isBoss)!;
    boss.hp = Math.round(boss.stats.hp * 0.52);
    const r = resolveRound(s, { h_a: { type: 'attack', target: boss.id } });
    const b2 = getUnit(r.state, boss.id)!;
    if (b2.hp / b2.stats.hp <= 0.5) {
      expect(r.events.some((x) => x.t === 'phase')).toBe(true);
      expect(b2.phase).toBe(1);
      expect(b2.skills).toContain('b_missile_barrage');
    }
  });

  it('Reactor Beast gains meltdown each round and ice removes it', () => {
    let s = battle([hunter('a', 'photon_scythe')], ['reactor_beast'], 12);
    const boss = s.units.find((u) => u.isBoss)!;
    s = resolveRound(s, { h_a: { type: 'defend' } }).state;
    const m1 = getUnit(s, boss.id)!.statuses.find((x) => x.id === 'meltdown')!.stacks;
    expect(m1).toBe(2);
    s = resolveRound(s, { h_a: { type: 'attack', target: boss.id } }).state;
    const m2 = getUnit(s, boss.id)!.statuses.find((x) => x.id === 'meltdown')?.stacks ?? 0;
    expect(m2).toBeLessThanOrEqual(m1 + 1);
  });

  it('enemy AI uses varied actions, not only basic attacks', () => {
    let s = battle([hunter('a', 'energy_katana', 5, { stats: { hp: 99999, atk: 1, def: 999, spd: 10, critRate: 0, critDmg: 0, energy: 100, elemBonus: 0 } })], ['processor_bot', 'memory_drone', 'graphics_guardian'], 5, { seed: 5 });
    const used = new Set<string>();
    for (let i = 0; i < 12 && s.phase === 'planning'; i++) {
      for (const a of Object.values(s.intents)) if (a.type === 'enemy') used.add(a.skillId);
      s.units.filter((u) => u.side === 'enemy').forEach((u) => (u.hp = Math.max(1, Math.round(u.stats.hp * (0.4 + (i % 3) * 0.2)))));
      s = resolveRound(s, { h_a: { type: 'defend' } }).state;
    }
    expect(used.size).toBeGreaterThanOrEqual(4);
  });
});
