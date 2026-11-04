import type { Element, Stats } from '../types';
import type { ElementProfile } from '../combat/types';

export type AiProfile = 'brute' | 'support' | 'guardian' | 'healer' | 'tank' | 'controller' | 'bomber' | 'boss';

export interface PhaseDef {
  /** hp fraction at which this phase begins */
  at: number;
  name: string;
  skills: string[];
  /** declarative transition effects */
  onEnter: { summon?: { template: string; count: number }; restoreArmor?: boolean; buff?: string[]; adapt?: boolean; shield?: number; countdown?: boolean; profile?: Partial<ElementProfile> };
  line: string;
}

export interface DropEntry {
  item: string; // material / component def id
  w: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  model: string;
  element: Element;
  base: Stats; // level-1 stats
  armor: number;
  profile: ElementProfile;
  skills: string[];
  ai: AiProfile;
  exp: number;
  credits: [number, number];
  drops: DropEntry[];
  dropCount: [number, number];
  boss?: boolean;
  phases?: PhaseDef[];
  passives?: string[];
  size: number; // model scale
  desc: string;
  color: string;
}

const st = (hp: number, atk: number, def: number, spd: number, critRate = 0.05, critDmg = 0.5): Stats => ({ hp, atk, def, spd, critRate, critDmg, energy: 100, elemBonus: 0 });

