import { Rng, uid } from '../rng';
import type { Rarity } from '../types';
import { MATERIAL_MAP, MODEL_NAMES, type ComponentSpec, type ComponentType, type RamType, type Socket } from '../data/hardware';
import { ENEMY_MAP } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { ARMORS, type ItemInstance } from './items';

/** base rarity weights: Common .. Mythic */
const BASE_WEIGHTS = [56, 25, 12, 5, 1.7, 0.3];

export function rollRarity(rng: Rng, bias = 0): Rarity {
  // bias shifts weight from low to high tiers (0 = normal, 1 = boss, 2+ = deeper difficulty)
  const w = BASE_WEIGHTS.map((x, i) => x * Math.pow(1 + 0.55 * bias, i) / (i === 0 ? 1 + bias * 0.4 : 1));
  return rng.weighted(w.map((x, i) => ({ w: x, v: i as Rarity })));
}

export function generateComponent(type: ComponentType, rarity: Rarity, rng: Rng, tier = 0): ItemInstance {
  const r = rarity;
  const spec: ComponentSpec = {};
  const sockets: Socket[] = ['AM-X', 'LGA-Z'];
  const qChance = tier >= 3 ? 0.25 + 0.1 * r : r >= 5 ? 0.25 : 0;
  switch (type) {
    case 'cpu': {
      spec.socket = rng.chance(qChance) ? 'Q-SOCKET' : rng.pick(sockets);
      spec.cores = [2, 4, 6, 8, 12, 16][r] + (r >= 3 ? rng.pick([0, 0, 4, 8]) : 0);
      spec.perf = Math.round(55 * (r + 1) + spec.cores * 9 + rng.int(-10, 15));
      spec.watts = 45 + r * 22 + rng.int(0, 15);
      spec.heat = 35 + r * 18 + rng.int(0, 10);
      break;
    }
    case 'gpu': {
      spec.perf = Math.round(110 * Math.pow(r + 1, 1.18) + rng.int(-10, 25));
      spec.watts = 70 + r * 52 + rng.int(0, 20);
      spec.heat = 45 + r * 24 + rng.int(0, 10);
      spec.pcie = r < 2 ? 3 : r < 4 ? 4 : 5;
      spec.gpuLength = 170 + r * 34 + rng.int(0, 20);
      break;
    }
    case 'ram': {
      let t: RamType = r < 2 ? 'DDR4' : r < 4 ? (rng.chance(0.6) ? 'DDR5' : 'DDR4') : 'DDR5';
      if (rng.chance(qChance)) t = 'QRAM';
      spec.ramType = t;
      spec.capacity = [4, 8, 16, 16, 32, 64][r] * (rng.chance(0.25) && r < 5 ? 2 : 1);
      spec.perf = Math.round(spec.capacity * (t === 'DDR4' ? 1.5 : t === 'DDR5' ? 2.2 : 3.2));
      spec.watts = 5 + r * 2;
      break;
    }
    case 'ssd':
      spec.capacity = [128, 256, 512, 1000, 2000, 4000][r];
      spec.perf = 20 + r * 18 + rng.int(0, 8);
      spec.watts = 5;
      break;
    case 'hdd':
      spec.capacity = [500, 1000, 2000, 4000, 8000, 16000][r];
      spec.perf = 6 + r * 6 + rng.int(0, 4);
      spec.watts = 9;
      break;
    case 'motherboard': {
      spec.socket = rng.chance(qChance) ? 'Q-SOCKET' : rng.pick(sockets);
      spec.ramType = spec.socket === 'Q-SOCKET' ? 'QRAM' : r < 2 ? 'DDR4' : rng.chance(0.65) ? 'DDR5' : 'DDR4';
      spec.pcie = [3, 3, 4, 4, 5, 5][r];
      spec.formFactor = rng.pick(r < 2 ? (['mini', 'atx'] as const) : (['mini', 'atx', 'atx', 'eatx'] as const));
      spec.gpuLength = spec.formFactor === 'mini' ? 230 : spec.formFactor === 'atx' ? 330 : 420;
      spec.ramSlots = spec.formFactor === 'mini' ? 2 : 4;
      spec.watts = 25 + r * 5;
      spec.perf = 10 + r * 8;
      break;
    }
    case 'cooling_fan':
      spec.cooling = 85 + r * 46 + rng.int(0, 15);
      spec.watts = 6 + r * 2;
      break;
    case 'power_supply':
      spec.supply = [320, 480, 650, 850, 1100, 1600][r] + rng.pick([0, 0, 50]);
      break;
    case 'quantum_chip':
      spec.qubits = 8 * (r + 1);
      spec.perf = 400 + r * 220;
      spec.watts = 120 + r * 20;
      spec.heat = 70 + r * 20;
      spec.socket = 'Q-SOCKET';
      break;
  }
  const lo = [20, 35, 50, 62, 75, 88][r];
  const quality = Math.min(100, rng.int(lo, lo + 18));
  const model = MODEL_NAMES[type][r];
  return { uid: uid(rng), kind: 'component', defId: type, rarity, qty: 1, quality, specs: spec, name: `${model} ${labelFor(type, spec)}`, isNew: true };
}

