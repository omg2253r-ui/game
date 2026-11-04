/**
 * Computer assembly: compatibility validation, scoring and pricing.
 */
import { Rng, hashString, uid } from '../rng';
import type { Rarity } from '../types';
import type { ComponentType } from '../data/hardware';
import type { ItemInstance } from './items';
import { generateComponent, rollRarity } from './loot';

export interface ProductDef {
  id: string;
  name: string;
  basePrice: number;
  refPerf: number;
  needs: ComponentType[]; // required slots
  minRam: number;
  minCores?: number;
  minGpuPerf?: number;
  needSsd?: boolean;
  needCooling?: boolean;
  ramTypes?: string[];
  needQuantum?: boolean;
  scrap: number;
  copper: number;
  desc: string;
  unlockLevel: number;
}

export const PRODUCTS: ProductDef[] = [
  { id: 'basic_pc', name: 'Basic PC', basePrice: 260, refPerf: 180, needs: ['cpu', 'motherboard', 'ram', 'power_supply'], minRam: 4, scrap: 3, copper: 2, desc: 'CPU, board, RAM, storage, PSU.', unlockLevel: 1 },
  { id: 'office_pc', name: 'Office PC', basePrice: 420, refPerf: 260, needs: ['cpu', 'motherboard', 'ram', 'power_supply', 'ssd'], minRam: 8, needSsd: true, scrap: 4, copper: 3, desc: 'Needs an SSD and 8GB+ RAM.', unlockLevel: 1 },
  { id: 'gaming_pc', name: 'Gaming PC', basePrice: 900, refPerf: 560, needs: ['cpu', 'motherboard', 'ram', 'power_supply', 'gpu', 'cooling_fan'], minRam: 16, needCooling: true, scrap: 6, copper: 4, desc: 'Needs a GPU, cooling and 16GB+ RAM.', unlockLevel: 3 },
  { id: 'workstation', name: 'Workstation', basePrice: 1500, refPerf: 700, needs: ['cpu', 'motherboard', 'ram', 'power_supply', 'ssd', 'cooling_fan'], minRam: 32, minCores: 12, needSsd: true, needCooling: true, scrap: 7, copper: 6, desc: '12+ core CPU, 32GB+ RAM, SSD, cooling.', unlockLevel: 6 },
  { id: 'highend_gaming_pc', name: 'High-end Gaming PC', basePrice: 2600, refPerf: 1300, needs: ['cpu', 'motherboard', 'ram', 'power_supply', 'gpu', 'cooling_fan', 'ssd'], minRam: 32, minGpuPerf: 500, needSsd: true, needCooling: true, ramTypes: ['DDR5', 'QRAM'], scrap: 9, copper: 8, desc: 'GPU 500+ perf, DDR5, 32GB+, SSD, cooling.', unlockLevel: 10 },
  { id: 'quantum_pc', name: 'Quantum PC', basePrice: 7200, refPerf: 2600, needs: ['cpu', 'motherboard', 'ram', 'power_supply', 'cooling_fan', 'ssd', 'quantum_chip'], minRam: 32, needQuantum: true, needSsd: true, needCooling: true, ramTypes: ['QRAM'], scrap: 12, copper: 12, desc: 'Quantum Chip, Q-SOCKET board, QRAM.', unlockLevel: 18 },
];
export const PRODUCT_MAP: Record<string, ProductDef> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export interface BuildParts {
  cpu?: ItemInstance;
  motherboard?: ItemInstance;
  ram: ItemInstance[];
  gpu?: ItemInstance;
  storage: ItemInstance[]; // ssd / hdd
  cooling_fan?: ItemInstance;
  power_supply?: ItemInstance;
  quantum_chip?: ItemInstance;
}

export interface BuildCheck {
  ok: boolean;
  issues: string[]; // blocking
  warnings: string[];
  perf: number;
  quality: number;
  watts: number;
  heat: number;
  ramTotal: number;
  value: number;
}

export function allParts(p: BuildParts): ItemInstance[] {
  return [p.cpu, p.motherboard, ...p.ram, p.gpu, ...p.storage, p.cooling_fan, p.power_supply, p.quantum_chip].filter(Boolean) as ItemInstance[];
}

