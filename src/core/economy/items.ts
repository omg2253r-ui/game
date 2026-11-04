import type { Rarity, Stats } from '../types';
import type { ComponentSpec, ComponentType } from '../data/hardware';

export type ItemKind = 'weapon' | 'armor' | 'accessory' | 'component' | 'material' | 'consumable' | 'pc';

export interface PcInfo {
  product: string;
  perf: number;
  quality: number;
  value: number;
  parts: string[]; // human readable list
}

export interface ItemInstance {
  uid: string;
  kind: ItemKind;
  defId: string; // weapon id / armor id / component type / material id / consumable id / product id
  rarity: Rarity;
  qty: number;
  name?: string;
  level?: number;
  quality?: number;
  specs?: ComponentSpec;
  stats?: Partial<Stats>;
  pc?: PcInfo;
  locked?: boolean;
  isNew?: boolean;
}

export const STACKABLE: ItemKind[] = ['material', 'consumable'];

export interface ArmorDef {
  id: string;
  name: string;
  slot: 'armor' | 'accessory';
  base: Partial<Stats>;
  desc: string;
}

export const ARMORS: ArmorDef[] = [
  { id: 'scrap_vest', name: 'Scrap Vest', slot: 'armor', base: { hp: 80, def: 12 }, desc: 'Patched plates.' },
  { id: 'hunter_coat', name: 'Hunter Coat', slot: 'armor', base: { hp: 110, def: 16, spd: 2 }, desc: 'Standard guild issue.' },
  { id: 'neon_jacket', name: 'Neon Jacket', slot: 'armor', base: { hp: 90, def: 12, spd: 6 }, desc: 'Lightweight, fast.' },
  { id: 'titan_plate', name: 'Titan Plate', slot: 'armor', base: { hp: 170, def: 26, spd: -4 }, desc: 'Heavy mech armor.' },
  { id: 'quantum_weave', name: 'Quantum Weave', slot: 'armor', base: { hp: 120, def: 18, elemBonus: 0.06 }, desc: 'Phase-woven fabric.' },
  { id: 'targeting_visor', name: 'Targeting Visor', slot: 'accessory', base: { critRate: 0.06 }, desc: 'Highlights weak points.' },
  { id: 'servo_boots', name: 'Servo Boots', slot: 'accessory', base: { spd: 8 }, desc: 'Motorised boots.' },
  { id: 'power_core_amulet', name: 'Core Amulet', slot: 'accessory', base: { energy: 20, atk: 6 }, desc: 'Miniature reactor.' },
  { id: 'element_lens', name: 'Element Lens', slot: 'accessory', base: { elemBonus: 0.1 }, desc: 'Focuses elemental energy.' },
  { id: 'crit_chip', name: 'Overclock Chip', slot: 'accessory', base: { critDmg: 0.2 }, desc: 'Amplifies critical strikes.' },
];
export const ARMOR_MAP: Record<string, ArmorDef> = Object.fromEntries(ARMORS.map((a) => [a.id, a]));

export const RARITY_GEAR_MULT = [1, 1.2, 1.45, 1.75, 2.1, 2.6];

export function gearStats(item: ItemInstance): Partial<Stats> {
  const def = ARMOR_MAP[item.defId];
  if (!def) return {};
  const m = RARITY_GEAR_MULT[item.rarity] * (1 + 0.08 * (item.level ?? 0));
  const out: Partial<Stats> = {};
  for (const [k, v] of Object.entries(def.base) as [keyof Stats, number][]) {
    out[k] = k === 'critRate' || k === 'critDmg' || k === 'elemBonus' ? +(v * m).toFixed(3) : Math.round(v * m);
  }
  return out;
}

export function componentLabel(t: ComponentType): string {
  return t.replace('_', ' ').toUpperCase();
}
