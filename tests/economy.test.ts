import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateComponent, rollDrops, rollRarity } from '../src/core/economy/loot';
import { checkBuild, generateOrders, orderFulfils, assemblePc, marketStock, type BuildParts } from '../src/core/economy/crafting';
import type { ItemInstance } from '../src/core/economy/items';

const comp = (defId: string, specs: any, rarity = 2, quality = 70): ItemInstance => ({ uid: defId + Math.random(), kind: 'component', defId, rarity: rarity as any, qty: 1, quality, specs, name: defId });

function goodGaming(): BuildParts {
  return {
    cpu: comp('cpu', { socket: 'AM-X', cores: 8, perf: 260, watts: 95, heat: 80 }),
    motherboard: comp('motherboard', { socket: 'AM-X', ramType: 'DDR5', pcie: 4, formFactor: 'atx', gpuLength: 330, ramSlots: 4, watts: 35, perf: 26 }),
    ram: [comp('ram', { ramType: 'DDR5', capacity: 16, perf: 35, watts: 9 })],
    gpu: comp('gpu', { perf: 400, watts: 180, heat: 100, pcie: 4, gpuLength: 260 }),
    storage: [comp('ssd', { capacity: 512, perf: 56, watts: 5 })],
    cooling_fan: comp('cooling_fan', { cooling: 180, watts: 10 }),
    power_supply: comp('power_supply', { supply: 650 }),
  };
}

describe('PC compatibility', () => {
  it('accepts a compatible gaming PC', () => {
    const r = checkBuild('gaming_pc', goodGaming(), { scrap: 20, copper: 20 });
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.value).toBeGreaterThan(0);
  });
  it('rejects mismatched CPU socket', () => {
    const p = goodGaming();
    p.cpu!.specs!.socket = 'LGA-Z';
    expect(checkBuild('gaming_pc', p, { scrap: 20, copper: 20 }).issues.join()).toMatch(/socket/);
  });
  it('rejects wrong RAM type', () => {
    const p = goodGaming();
    p.ram[0].specs!.ramType = 'DDR4';
    expect(checkBuild('gaming_pc', p, { scrap: 20, copper: 20 }).issues.join()).toMatch(/RAM DDR4/);
  });
  it('rejects weak PSU', () => {
    const p = goodGaming();
    p.power_supply!.specs!.supply = 300;
    expect(checkBuild('gaming_pc', p, { scrap: 20, copper: 20 }).issues.join()).toMatch(/PSU/);
  });
  it('rejects overheating', () => {
    const p = goodGaming();
    p.cooling_fan!.specs!.cooling = 50;
    expect(checkBuild('gaming_pc', p, { scrap: 20, copper: 20 }).issues.join()).toMatch(/Overheating/);
  });
  it('rejects GPU too new for the board / too long', () => {
    const p = goodGaming();
    p.gpu!.specs!.pcie = 5;
    p.gpu!.specs!.gpuLength = 400;
    const issues = checkBuild('gaming_pc', p, { scrap: 20, copper: 20 }).issues.join();
    expect(issues).toMatch(/PCIe/);
    expect(issues).toMatch(/too long/);
  });
  it('requires materials', () => {
    expect(checkBuild('gaming_pc', goodGaming(), { scrap: 0, copper: 0 }).ok).toBe(false);
  });
  it('quantum PC needs a quantum chip on a Q-SOCKET board', () => {
    const p = goodGaming();
    p.quantum_chip = comp('quantum_chip', { qubits: 40, perf: 1300, watts: 200, heat: 150, socket: 'Q-SOCKET' }, 4);
    const r = checkBuild('quantum_pc', p, { scrap: 50, copper: 50 });
    expect(r.issues.join()).toMatch(/Q-SOCKET/);
  });
  it('better parts sell for more', () => {
    const lo = checkBuild('gaming_pc', goodGaming(), { scrap: 20, copper: 20 });
    const p = goodGaming();
    p.gpu!.specs!.perf = 700;
    for (const x of [p.cpu!, p.gpu!, p.motherboard!, p.ram[0], p.storage[0], p.power_supply!, p.cooling_fan!]) x.quality = 98;
    const hi = checkBuild('gaming_pc', p, { scrap: 20, copper: 20 });
    expect(hi.value).toBeGreaterThan(lo.value);
  });
  it('orders are fulfilled by matching PCs', () => {
    const orders = generateOrders(5, 10);
    expect(orders.length).toBeGreaterThan(0);
    const o = orders[0];
    const fake = assemblePc(o.product, goodGaming(), { ok: true, issues: [], warnings: [], perf: o.minPerf + 10, quality: 99, watts: 0, heat: 0, ramTotal: 16, value: 100 }, new Rng(1));
    expect(orderFulfils(o, fake)).toBe(true);
    fake.pc!.perf = 0;
    expect(orderFulfils(o, fake)).toBe(false);
  });
  it('market stock is deterministic per day', () => {
    expect(JSON.stringify(marketStock(3, 1))).toEqual(JSON.stringify(marketStock(3, 1)));
  });
});

describe('loot', () => {
  it('rarity distribution favours common but higher bias increases rare drops', () => {
    const rng = new Rng(42);
    const count = (bias: number) => {
      let hi = 0;
      for (let i = 0; i < 4000; i++) if (rollRarity(rng, bias) >= 3) hi++;
      return hi;
    };
    const normal = count(0);
    const boss = count(2);
    expect(normal).toBeLessThan(600);
    expect(boss).toBeGreaterThan(normal * 2);
  });
  it('each robot has its own drop table', () => {
    const rng = new Rng(7);
    const types = (id: string) => {
      const s = new Set<string>();
      for (let i = 0; i < 80; i++) rollDrops(id, 5, 0, rng, 0).items.forEach((x) => s.add(x.defId));
      return s;
    };
    expect(types('memory_drone').has('ram')).toBe(true);
    expect(types('memory_drone').has('gpu')).toBe(false);
    expect(types('graphics_guardian').has('gpu')).toBe(true);
  });
  it('bosses always drop rare+ components', () => {
    const r = rollDrops('server_golem', 6, 0, new Rng(3), 0);
    expect(r.items.filter((i) => i.kind === 'component').every((i) => i.rarity >= 2)).toBe(true);
  });
  it('generated components have specs in range', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 200; i++) {
      const c = generateComponent(rng.pick(['cpu', 'gpu', 'ram', 'ssd', 'hdd', 'motherboard', 'cooling_fan', 'power_supply', 'quantum_chip'] as const), rollRarity(rng, 2), rng, 4);
      expect(c.quality).toBeGreaterThanOrEqual(0);
      expect(c.quality).toBeLessThanOrEqual(100);
      expect((c.specs?.perf ?? 0)).toBeLessThan(2000);
    }
  });
});