export function checkBuild(productId: string, p: BuildParts, mats: { scrap: number; copper: number }): BuildCheck {
  const prod = PRODUCT_MAP[productId];
  const issues: string[] = [];
  const warnings: string[] = [];
  const cpu = p.cpu?.specs;
  const mb = p.motherboard?.specs;
  const gpu = p.gpu?.specs;
  const ramTotal = p.ram.reduce((s, r) => s + (r.specs?.capacity ?? 0), 0);

  if (!prod) return { ok: false, issues: ['Unknown product'], warnings, perf: 0, quality: 0, watts: 0, heat: 0, ramTotal, value: 0 };
  for (const n of prod.needs) {
    if (n === 'ram' && p.ram.length === 0) issues.push('Missing RAM');
    else if (n === 'ssd') {
      if (!p.storage.some((s) => s.defId === 'ssd')) issues.push('Needs an SSD');
    } else if (n !== 'ram' && !(p as unknown as Record<string, unknown>)[n]) issues.push(`Missing ${n.replace('_', ' ')}`);
  }
  if (p.storage.length === 0) issues.push('Missing storage (SSD or HDD)');

  // socket / chipset compatibility
  if (cpu && mb && cpu.socket !== mb.socket) issues.push(`CPU socket ${cpu.socket} ≠ board socket ${mb.socket}`);
  if (mb) {
    for (const r of p.ram) if (r.specs?.ramType !== mb.ramType) issues.push(`RAM ${r.specs?.ramType} not supported (board needs ${mb.ramType})`);
    if (p.ram.length > (mb.ramSlots ?? 2)) issues.push(`Board has only ${mb.ramSlots} RAM slots`);
    if (gpu) {
      if ((gpu.pcie ?? 3) > (mb.pcie ?? 3)) issues.push(`GPU needs PCIe ${gpu.pcie}, board supports PCIe ${mb.pcie}`);
      if ((gpu.gpuLength ?? 0) > (mb.gpuLength ?? 999)) issues.push(`GPU (${gpu.gpuLength}mm) too long for ${mb.formFactor} board (${mb.gpuLength}mm)`);
    }
    if (p.quantum_chip && mb.socket !== 'Q-SOCKET') issues.push('Quantum Chip needs a Q-SOCKET board');
  }
  if (p.storage.length > 3) issues.push('Max 3 storage drives');
  if (ramTotal < prod.minRam) issues.push(`${prod.name} needs ${prod.minRam}GB+ RAM (have ${ramTotal}GB)`);
  if (prod.minCores && (cpu?.cores ?? 0) < prod.minCores) issues.push(`${prod.name} needs a ${prod.minCores}+ core CPU`);
  if (prod.minGpuPerf && (gpu?.perf ?? 0) < prod.minGpuPerf) issues.push(`${prod.name} needs GPU perf ${prod.minGpuPerf}+ (have ${gpu?.perf ?? 0})`);
  if (prod.ramTypes && p.ram.some((r) => !prod.ramTypes!.includes(r.specs?.ramType ?? ''))) issues.push(`${prod.name} needs ${prod.ramTypes.join('/')} RAM`);

  // power & thermals
  const watts = allParts(p).reduce((s, x) => s + (x.specs?.watts ?? 0), 0);
  const supply = p.power_supply?.specs?.supply ?? 0;
  if (p.power_supply && supply < watts * 1.1) issues.push(`PSU ${supply}W too weak: needs ${Math.ceil(watts * 1.1)}W (draw ${watts}W +10%)`);
  const heat = (cpu?.heat ?? 0) + (gpu?.heat ?? 0) + (p.quantum_chip?.specs?.heat ?? 0);
  const cooling = (p.cooling_fan?.specs?.cooling ?? 0) + 60; // stock cooler
  if (heat > cooling) {
    if (prod.needCooling || heat > cooling + 40) issues.push(`Overheating: heat ${heat} > cooling ${cooling}`);
    else warnings.push(`Runs hot (${heat}/${cooling}) — quality reduced`);
  }
  if (mats.scrap < prod.scrap) issues.push(`Needs ${prod.scrap} Scrap Metal (have ${mats.scrap})`);
  if (mats.copper < prod.copper) issues.push(`Needs ${prod.copper} Copper Wire (have ${mats.copper})`);

  // performance & quality
  const ramPerf = p.ram.reduce((s, r) => s + (r.specs?.perf ?? 0), 0);
  const storagePerf = p.storage.reduce((s, r) => s + (r.specs?.perf ?? 0), 0);
  const perf = Math.round((cpu?.perf ?? 0) + (gpu?.perf ?? 0) * 1.25 + ramPerf + storagePerf + (mb?.perf ?? 0) + (p.quantum_chip?.specs?.perf ?? 0));
  const parts = allParts(p);
  let quality = parts.length ? parts.reduce((s, x) => s + (x.quality ?? 50) * (1 + x.rarity * 0.15), 0) / parts.reduce((s, x) => s + (1 + x.rarity * 0.15), 0) : 0;
  if (warnings.some((w) => w.startsWith('Runs hot'))) quality *= 0.85;
  // headroom bonus
  if (supply >= watts * 1.4) quality = Math.min(100, quality + 3);
  quality = Math.round(quality);
  const value = priceFor(productId, perf, quality);
  return { ok: issues.length === 0, issues, warnings, perf, quality, watts, heat, ramTotal, value };
}

export function priceFor(productId: string, perf: number, quality: number): number {
  const prod = PRODUCT_MAP[productId];
  const perfFactor = Math.min(2.2, 0.55 + (perf / prod.refPerf) * 0.6);
  const qFactor = 0.55 + quality / 100;
  return Math.round(prod.basePrice * perfFactor * qFactor);
}

export function assemblePc(productId: string, p: BuildParts, check: BuildCheck, rng: Rng): ItemInstance {
  const prod = PRODUCT_MAP[productId];
  const rarity = Math.min(5, Math.floor(check.quality / 20)) as Rarity;
  return {
    uid: uid(rng), kind: 'pc', defId: productId, rarity, qty: 1, quality: check.quality, name: prod.name,
    pc: { product: productId, perf: check.perf, quality: check.quality, value: check.value, parts: allParts(p).map((x) => x.name ?? x.defId) },
    isNew: true,
  };
}

