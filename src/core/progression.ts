import type { Appearance, Stats } from './types';
import { addStats } from './types';
import { WEAPON_MAP, weaponAtk, weaponCrit } from './data/weapons';
import type { HunterBuild } from './combat/units';
import { gearStats, type ItemInstance } from './economy/items';

export const MAX_LEVEL = 40;

export function expToNext(level: number): number {
  return Math.round(60 * Math.pow(level, 1.55));
}

export interface HunterSave {
  id: string;
  name: string;
  isMain: boolean;
  look: Appearance;
  level: number;
  exp: number;
  skillPoints: number;
  tree: string[];
  weaponUid?: string;
  armorUid?: string;
  accessoryUid?: string;
}

export interface TreeNode {
  id: string;
  name: string;
  branch: 'offense' | 'defense' | 'tech';
  cost: number;
  requires?: string;
  stat?: Partial<Stats> & { atkPct?: number; hpPct?: number; defPct?: number };
  skill?: string;
  passive?: string;
  desc: string;
  row: number;
  col: number;
}

export const SKILL_TREE: TreeNode[] = [
  { id: 'atk1', name: 'Power Cells', branch: 'offense', cost: 1, stat: { atkPct: 0.08 }, desc: '+8% ATK', row: 0, col: 0 },
  { id: 'crit1', name: 'Precision', branch: 'offense', cost: 1, requires: 'atk1', stat: { critRate: 0.06 }, desc: '+6% Crit Rate', row: 1, col: 0 },
  { id: 'thermite', name: 'Thermite Charge', branch: 'offense', cost: 2, requires: 'atk1', skill: 'thermite_charge', desc: 'Skill: 120% Fire + Burn', row: 1, col: 1 },
  { id: 'critdmg', name: 'Overcharge', branch: 'offense', cost: 2, requires: 'crit1', stat: { critDmg: 0.25 }, desc: '+25% Crit DMG', row: 2, col: 0 },
  { id: 'ult_amp', name: 'Ultimate Amp', branch: 'offense', cost: 3, requires: 'critdmg', passive: 'ult_amp', desc: 'Ultimate deals +25% damage', row: 3, col: 0 },
  { id: 'hp1', name: 'Reinforced Plating', branch: 'defense', cost: 1, stat: { hpPct: 0.12 }, desc: '+12% HP', row: 0, col: 0 },
  { id: 'def1', name: 'Kinetic Dampers', branch: 'defense', cost: 1, requires: 'hp1', stat: { defPct: 0.12 }, desc: '+12% DEF', row: 1, col: 0 },
  { id: 'nano', name: 'Nano Repair', branch: 'defense', cost: 2, requires: 'hp1', skill: 'nano_repair', desc: 'Skill: heal ally 30% + Regen', row: 1, col: 1 },
  { id: 'barrier', name: 'Barrier Field', branch: 'defense', cost: 2, requires: 'def1', skill: 'barrier_field', desc: 'Skill: party shield', row: 2, col: 0 },
  { id: 'reboot', name: 'Reboot Protocol', branch: 'defense', cost: 3, requires: 'nano', skill: 'reboot_protocol', desc: 'Skill: revive ally 35%', row: 2, col: 1 },
  { id: 'energy1', name: 'Capacitor', branch: 'tech', cost: 1, stat: { energy: 20 }, desc: '+20 Max Energy', row: 0, col: 0 },
  { id: 'spd1', name: 'Servo Tuning', branch: 'tech', cost: 1, requires: 'energy1', stat: { spd: 8 }, desc: '+8 SPD', row: 1, col: 0 },
  { id: 'elem1', name: 'Elemental Tuning', branch: 'tech', cost: 1, requires: 'energy1', stat: { elemBonus: 0.12 }, desc: '+12% Elemental DMG', row: 1, col: 1 },
  { id: 'overclock', name: 'Overclock', branch: 'tech', cost: 2, requires: 'spd1', skill: 'overclock', desc: 'Skill: ally Haste + Energy', row: 2, col: 0 },
  { id: 'cryo', name: 'Cryo Mine', branch: 'tech', cost: 2, requires: 'elem1', skill: 'cryo_mine', desc: 'Skill: 90% Ice, Freeze', row: 2, col: 1 },
  { id: 'emp', name: 'EMP Pulse', branch: 'tech', cost: 2, requires: 'elem1', skill: 'emp_pulse', desc: 'Skill: AoE Electric, dispel', row: 3, col: 1 },
  { id: 'protocol', name: 'Follow-up Protocol', branch: 'tech', cost: 3, requires: 'overclock', passive: 'followup_protocol', desc: 'Follow up when an ally triggers a reaction', row: 3, col: 0 },
];
export const TREE_MAP: Record<string, TreeNode> = Object.fromEntries(SKILL_TREE.map((n) => [n.id, n]));

