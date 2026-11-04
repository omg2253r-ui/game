import type { Element } from '../types';
import type { StatusId } from '../combat/types';

export interface ConsumableDef {
  id: string;
  name: string;
  desc: string;
  target: 'ally' | 'dead_ally' | 'enemy' | 'all_enemies';
  heal?: number;
  revive?: number;
  energy?: number;
  cleanse?: boolean;
  damage?: { element: Element; base: number; perLevel: number; status?: StatusId; turns?: number };
  price: number;
  icon: string;
}

export const CONSUMABLES: ConsumableDef[] = [
  { id: 'repair_kit', name: 'Repair Kit', desc: 'Restore 35% max HP to an ally.', target: 'ally', heal: 0.35, price: 60, icon: '🔧' },
  { id: 'nano_revive', name: 'Nano Revive', desc: 'Revive a downed ally with 40% HP.', target: 'dead_ally', revive: 0.4, price: 220, icon: '💉' },
  { id: 'energy_cell', name: 'Energy Cell', desc: 'Restore 50 Energy to an ally.', target: 'ally', energy: 50, price: 90, icon: '🔋' },
  { id: 'coolant_spray', name: 'Coolant Spray', desc: 'Remove all debuffs (incl. Hacked, Burn, Chill) from an ally.', target: 'ally', cleanse: true, price: 70, icon: '🧊' },
  { id: 'emp_grenade', name: 'EMP Grenade', desc: 'Electric blast on all enemies, applies Shock.', target: 'all_enemies', damage: { element: 'electric', base: 60, perLevel: 12, status: 'shock', turns: 2 }, price: 140, icon: '⚡' },
  { id: 'thermite_grenade', name: 'Thermite Grenade', desc: 'Fire blast on one enemy, applies Burn.', target: 'enemy', damage: { element: 'fire', base: 90, perLevel: 16, status: 'burn', turns: 3 }, price: 120, icon: '🔥' },
];

export const CONSUMABLE_MAP: Record<string, ConsumableDef> = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]));

export interface StatusInfo {
  name: string;
  icon: string;
  color: string;
  debuff: boolean;
  desc: string;
}

export const STATUS_INFO: Record<StatusId, StatusInfo> = {
  shock: { name: 'Shock', icon: '⚡', color: '#5fd8ff', debuff: true, desc: 'Electric damage each round. Reacts with Plasma, Ice and Fire.' },
  burn: { name: 'Burn', icon: '🔥', color: '#ff7a3a', debuff: true, desc: 'Fire damage each round. Reacts with Ice, Electric and Plasma.' },
  chill: { name: 'Chill', icon: '❄', color: '#a8ecff', debuff: true, desc: '-15% SPD per stack. 2 stacks = Frozen.' },
  frozen: { name: 'Frozen', icon: '🧊', color: '#d4f8ff', debuff: true, desc: 'Skips its next action. Physical hits Shatter it.' },
  ionized: { name: 'Ionized', icon: '✦', color: '#d083ff', debuff: true, desc: '-15% DEF. Reacts with Electric and Fire.' },
  crushed: { name: 'Crushed', icon: '◉', color: '#8f7bff', debuff: true, desc: '-20% DEF and acts later. Reacts with Quantum.' },
  entangled: { name: 'Entangled', icon: '∞', color: '#5cffb0', debuff: true, desc: 'Next hit echoes 40% extra Quantum damage. Reacts with Gravity.' },
  superconduct: { name: 'Superconduct', icon: '⇊', color: '#7fe4ff', debuff: true, desc: '-40% DEF.' },
  broken: { name: 'ARMOR BREAK', icon: '✖', color: '#ffd84a', debuff: true, desc: 'Stunned, takes +25% damage. Enables Team Finisher.' },
  weakpoint: { name: 'Weak Point', icon: '◎', color: '#ffe66b', debuff: true, desc: 'Scanned: +30% crit rate against this target.' },
  atk_up: { name: 'ATK Up', icon: '▲', color: '#ff8a6b', debuff: false, desc: '+25% ATK.' },
  def_up: { name: 'DEF Up', icon: '⛨', color: '#6bc0ff', debuff: false, desc: '+30% DEF.' },
  spd_up: { name: 'SPD Up', icon: '»', color: '#6bffb8', debuff: false, desc: '+20% SPD.' },
  spd_down: { name: 'SPD Down', icon: '«', color: '#9aa0b8', debuff: true, desc: '-20% SPD.' },
  atk_down: { name: 'ATK Down', icon: '▼', color: '#9aa0b8', debuff: true, desc: '-25% ATK.' },
  haste: { name: 'Haste', icon: '⏩', color: '#7dffcf', debuff: false, desc: 'Acts first next round.' },
  delay: { name: 'Delayed', icon: '⏪', color: '#b28cff', debuff: true, desc: 'Acts last next round.' },
  shield: { name: 'Shield', icon: '⬡', color: '#8fd8ff', debuff: false, desc: 'Absorbs damage.' },
  regen: { name: 'Regen', icon: '✚', color: '#6bff8f', debuff: false, desc: 'Heals 8% max HP each round.' },
  barrier: { name: 'Data Shield', icon: '⛉', color: '#4fd8ff', debuff: false, desc: 'Takes 80% less damage while its drones live.' },
  charging: { name: 'Charging', icon: '☢', color: '#ff4f6b', debuff: false, desc: 'A devastating attack is coming. Break armor to interrupt!' },
  hacked: { name: 'Hacked', icon: '⌁', color: '#ff4fd8', debuff: true, desc: 'Attacks a random ally instead of acting.' },
  meltdown: { name: 'Meltdown', icon: '☣', color: '#ff6b2a', debuff: false, desc: '+12% ATK per stack. Explodes at 5 stacks.' },
  countdown: { name: 'Omega Countdown', icon: '⏳', color: '#ff3a6b', debuff: false, desc: 'Annihilation when it reaches 0. Armor Break resets it.' },
  evasion: { name: 'Evasion', icon: '↯', color: '#c8ffef', debuff: false, desc: '70% chance to evade single-target attacks this round.' },
  guard: { name: 'Guard', icon: '⛊', color: '#9ad0ff', debuff: false, desc: 'Takes 50% damage this round.' },
};

export const DEBUFFS: StatusId[] = (Object.keys(STATUS_INFO) as StatusId[]).filter((k) => STATUS_INFO[k].debuff && k !== 'broken' && k !== 'weakpoint');
export const BUFFS: StatusId[] = ['atk_up', 'def_up', 'spd_up', 'haste', 'shield', 'regen'];