// ---------------------------------------------------------------------------
// Market, customer orders & contracts
// ---------------------------------------------------------------------------

export interface CustomerOrder {
  id: string;
  customer: string;
  product: string;
  minPerf: number;
  minQuality: number;
  reward: number;
  rep: number;
  expiresDay: number;
  contract?: boolean;
  count?: number;
  note: string;
}

const CUSTOMERS = ['Granny Volt', 'Chip the Courier', 'Neon Bar "Byte"', 'Guild Clerk Ami', 'Professor Ohm', 'Streamer KiraKira', 'Mayor Sato', 'Rogue AI "Kettle"', 'Mechanic Joe', 'Data Monk Ren'];
const NOTES = ['Needs it fast!', 'For my grandson’s birthday.', 'Running a shop downtown.', 'Streaming 8K neon raids.', 'Research simulations.', 'Don’t ask what it’s for.', 'City records backup.', 'Something that won’t melt.'];

/** market price multiplier for a given day & item type (deterministic) */
export function marketMult(day: number, key: string): number {
  const r = new Rng(hashString(`${day}:${key}`));
  return +(0.75 + r.next() * 0.6).toFixed(2);
}

export function componentValue(item: ItemInstance): number {
  const base: Record<string, number> = { cpu: 90, gpu: 140, ram: 50, ssd: 55, hdd: 30, motherboard: 80, cooling_fan: 35, power_supply: 60, quantum_chip: 900 };
  return Math.round((base[item.defId] ?? 20) * Math.pow(1.85, item.rarity) * (0.6 + (item.quality ?? 50) / 125));
}

export function sellPrice(item: ItemInstance, day: number): number {
  switch (item.kind) {
    case 'component':
      return Math.round(componentValue(item) * 0.55 * marketMult(day, item.defId));
    case 'pc':
      return Math.round((item.pc?.value ?? 100) * marketMult(day, `pc:${item.defId}`));
    case 'weapon':
    case 'armor':
    case 'accessory':
      return Math.round(60 * Math.pow(2, item.rarity) * (1 + (item.level ?? 0) * 0.2));
    case 'material':
      return item.defId === 'copper_wire' ? 5 : 3;
    case 'consumable':
      return 15;
  }
}

export function generateOrders(day: number, hunterLevel: number, count = 4): CustomerOrder[] {
  const rng = new Rng(hashString(`orders:${day}`));
  const avail = PRODUCTS.filter((p) => p.unlockLevel <= Math.max(1, hunterLevel));
  const out: CustomerOrder[] = [];
  for (let i = 0; i < count; i++) {
    const prod = rng.pick(avail);
    const minPerf = Math.round(prod.refPerf * rng.range(0.55, 1.0) / 10) * 10;
    const minQuality = rng.pick([30, 40, 50, 60, 70]);
    const reward = Math.round(priceFor(prod.id, minPerf, minQuality) * rng.range(1.25, 1.6));
    out.push({ id: `o${day}_${i}`, customer: rng.pick(CUSTOMERS), product: prod.id, minPerf, minQuality, reward, rep: 1, expiresDay: day + 3, note: rng.pick(NOTES) });
  }
  // special contract every 3 days
  if (day % 3 === 0) {
    const prod = avail[avail.length - 1];
    const minPerf = Math.round(prod.refPerf * 0.9 / 10) * 10;
    out.push({ id: `c${day}`, customer: 'Hunter Guild Contract', product: prod.id, minPerf, minQuality: 65, reward: Math.round(priceFor(prod.id, minPerf, 65) * 2.4), rep: 4, expiresDay: day + 6, contract: true, count: 1, note: 'Guild-certified special contract. Huge payout and reputation.' });
  }
  return out;
}

export function orderFulfils(order: CustomerOrder, pc: ItemInstance): boolean {
  return pc.kind === 'pc' && pc.defId === order.product && (pc.pc?.perf ?? 0) >= order.minPerf && (pc.quality ?? 0) >= order.minQuality;
}

export interface MarketListing {
  id: string;
  item: ItemInstance;
  price: number;
}

/** daily component stock in the market (deterministic per day) */
export function marketStock(day: number, tier: number): MarketListing[] {
  const rng = new Rng(hashString(`market:${day}`));
  const types: ComponentType[] = ['cpu', 'gpu', 'ram', 'ram', 'ssd', 'hdd', 'motherboard', 'cooling_fan', 'power_supply'];
  const out: MarketListing[] = [];
  for (let i = 0; i < 12; i++) {
    const t = types[i % types.length];
    const rarity = Math.min(4, rollRarity(rng, tier * 0.5)) as Rarity;
    const item = generateComponent(t, rarity, rng, tier);
    item.isNew = false;
    out.push({ id: `m${day}_${i}`, item, price: Math.round(componentValue(item) * 1.15 * marketMult(day, t)) });
  }
  return out;
}