function labelFor(type: ComponentType, s: ComponentSpec): string {
  switch (type) {
    case 'cpu':
      return `${s.cores}C ${s.socket}`;
    case 'gpu':
      return `G${Math.round((s.perf ?? 0) / 10)}`;
    case 'ram':
      return `${s.capacity}GB ${s.ramType}`;
    case 'ssd':
    case 'hdd':
      return (s.capacity ?? 0) >= 1000 ? `${(s.capacity ?? 0) / 1000}TB` : `${s.capacity}GB`;
    case 'motherboard':
      return `${s.formFactor?.toUpperCase()} ${s.socket}`;
    case 'cooling_fan':
      return `${s.cooling}W`;
    case 'power_supply':
      return `${s.supply}W`;
    case 'quantum_chip':
      return `${s.qubits}Q`;
  }
}

export function makeMaterial(id: string, qty: number): ItemInstance {
  return { uid: `mat_${id}`, kind: 'material', defId: id, rarity: 0, qty, isNew: true };
}

export function makeConsumable(id: string, qty: number): ItemInstance {
  return { uid: `con_${id}`, kind: 'consumable', defId: id, rarity: 0, qty };
}

export function generateWeapon(rng: Rng, rarity: Rarity, weaponId?: string): ItemInstance {
  const w = weaponId ? WEAPONS.find((x) => x.id === weaponId)! : rng.pick(WEAPONS);
  return { uid: uid(rng), kind: 'weapon', defId: w.id, rarity, qty: 1, level: 0, name: w.name, isNew: true };
}

export function generateGear(rng: Rng, rarity: Rarity, slot?: 'armor' | 'accessory'): ItemInstance {
  const pool = slot ? ARMORS.filter((a) => a.slot === slot) : ARMORS;
  const a = rng.pick(pool);
  return { uid: uid(rng), kind: a.slot === 'armor' ? 'armor' : 'accessory', defId: a.id, rarity, qty: 1, level: 0, name: a.name, isNew: true };
}

export interface DropResult {
  items: ItemInstance[];
  credits: number;
  exp: number;
}

export const DIFF_REWARD = [1, 1.5, 2.2, 3.4];

/** roll loot for a defeated enemy. `tier` = dungeon tier (0..4) */
export function rollDrops(templateId: string, level: number, difficulty: number, rng: Rng, tier: number, elite = false): DropResult {
  const d = ENEMY_MAP[templateId];
  const items: ItemInstance[] = [];
  const mult = DIFF_REWARD[difficulty] * (elite ? 2 : 1);
  const credits = Math.round(rng.int(d.credits[0], d.credits[1]) * (1 + 0.08 * (level - 1)) * mult);
  const exp = Math.round(d.exp * (1 + 0.1 * (level - 1)) * mult);
  const count = rng.int(d.dropCount[0], d.dropCount[1]) + (elite ? 1 : 0);
  const bias = difficulty * 0.6 + (d.boss ? 1.4 : 0) + (elite ? 0.6 : 0) + tier * 0.25;
  for (let i = 0; i < count; i++) {
    let id = rng.weighted(d.drops.map((x) => ({ w: x.w, v: x.item })));
    if (id === 'quantum_chip' && tier < 3 && !d.boss) id = 'cpu';
    const def = MATERIAL_MAP[id];
    if (def.kind === 'material') items.push(makeMaterial(id, rng.int(1, 3) + difficulty));
    else {
      let r = rollRarity(rng, bias);
      if (d.boss && r < 2) r = 2;
      items.push(generateComponent(id as ComponentType, r, rng, tier));
    }
  }
  // scrap always drops a little
  items.push(makeMaterial('scrap_metal', rng.int(1, 2)));
  // gear drops
  const gearChance = d.boss ? 1 : elite ? 0.4 : 0.06 + difficulty * 0.03;
  if (rng.chance(gearChance)) {
    let r = rollRarity(rng, bias);
    if (d.boss && r < 2) r = 2;
    items.push(rng.chance(0.5) ? generateWeapon(rng, r) : generateGear(rng, r));
  }
  return { items, credits, exp };
}

export function chestLoot(rng: Rng, tier: number, difficulty: number, hidden = false): DropResult {
  const items: ItemInstance[] = [];
  const bias = difficulty * 0.6 + tier * 0.3 + (hidden ? 1.2 : 0.3);
  const n = rng.int(2, 3) + (hidden ? 1 : 0);
  const types: ComponentType[] = ['cpu', 'gpu', 'ram', 'ssd', 'hdd', 'motherboard', 'cooling_fan', 'power_supply'];
  for (let i = 0; i < n; i++) items.push(generateComponent(rng.pick(types), rollRarity(rng, bias), rng, tier));
  if (rng.chance(hidden ? 0.8 : 0.25)) items.push(rng.chance(0.5) ? generateWeapon(rng, rollRarity(rng, bias + 0.5)) : generateGear(rng, rollRarity(rng, bias + 0.5)));
  if (hidden && tier >= 3 && rng.chance(0.5)) items.push(generateComponent('quantum_chip', rollRarity(rng, bias), rng, tier));
  items.push(makeConsumable(rng.pick(['repair_kit', 'energy_cell', 'emp_grenade']), 1));
  items.push(makeMaterial('copper_wire', rng.int(2, 4)));
  return { items, credits: Math.round(rng.int(40, 90) * (1 + tier * 0.6) * DIFF_REWARD[difficulty] * (hidden ? 2 : 1)), exp: 0 };
}