export function canLearn(h: HunterSave, nodeId: string): string | null {
  const n = TREE_MAP[nodeId];
  if (!n) return 'Unknown node';
  if (h.tree.includes(nodeId)) return 'Already learned';
  if (n.requires && !h.tree.includes(n.requires)) return `Requires ${TREE_MAP[n.requires].name}`;
  if (h.skillPoints < n.cost) return 'Not enough skill points';
  return null;
}

export function baseStats(level: number, body: 0 | 1 = 0): Stats {
  const l = level - 1;
  return {
    hp: Math.round((520 + 62 * l) * (body ? 1.08 : 1)),
    atk: Math.round(58 + 8.5 * l),
    def: Math.round((36 + 4.5 * l) * (body ? 1.08 : 1)),
    spd: body ? 96 : 102,
    critRate: 0.05,
    critDmg: 0.5,
    energy: 100,
    elemBonus: 0,
  };
}

export function findItem(inv: ItemInstance[], uid?: string): ItemInstance | undefined {
  return uid ? inv.find((i) => i.uid === uid) : undefined;
}

/** derive full combat stats for a hunter from progression + equipment */
export function hunterStats(h: HunterSave, inv: ItemInstance[]): { stats: Stats; weaponId: string; weaponLevel: number } {
  let s = baseStats(h.level, h.look.body);
  const weapon = findItem(inv, h.weaponUid);
  const wdef = WEAPON_MAP[weapon?.defId ?? 'energy_katana'];
  const wr = weapon?.rarity ?? 0;
  const wl = weapon?.level ?? 0;
  s = addStats(s, { atk: weaponAtk(wdef, wr, wl), spd: wdef.speed, ...weaponCrit(wdef, wr, wl) });
  for (const uid of [h.armorUid, h.accessoryUid]) {
    const g = findItem(inv, uid);
    if (g) s = addStats(s, gearStats(g));
  }
  let atkPct = 0, hpPct = 0, defPct = 0;
  for (const id of h.tree) {
    const n = TREE_MAP[id];
    if (!n?.stat) continue;
    const { atkPct: a, hpPct: hp, defPct: d, ...rest } = n.stat;
    atkPct += a ?? 0;
    hpPct += hp ?? 0;
    defPct += d ?? 0;
    s = addStats(s, rest);
  }
  s.atk = Math.round(s.atk * (1 + atkPct));
  s.hp = Math.round(s.hp * (1 + hpPct));
  s.def = Math.round(s.def * (1 + defPct));
  s.critRate = +Math.min(0.9, s.critRate).toFixed(3);
  return { stats: s, weaponId: wdef.id, weaponLevel: wl };
}

export function hunterBuild(h: HunterSave, inv: ItemInstance[], ownerId?: string): HunterBuild {
  const { stats, weaponId, weaponLevel } = hunterStats(h, inv);
  const w = WEAPON_MAP[weaponId];
  const skills = [w.skill, ...h.tree.map((id) => TREE_MAP[id]?.skill).filter(Boolean) as string[]];
  const passives = [w.passive, ...h.tree.map((id) => TREE_MAP[id]?.passive).filter(Boolean) as string[]];
  return { id: h.id, name: h.name, level: h.level, stats, weaponId, weaponLevel, element: w.element, skills, ultimate: w.ultimate, passives, look: h.look, ownerId };
}

export function powerRating(stats: Stats): number {
  return Math.round(stats.hp * 0.25 + stats.atk * 4 + stats.def * 2.5 + stats.spd * 2 + stats.critRate * 600 + stats.critDmg * 250);
}

