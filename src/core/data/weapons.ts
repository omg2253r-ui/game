import type { Element } from '../types';

export type WeaponClass = 'katana' | 'dual' | 'rifle' | 'railgun' | 'hammer' | 'greatsword' | 'spear' | 'scythe';

export interface WeaponDef {
  id: string;
  name: string;
  cls: WeaponClass;
  element: Element;
  damage: number; // flat ATK at +0 common
  speed: number; // SPD modifier
  critRate: number;
  critDmg: number;
  skill: string;
  ultimate: string;
  passive: string;
  passiveName: string;
  passiveDesc: string;
  ranged: boolean;
  color: string; // energy colour for VFX / model
  desc: string;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'energy_katana', name: 'Energy Katana', cls: 'katana', element: 'electric', damage: 34, speed: 8, critRate: 0.1, critDmg: 0.6,
    skill: 'thunder_iai', ultimate: 'ult_raijin', passive: 'followup_shock', passiveName: 'Static Echo',
    passiveDesc: 'When an ally hits a Shocked enemy, follow up with a 60% Electric slash (once per round).',
    ranged: false, color: '#58d6ff', desc: 'Fast electric blade. Spreads Shock to set up Plasma Burst and Superconduct.',
  },
  {
    id: 'dual_plasma', name: 'Dual Plasma Blades', cls: 'dual', element: 'plasma', damage: 28, speed: 12, critRate: 0.15, critDmg: 0.5,
    skill: 'plasma_flurry', ultimate: 'ult_supernova', passive: 'chain_master', passiveName: 'Chain Master',
    passiveDesc: 'Chain bonus +5% per stack on your hits; chain cap raised to 8.',
    ranged: false, color: '#ff4fd8', desc: 'Multi-hit plasma twins. Best chain builder in the game.',
  },
  {
    id: 'plasma_rifle', name: 'Plasma Rifle', cls: 'rifle', element: 'plasma', damage: 30, speed: 4, critRate: 0.08, critDmg: 0.5,
    skill: 'ion_volley', ultimate: 'ult_orbital', passive: 'energy_siphon', passiveName: 'Energy Siphon',
    passiveDesc: 'Gain +6 Energy for every enemy hit.',
    ranged: true, color: '#c070ff', desc: 'Ranged area control. Ionizes groups of machines.',
  },
  {
    id: 'railgun', name: 'Railgun', cls: 'railgun', element: 'electric', damage: 40, speed: -6, critRate: 0.2, critDmg: 0.9,
    skill: 'piercing_rail', ultimate: 'ult_hyperrail', passive: 'overwatch', passiveName: 'Overwatch',
    passiveDesc: 'Whenever an enemy becomes Broken, fire an 80% follow-up shot at it.',
    ranged: true, color: '#7dfcff', desc: 'Huge single-target crits. Punishes broken armor.',
  },
  {
    id: 'gravity_hammer', name: 'Gravity Hammer', cls: 'hammer', element: 'gravity', damage: 44, speed: -10, critRate: 0.05, critDmg: 0.5,
    skill: 'event_horizon', ultimate: 'ult_collapse', passive: 'breaker', passiveName: 'Armor Breaker',
    passiveDesc: '+50% armor damage on every hit.',
    ranged: false, color: '#8a6bff', desc: 'Slow and devastating. The fastest way to Armor Break.',
  },
  {
    id: 'energy_greatsword', name: 'Energy Greatsword', cls: 'greatsword', element: 'fire', damage: 42, speed: -4, critRate: 0.08, critDmg: 0.6,
    skill: 'solar_cleave', ultimate: 'ult_phoenix', passive: 'last_stand', passiveName: 'Last Stand',
    passiveDesc: '+30% ATK while below 40% HP.',
    ranged: false, color: '#ff7a2f', desc: 'Burning sweeps hit every enemy. Ultimate heals the party.',
  },
  {
    id: 'quantum_spear', name: 'Quantum Spear', cls: 'spear', element: 'quantum', damage: 36, speed: 6, critRate: 0.1, critDmg: 0.6,
    skill: 'time_lance', ultimate: 'ult_overdrive', passive: 'phase_shift', passiveName: 'Phase Shift',
    passiveDesc: 'The first hit you take each battle is phased out (no damage).',
    ranged: false, color: '#5cffb0', desc: 'Turn manipulation specialist: delays foes, hastes friends.',
  },
  {
    id: 'photon_scythe', name: 'Photon Scythe', cls: 'scythe', element: 'ice', damage: 38, speed: 2, critRate: 0.12, critDmg: 0.7,
    skill: 'absolute_reap', ultimate: 'ult_eclipse', passive: 'reaper', passiveName: 'Reaper',
    passiveDesc: '+30% damage to targets below 30% HP. Kills restore 20 Energy.',
    ranged: false, color: '#a8f0ff', desc: 'Freezing sweeps and executions.',
  },
];

export const WEAPON_MAP: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export const RARITY_WEAPON_MULT = [1, 1.12, 1.26, 1.42, 1.6, 1.85];
export const MAX_WEAPON_LEVEL = 10;

/** ATK provided by a weapon instance */
export function weaponAtk(def: WeaponDef, rarity: number, level: number): number {
  return Math.round(def.damage * RARITY_WEAPON_MULT[rarity] * (1 + 0.1 * level));
}

/** crit bonuses grow with rarity */
export function weaponCrit(def: WeaponDef, rarity: number, level: number) {
  return { critRate: def.critRate + rarity * 0.01 + (level >= 10 ? 0.05 : 0), critDmg: def.critDmg + rarity * 0.05 };
}

/** skill power bonus from enhancement milestones */
export function weaponSkillBonus(level: number): number {
  return (level >= 5 ? 0.1 : 0) + (level >= 10 ? 0.15 : 0);
}

export function upgradeCost(rarity: number, level: number) {
  return {
    credits: Math.round(120 * Math.pow(1.45, level) * (1 + rarity * 0.35)),
    scrap: 3 + level * 2,
    copper: level >= 4 ? level - 2 : 0,
  };
}