export const ENEMIES: EnemyDef[] = [
  {
    id: 'scrap_bot', name: 'Scrap Bot', model: 'scrap_bot', element: 'physical', base: st(260, 42, 22, 92), armor: 40,
    profile: { weak: ['electric', 'gravity'], resist: [], immune: [] },
    skills: ['e_strike', 'e_heavy', 'e_scrap_toss', 'e_guard'], ai: 'brute', exp: 22, credits: [12, 25],
    drops: [{ item: 'scrap_metal', w: 50 }, { item: 'copper_wire', w: 30 }, { item: 'hdd', w: 12 }, { item: 'cooling_fan', w: 8 }], dropCount: [1, 2],
    size: 1, color: '#c98a3c', desc: 'Junk-built brawler. Weak to Electric and Gravity.',
  },
  {
    id: 'processor_bot', name: 'Processor Bot', model: 'processor_bot', element: 'electric', base: st(230, 46, 20, 108), armor: 35,
    profile: { weak: ['ice', 'quantum'], resist: ['electric'], immune: [] },
    skills: ['e_zap', 'e_overclock_ally', 'e_strike'], ai: 'support', exp: 28, credits: [16, 30],
    drops: [{ item: 'cpu', w: 40 }, { item: 'copper_wire', w: 30 }, { item: 'motherboard', w: 20 }, { item: 'scrap_metal', w: 10 }], dropCount: [1, 2],
    size: 0.95, color: '#3cc8ff', desc: 'Overclocks its allies. Kill it first. Weak to Ice and Quantum.',
  },
  {
    id: 'graphics_guardian', name: 'Graphics Guardian', model: 'graphics_guardian', element: 'plasma', base: st(380, 44, 34, 88), armor: 70,
    profile: { weak: ['gravity', 'fire'], resist: ['plasma'], immune: [] },
    skills: ['e_ray_trace', 'e_render_barrier', 'e_guard'], ai: 'guardian', exp: 34, credits: [20, 38],
    drops: [{ item: 'gpu', w: 45 }, { item: 'cooling_fan', w: 30 }, { item: 'power_supply', w: 15 }, { item: 'scrap_metal', w: 10 }], dropCount: [1, 2],
    size: 1.15, color: '#7dff6b', desc: 'Shields allies with render barriers. Weak to Gravity and Fire.',
  },
  {
    id: 'memory_drone', name: 'Memory Drone', model: 'memory_drone', element: 'quantum', base: st(190, 38, 16, 118), armor: 25,
    profile: { weak: ['electric', 'plasma'], resist: ['quantum'], immune: ['gravity'] },
    skills: ['e_defrag', 'e_cache_pulse', 'e_strike'], ai: 'healer', exp: 24, credits: [14, 26],
    drops: [{ item: 'ram', w: 50 }, { item: 'ssd', w: 30 }, { item: 'copper_wire', w: 20 }], dropCount: [1, 2],
    size: 0.8, color: '#ff6be0', desc: 'Flying repair unit — immune to Gravity. Weak to Electric and Plasma.',
  },
  {
    id: 'storage_beast', name: 'Storage Beast', model: 'storage_beast', element: 'physical', base: st(520, 54, 40, 80), armor: 100,
    profile: { weak: ['fire', 'plasma'], resist: ['physical', 'gravity'], immune: [] },
    skills: ['e_strike', 'e_data_crunch', 'e_harden'], ai: 'tank', exp: 44, credits: [26, 46],
    drops: [{ item: 'hdd', w: 35 }, { item: 'ssd', w: 30 }, { item: 'motherboard', w: 25 }, { item: 'scrap_metal', w: 10 }], dropCount: [2, 3],
    size: 1.35, color: '#8f7cff', desc: 'Heavily armored data-hoarder. Weak to Fire and Plasma.',
  },
  {
    id: 'cooling_mech', name: 'Cooling Mech', model: 'cooling_mech', element: 'ice', base: st(330, 46, 30, 95), armor: 55,
    profile: { weak: ['fire', 'electric'], resist: [], immune: ['ice'] },
    skills: ['e_ice_shard', 'e_frost_vent', 'e_strike'], ai: 'controller', exp: 32, credits: [18, 34],
    drops: [{ item: 'cooling_fan', w: 55 }, { item: 'scrap_metal', w: 25 }, { item: 'copper_wire', w: 20 }], dropCount: [1, 2],
    size: 1.1, color: '#9ff4ff', desc: 'Freezes hunters solid. Immune to Ice. Weak to Fire and Electric.',
  },
  {
    id: 'power_core_golem', name: 'Power Core Golem', model: 'power_core_golem', element: 'fire', base: st(460, 58, 32, 84), armor: 80,
    profile: { weak: ['ice', 'quantum'], resist: ['fire'], immune: [] },
    skills: ['e_flame_jet', 'e_core_overload_charge', 'e_strike'], ai: 'bomber', exp: 42, credits: [24, 44],
    drops: [{ item: 'power_supply', w: 50 }, { item: 'copper_wire', w: 30 }, { item: 'cpu', w: 20 }], dropCount: [1, 3],
    size: 1.3, color: '#ff8a3c', desc: 'Charges Core Overload — break its armor to interrupt! Weak to Ice and Quantum.',
  },

  // ---------------- BOSSES ----------------
  {
    id: 'server_golem', name: 'Server Golem', model: 'server_golem', element: 'electric', base: st(2300, 62, 36, 90), armor: 160,
    profile: { weak: ['ice', 'gravity'], resist: ['electric'], immune: [] },
    skills: ['b_byte_slam', 'b_spawn_drones', 'e_zap'], ai: 'boss', exp: 260, credits: [240, 320], boss: true,
    drops: [{ item: 'cpu', w: 25 }, { item: 'motherboard', w: 25 }, { item: 'ram', w: 25 }, { item: 'ssd', w: 25 }], dropCount: [3, 4],
    phases: [
      { at: 1, name: 'Boot Sequence', skills: ['b_byte_slam', 'b_spawn_drones', 'e_zap'], onEnter: {}, line: 'INTRUDERS DETECTED. INITIALISING DATA SHIELD.' },
      { at: 0.5, name: 'Overclocked Cores', skills: ['b_byte_slam', 'b_server_crash_charge', 'e_zap', 'b_spawn_drones'], onEnter: { restoreArmor: true, buff: ['spd_up', 'atk_up'] }, line: 'THERMAL LIMITS DISABLED. SERVER CRASH IMMINENT.' },
    ],
    size: 2.2, color: '#4fd8ff', desc: 'Data Shield (−80% damage) holds while its drones live. Destroy the drones!',
  },
  {
    id: 'titan_mech', name: 'Titan Mech', model: 'titan_mech', element: 'physical', base: st(3400, 72, 46, 86), armor: 220,
    profile: { weak: ['electric', 'quantum'], resist: ['physical', 'fire'], immune: [] },
    skills: ['b_byte_slam', 'b_orbital_charge', 'b_titan_stomp'], ai: 'boss', exp: 420, credits: [380, 480], boss: true,
    drops: [{ item: 'gpu', w: 30 }, { item: 'power_supply', w: 30 }, { item: 'cooling_fan', w: 20 }, { item: 'motherboard', w: 20 }], dropCount: [3, 5],
    phases: [
      { at: 1, name: 'Siege Mode', skills: ['b_byte_slam', 'b_orbital_charge', 'b_titan_stomp'], onEnter: {}, line: 'TITAN ONLINE. TARGET LOCK ACQUIRED.' },
      { at: 0.5, name: 'Missile Protocol', skills: ['b_missile_barrage', 'b_orbital_charge', 'b_titan_stomp', 'b_byte_slam'], onEnter: { restoreArmor: true, buff: ['def_up'] }, line: 'ARMOR RECONFIGURED. RELEASING ORDNANCE.' },
    ],
    size: 2.6, color: '#ffb44f', desc: 'Orbital Cannon is telegraphed: Defend, or break its armor to cancel it.',
  },
  {
    id: 'reactor_beast', name: 'Reactor Beast', model: 'reactor_beast', element: 'fire', base: st(4400, 80, 44, 94), armor: 200,
    profile: { weak: ['ice', 'quantum'], resist: ['fire', 'plasma'], immune: [] },
    skills: ['b_reactor_bite', 'b_meltdown_pulse', 'e_flame_jet'], ai: 'boss', exp: 600, credits: [520, 660], boss: true, passives: ['meltdown'],
    drops: [{ item: 'power_supply', w: 35 }, { item: 'cpu', w: 25 }, { item: 'gpu', w: 25 }, { item: 'cooling_fan', w: 15 }], dropCount: [3, 5],
    phases: [
      { at: 1, name: 'Critical Heat', skills: ['b_reactor_bite', 'b_meltdown_pulse', 'e_flame_jet'], onEnter: {}, line: '*the reactor roars — the temperature keeps rising*' },
      { at: 0.4, name: 'Chain Reaction', skills: ['b_reactor_bite', 'b_meltdown_pulse', 'e_core_overload_charge'], onEnter: { restoreArmor: true, buff: ['atk_up'] }, line: '*the core splits open, spewing plasma*' },
    ],
    size: 2.4, color: '#ff5a2a', desc: 'Gains Meltdown each round (+ATK). At 5 stacks it explodes. Ice hits remove stacks.',
  },
  {
    id: 'neural_overlord', name: 'Neural Overlord', model: 'neural_overlord', element: 'quantum', base: st(4400, 86, 48, 104), armor: 210,
    profile: { weak: ['electric', 'physical'], resist: ['quantum'], immune: [] },
    skills: ['b_neural_lance', 'b_mind_hack', 'b_thought_storm'], ai: 'boss', exp: 820, credits: [700, 880], boss: true,
    drops: [{ item: 'quantum_chip', w: 30 }, { item: 'cpu', w: 25 }, { item: 'ram', w: 25 }, { item: 'gpu', w: 20 }], dropCount: [3, 5],
    phases: [
      { at: 1, name: 'Cognition', skills: ['b_neural_lance', 'b_mind_hack', 'b_thought_storm'], onEnter: {}, line: 'YOUR THOUGHTS ARE… DELICIOUS DATA.' },
      { at: 0.66, name: 'Adaptation', skills: ['b_neural_lance', 'b_mind_hack', 'b_adaptive_shell', 'b_thought_storm'], onEnter: { adapt: true, restoreArmor: true }, line: 'WEAKNESS PATCHED. RECALCULATING.' },
      { at: 0.33, name: 'Singularity Mind', skills: ['b_neural_lance', 'b_mind_hack', 'b_adaptive_shell', 'b_thought_storm', 'b_spawn_drones'], onEnter: { adapt: true, buff: ['spd_up'], summon: { template: 'memory_drone', count: 1 } }, line: 'I AM EVERY MACHINE AT ONCE.' },
    ],
    size: 2.2, color: '#d06bff', desc: 'Mind Hack turns hunters against each other. Rewrites its weaknesses every phase — Scan it!',
  },
  {
    id: 'omega_machine', name: 'Omega Machine', model: 'omega_machine', element: 'quantum', base: st(5400, 96, 54, 98), armor: 260,
    profile: { weak: ['gravity', 'fire'], resist: ['physical'], immune: ['electric'] },
    skills: ['b_omega_beam', 'b_omega_summon', 'b_gravity_crush'], ai: 'boss', exp: 1400, credits: [1200, 1500], boss: true,
    drops: [{ item: 'quantum_chip', w: 40 }, { item: 'gpu', w: 20 }, { item: 'cpu', w: 20 }, { item: 'motherboard', w: 20 }], dropCount: [4, 6],
    phases: [
      { at: 1, name: 'Genesis', skills: ['b_omega_beam', 'b_omega_summon', 'b_gravity_crush'], onEnter: {}, line: 'I WAS BUILT TO END WHAT YOU STARTED.' },
      { at: 0.6, name: 'Inversion', skills: ['b_omega_beam', 'b_gravity_crush', 'b_thought_storm', 'b_missile_barrage'], onEnter: { restoreArmor: true, profile: { weak: ['electric', 'ice'], resist: ['fire'], immune: ['gravity'] } }, line: 'POLARITY INVERTED. YOUR WEAPONS FAIL YOU.' },
      { at: 0.3, name: 'Omega Protocol', skills: ['b_omega_beam', 'b_gravity_crush', 'b_omega_summon'], onEnter: { restoreArmor: true, countdown: true, buff: ['atk_up'], profile: { weak: ['quantum', 'plasma'], resist: [], immune: [] } }, line: 'OMEGA PROTOCOL ENGAGED. 3… 2…' },
    ],
    size: 2.8, color: '#ff3a6b', desc: 'Inverts its elements twice. In the final phase a countdown begins — Armor Break resets it.',
  },
];

export const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
export const NORMAL_ENEMIES = ENEMIES.filter((e) => !e.boss).map((e) => e.id);
export const BOSSES = ENEMIES.filter((e) => e.boss).map((e) => e.id);