/** apply exp, returns levels gained */
export function grantExp(h: HunterSave, exp: number): number {
  let gained = 0;
  h.exp += Math.max(0, Math.round(exp));
  while (h.level < MAX_LEVEL && h.exp >= expToNext(h.level)) {
    h.exp -= expToNext(h.level);
    h.level++;
    h.skillPoints += 1;
    gained++;
  }
  if (h.level >= MAX_LEVEL) h.exp = Math.min(h.exp, expToNext(h.level));
  return gained;
}

// ---------------------------------------------------------------------------
// Companions recruited at the Hunter Guild
// ---------------------------------------------------------------------------

export interface CompanionDef {
  id: string;
  name: string;
  weapon: string;
  look: Appearance;
  cost: number;
  bio: string;
  tree: string[];
}

export const COMPANIONS: CompanionDef[] = [
  { id: 'rin', name: 'Rin', weapon: 'energy_katana', cost: 0, tree: [], bio: 'Your old partner. Calm, fast, deadly with a blade.', look: { hair: 2, hairColor: '#2b2f4a', eyeColor: '#5fd8ff', skin: '#ffe0cf', outfit: 1, outfitColor: '#1d2240', accentColor: '#58d6ff', accessory: 0, body: 0 } },
  { id: 'vex', name: 'Vex', weapon: 'plasma_rifle', cost: 0, tree: [], bio: 'Ex-corporate sniper who now shoots the robots she used to build.', look: { hair: 4, hairColor: '#ff5fb8', eyeColor: '#c070ff', skin: '#f6d2bd', outfit: 2, outfitColor: '#2b1838', accentColor: '#ff4fd8', accessory: 1, body: 0 } },
  { id: 'mako', name: 'Mako', weapon: 'gravity_hammer', cost: 600, tree: ['hp1'], bio: 'Scrapyard bruiser. Speaks only in hammer.', look: { hair: 1, hairColor: '#e8e1d0', eyeColor: '#ffb44f', skin: '#d7a283', outfit: 3, outfitColor: '#3a2a1a', accentColor: '#8a6bff', accessory: 2, body: 1 } },
  { id: 'yuki', name: 'Yuki', weapon: 'photon_scythe', cost: 900, tree: ['energy1'], bio: 'Quiet cryo-engineer with a terrifying scythe.', look: { hair: 3, hairColor: '#dff6ff', eyeColor: '#7fe4ff', skin: '#fff0e6', outfit: 0, outfitColor: '#e8f3ff', accentColor: '#a8f0ff', accessory: 3, body: 0 } },
  { id: 'kaito', name: 'Kaito', weapon: 'railgun', cost: 1400, tree: ['atk1'], bio: 'Railgun prodigy. Never misses, never shuts up.', look: { hair: 0, hairColor: '#ffcf4a', eyeColor: '#7dfcff', skin: '#f2c9a8', outfit: 1, outfitColor: '#1a2a2f', accentColor: '#7dfcff', accessory: 1, body: 0 } },
  { id: 'nova', name: 'Nova', weapon: 'quantum_spear', cost: 2200, tree: ['energy1', 'spd1'], bio: 'Time-displaced lancer from a future that no longer exists.', look: { hair: 5, hairColor: '#5cffb0', eyeColor: '#5cffb0', skin: '#e9c4ae', outfit: 2, outfitColor: '#10241c', accentColor: '#5cffb0', accessory: 3, body: 0 } },
  { id: 'blaze', name: 'Blaze', weapon: 'energy_greatsword', cost: 1800, tree: ['hp1'], bio: 'Former arena champion. Swings a sun.', look: { hair: 1, hairColor: '#ff6a2a', eyeColor: '#ffb44f', skin: '#e3b08f', outfit: 3, outfitColor: '#3a1a10', accentColor: '#ff7a2f', accessory: 0, body: 1 } },
  { id: 'luna', name: 'Luna', weapon: 'dual_plasma', cost: 1600, tree: ['atk1'], bio: 'Acrobatic thief who steals from machines.', look: { hair: 4, hairColor: '#9a7bff', eyeColor: '#ff4fd8', skin: '#ffe6d6', outfit: 2, outfitColor: '#22163a', accentColor: '#ff4fd8', accessory: 2, body: 0 } },
];
export const COMPANION_MAP: Record<string, CompanionDef> = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));
