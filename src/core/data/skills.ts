import type { Element } from '../types';
import type { StatusId } from '../combat/types';

export type TargetMode = 'enemy' | 'all_enemies' | 'random_enemies' | 'ally' | 'all_allies' | 'self' | 'dead_ally' | 'none';

export type AnimKind = 'slash' | 'dual' | 'shoot' | 'rail' | 'smash' | 'cleave' | 'thrust' | 'reap' | 'cast' | 'heavy' | 'beam' | 'summon' | 'charge' | 'buff' | 'swarm';

export interface ApplyStatus {
  status: StatusId;
  chance: number;
  turns: number;
  stacks?: number;
  value?: number;
  self?: boolean;
  /** apply to every ally of the caster */
  party?: boolean;
}

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  element: Element;
  target: TargetMode;
  power: number; // ATK multiplier per hit (0 = no damage)
  hits?: number;
  randomHits?: number; // for random_enemies
  armorDmg: number; // per hit
  energyCost?: number;
  cooldown?: number;
  priority?: number;
  ignoreDef?: number; // 0..1
  apply?: ApplyStatus[];
  heal?: number; // fraction of target max HP
  healParty?: number; // fraction healed to all allies of caster
  shield?: number; // fraction of caster max HP given as shield
  revive?: number; // fraction of max hp
  cleanse?: boolean;
  dispel?: boolean; // remove buffs from enemy targets
  delay?: boolean; // push target to act last next round
  haste?: boolean; // ally target acts first next round
  executeBonus?: number; // extra multiplier vs targets under 30% hp
  splash?: number; // fraction of damage dealt to other enemies
  summon?: { template: string; count: number };
  charge?: { release: string; turns: number }; // telegraphed attack
  energyGain?: number; // to target ally
  special?: string; // engine hook
  anim: AnimKind;
  vfx: string;
  /** shown on the enemy intent indicator */
  telegraph?: boolean;
  ultCharge?: number;
}

const S: SkillDef[] = [
  // ---------- generic ----------
  { id: 'basic_attack', name: 'Attack', desc: 'Basic weapon strike.', element: 'physical', target: 'enemy', power: 1, armorDmg: 10, anim: 'slash', vfx: 'hit' },

  // ---------- weapon skills ----------
  { id: 'thunder_iai', name: 'Thunder Iai', desc: 'Lightning-quick draw slash. 180% Electric, applies Shock.', element: 'electric', target: 'enemy', power: 1.8, armorDmg: 25, energyCost: 30, apply: [{ status: 'shock', chance: 1, turns: 2 }], anim: 'slash', vfx: 'electric_slash' },
  { id: 'plasma_flurry', name: 'Plasma Flurry', desc: '4 rapid plasma cuts (50% each). Builds chain fast, applies Ionized.', element: 'plasma', target: 'enemy', power: 0.5, hits: 4, armorDmg: 8, energyCost: 30, apply: [{ status: 'ionized', chance: 1, turns: 2 }], anim: 'dual', vfx: 'plasma_slash' },
  { id: 'ion_volley', name: 'Ion Volley', desc: 'Sweeping burst on all enemies (80% Plasma). 60% chance to Ionize.', element: 'plasma', target: 'all_enemies', power: 0.8, armorDmg: 12, energyCost: 35, apply: [{ status: 'ionized', chance: 0.6, turns: 2 }], anim: 'shoot', vfx: 'plasma_shot' },
  { id: 'piercing_rail', name: 'Piercing Rail', desc: 'Charged slug: 240% Electric, ignores 40% DEF.', element: 'electric', target: 'enemy', power: 2.4, armorDmg: 30, energyCost: 40, ignoreDef: 0.4, apply: [{ status: 'shock', chance: 0.5, turns: 2 }], anim: 'rail', vfx: 'rail_beam' },
  { id: 'event_horizon', name: 'Event Horizon', desc: 'Gravity smash: 160%, massive armor damage, Crushes and delays the target.', element: 'gravity', target: 'enemy', power: 1.6, armorDmg: 55, energyCost: 35, delay: true, apply: [{ status: 'crushed', chance: 1, turns: 2 }], anim: 'smash', vfx: 'gravity_well' },
  { id: 'solar_cleave', name: 'Solar Cleave', desc: 'Flaming arc hitting all enemies (110% Fire), applies Burn.', element: 'fire', target: 'all_enemies', power: 1.1, armorDmg: 18, energyCost: 40, apply: [{ status: 'burn', chance: 0.8, turns: 3 }], anim: 'cleave', vfx: 'fire_arc' },
  { id: 'time_lance', name: 'Time Lance', desc: 'Phase-thrust 150% Quantum. Entangles and pushes target to the end of the next round.', element: 'quantum', target: 'enemy', power: 1.5, armorDmg: 22, energyCost: 35, delay: true, apply: [{ status: 'entangled', chance: 1, turns: 2 }], anim: 'thrust', vfx: 'quantum_lance' },
  { id: 'absolute_reap', name: 'Absolute Reap', desc: 'Frozen photon sweep on all enemies (100% Ice), Chill. +60% vs targets under 30% HP.', element: 'ice', target: 'all_enemies', power: 1.0, armorDmg: 15, energyCost: 40, executeBonus: 0.6, apply: [{ status: 'chill', chance: 1, turns: 2, stacks: 1 }], anim: 'reap', vfx: 'ice_sweep' },

  // ---------- ultimates ----------
  { id: 'ult_raijin', name: 'Raijin: Thousand Cuts', desc: '250% Electric to all enemies and Shock all.', element: 'electric', target: 'all_enemies', power: 2.5, armorDmg: 40, apply: [{ status: 'shock', chance: 1, turns: 2 }], anim: 'slash', vfx: 'ult_electric' },
  { id: 'ult_supernova', name: 'Supernova Dance', desc: '6 plasma strikes (70% each) on one target.', element: 'plasma', target: 'enemy', power: 0.7, hits: 6, armorDmg: 12, apply: [{ status: 'ionized', chance: 1, turns: 2 }], anim: 'dual', vfx: 'ult_plasma' },
  { id: 'ult_orbital', name: 'Orbital Lance', desc: 'Satellite strike: 220% Plasma to all enemies.', element: 'plasma', target: 'all_enemies', power: 2.2, armorDmg: 40, anim: 'shoot', vfx: 'ult_orbital' },
  { id: 'ult_hyperrail', name: 'Hyper Rail', desc: '450% Electric to one target, ignores 60% DEF.', element: 'electric', target: 'enemy', power: 4.5, armorDmg: 60, ignoreDef: 0.6, anim: 'rail', vfx: 'ult_rail' },
  { id: 'ult_collapse', name: 'Collapse Star', desc: '200% Gravity to all enemies, Crush and delay all.', element: 'gravity', target: 'all_enemies', power: 2.0, armorDmg: 60, delay: true, apply: [{ status: 'crushed', chance: 1, turns: 2 }], anim: 'smash', vfx: 'ult_gravity' },
  { id: 'ult_phoenix', name: 'Phoenix Calamity', desc: '240% Fire to all enemies and heal the party 15%.', element: 'fire', target: 'all_enemies', power: 2.4, armorDmg: 35, healParty: 0.15, apply: [{ status: 'burn', chance: 1, turns: 3 }], anim: 'cleave', vfx: 'ult_fire' },
  { id: 'ult_overdrive', name: 'Quantum Overdrive', desc: '300% Quantum to one target. Whole party gains Haste (acts first next round).', element: 'quantum', target: 'enemy', power: 3.0, armorDmg: 45, apply: [{ status: 'haste', chance: 1, turns: 1, party: true }, { status: 'spd_up', chance: 1, turns: 2, party: true }], anim: 'thrust', vfx: 'ult_quantum' },
  { id: 'ult_eclipse', name: 'Frozen Eclipse', desc: '220% Ice to all enemies, 2 Chill stacks (Freeze). Execute bonus.', element: 'ice', target: 'all_enemies', power: 2.2, armorDmg: 35, executeBonus: 0.8, apply: [{ status: 'chill', chance: 1, turns: 2, stacks: 2 }], anim: 'reap', vfx: 'ult_ice' },

  // ---------- tech skills (unlocked via skill tree) ----------
  { id: 'nano_repair', name: 'Nano Repair', desc: 'Heal an ally for 30% max HP and grant Regen.', element: 'physical', target: 'ally', power: 0, armorDmg: 0, energyCost: 30, heal: 0.3, apply: [{ status: 'regen', chance: 1, turns: 2 }], anim: 'cast', vfx: 'heal' },
  { id: 'overclock', name: 'Overclock', desc: 'Ally gains Haste (acts first next round), SPD+ and +25 Energy.', element: 'electric', target: 'ally', power: 0, armorDmg: 0, energyCost: 25, haste: true, energyGain: 25, apply: [{ status: 'spd_up', chance: 1, turns: 2 }], anim: 'buff', vfx: 'buff', priority: 1 },
  { id: 'emp_pulse', name: 'EMP Pulse', desc: '60% Electric to all enemies, strips their buffs, applies Shock.', element: 'electric', target: 'all_enemies', power: 0.6, armorDmg: 15, energyCost: 30, dispel: true, apply: [{ status: 'shock', chance: 0.7, turns: 2 }], anim: 'cast', vfx: 'emp' },
  { id: 'barrier_field', name: 'Barrier Field', desc: 'Shield all allies for 18% of your max HP.', element: 'quantum', target: 'all_allies', power: 0, armorDmg: 0, energyCost: 35, shield: 0.18, anim: 'cast', vfx: 'shield', priority: 1 },
  { id: 'reboot_protocol', name: 'Reboot Protocol', desc: 'Revive a fallen ally with 35% HP.', element: 'physical', target: 'dead_ally', power: 0, armorDmg: 0, energyCost: 50, revive: 0.35, anim: 'cast', vfx: 'revive' },
  { id: 'cryo_mine', name: 'Cryo Mine', desc: '90% Ice to one enemy, 2 Chill stacks (Freeze).', element: 'ice', target: 'enemy', power: 0.9, armorDmg: 20, energyCost: 30, apply: [{ status: 'chill', chance: 1, turns: 2, stacks: 2 }], anim: 'cast', vfx: 'ice_burst' },
  { id: 'thermite_charge', name: 'Thermite Charge', desc: '120% Fire to one enemy, Burn.', element: 'fire', target: 'enemy', power: 1.2, armorDmg: 25, energyCost: 30, apply: [{ status: 'burn', chance: 1, turns: 3 }], anim: 'cast', vfx: 'explosion' },

  // ---------- team ----------
  { id: 'team_combo', name: 'Team Combination', desc: 'Two hunters strike together with both elements.', element: 'physical', target: 'enemy', power: 1.5, armorDmg: 40, anim: 'slash', vfx: 'combo' },
  { id: 'team_finisher', name: 'Team Finisher', desc: 'Combined finisher on a Broken enemy.', element: 'physical', target: 'enemy', power: 2.4, armorDmg: 0, anim: 'slash', vfx: 'combo' },
  { id: 'team_ultimate', name: 'Team Ultimate: Scrapstorm', desc: 'Every hunter unleashes everything. Massive multi-element damage to all enemies.', element: 'quantum', target: 'all_enemies', power: 1.4, armorDmg: 50, anim: 'slash', vfx: 'team_ult' },

  // ---------- enemy skills ----------
  { id: 'e_strike', name: 'Strike', desc: 'Basic attack.', element: 'physical', target: 'enemy', power: 1, armorDmg: 0, anim: 'slash', vfx: 'hit' },
  { id: 'e_heavy', name: 'Heavy Slam', desc: 'Powerful slam (170%).', element: 'physical', target: 'enemy', power: 1.7, armorDmg: 0, cooldown: 2, anim: 'heavy', vfx: 'impact', telegraph: true },
  { id: 'e_scrap_toss', name: 'Scrap Toss', desc: 'Throws debris at two random hunters.', element: 'physical', target: 'random_enemies', randomHits: 2, power: 0.7, armorDmg: 0, cooldown: 2, anim: 'swarm', vfx: 'debris' },
  { id: 'e_zap', name: 'Overvolt Zap', desc: 'Electric shot, may Shock.', element: 'electric', target: 'enemy', power: 1.1, armorDmg: 0, apply: [{ status: 'shock', chance: 0.4, turns: 2 }], anim: 'beam', vfx: 'electric' },
  { id: 'e_overclock_ally', name: 'Overclock Allies', desc: 'Boosts allied machines’ ATK and SPD.', element: 'electric', target: 'all_allies', power: 0, armorDmg: 0, cooldown: 3, apply: [{ status: 'atk_up', chance: 1, turns: 2 }, { status: 'spd_up', chance: 1, turns: 2 }], anim: 'buff', vfx: 'buff' },
  { id: 'e_render_barrier', name: 'Render Barrier', desc: 'Shields an ally machine.', element: 'plasma', target: 'ally', power: 0, armorDmg: 0, cooldown: 2, shield: 0.25, anim: 'buff', vfx: 'shield' },
  { id: 'e_ray_trace', name: 'Ray-Trace Beam', desc: 'Concentrated plasma beam.', element: 'plasma', target: 'enemy', power: 1.4, armorDmg: 0, apply: [{ status: 'ionized', chance: 0.5, turns: 2 }], anim: 'beam', vfx: 'plasma_beam' },
  { id: 'e_defrag', name: 'Defrag Heal', desc: 'Repairs the most damaged machine.', element: 'quantum', target: 'ally', power: 0, armorDmg: 0, cooldown: 2, heal: 0.3, anim: 'cast', vfx: 'heal' },
  { id: 'e_cache_pulse', name: 'Cache Pulse', desc: 'Quantum pulse on all hunters.', element: 'quantum', target: 'all_enemies', power: 0.55, armorDmg: 0, cooldown: 2, anim: 'cast', vfx: 'quantum_pulse' },
  { id: 'e_data_crunch', name: 'Data Crunch', desc: 'Crushing bite (200%).', element: 'physical', target: 'enemy', power: 2.0, armorDmg: 0, cooldown: 3, anim: 'heavy', vfx: 'impact', telegraph: true },
  { id: 'e_harden', name: 'Harden Shell', desc: 'Raises DEF and restores armor.', element: 'physical', target: 'self', power: 0, armorDmg: 0, cooldown: 3, special: 'restore_armor', apply: [{ status: 'def_up', chance: 1, turns: 2, self: true }], anim: 'buff', vfx: 'shield' },
  { id: 'e_frost_vent', name: 'Frost Vent', desc: 'Freezing mist on all hunters, Chill.', element: 'ice', target: 'all_enemies', power: 0.6, armorDmg: 0, cooldown: 2, apply: [{ status: 'chill', chance: 0.6, turns: 2, stacks: 1 }], anim: 'cast', vfx: 'ice_burst' },
  { id: 'e_ice_shard', name: 'Ice Shard', desc: 'Ice spike.', element: 'ice', target: 'enemy', power: 1.1, armorDmg: 0, apply: [{ status: 'chill', chance: 0.35, turns: 2, stacks: 1 }], anim: 'beam', vfx: 'ice_shard' },
  { id: 'e_flame_jet', name: 'Flame Jet', desc: 'Fire stream, may Burn.', element: 'fire', target: 'enemy', power: 1.15, armorDmg: 0, apply: [{ status: 'burn', chance: 0.5, turns: 3 }], anim: 'beam', vfx: 'fire' },
  { id: 'e_core_overload_charge', name: 'Core Overload (charging)', desc: 'The core glows… it will explode next round! Break its armor to interrupt.', element: 'fire', target: 'none', power: 0, armorDmg: 0, cooldown: 4, charge: { release: 'e_core_overload', turns: 1 }, anim: 'charge', vfx: 'charge', telegraph: true },
  { id: 'e_core_overload', name: 'Core Overload', desc: 'Explosive fire burst on all hunters.', element: 'fire', target: 'all_enemies', power: 1.6, armorDmg: 0, apply: [{ status: 'burn', chance: 0.7, turns: 2 }], anim: 'heavy', vfx: 'explosion' },
  { id: 'e_guard', name: 'Guard', desc: 'Defensive stance.', element: 'physical', target: 'self', power: 0, armorDmg: 0, cooldown: 2, apply: [{ status: 'guard', chance: 1, turns: 1, self: true }], anim: 'buff', vfx: 'shield', priority: 2 },

  // ---------- boss skills ----------
  { id: 'b_server_crash_charge', name: 'Server Crash (charging)', desc: 'Cores spin up for a crushing crash. Break armor to interrupt!', element: 'electric', target: 'none', power: 0, armorDmg: 0, cooldown: 4, charge: { release: 'b_server_crash', turns: 1 }, anim: 'charge', vfx: 'charge', telegraph: true },
  { id: 'b_server_crash', name: 'Server Crash', desc: 'Massive electric shock wave.', element: 'electric', target: 'all_enemies', power: 1.7, armorDmg: 0, apply: [{ status: 'shock', chance: 0.8, turns: 2 }], anim: 'heavy', vfx: 'ult_electric' },
  { id: 'b_spawn_drones', name: 'Spawn Cache Drones', desc: 'Deploys Memory Drones that power the Data Shield.', element: 'quantum', target: 'none', power: 0, armorDmg: 0, cooldown: 5, summon: { template: 'memory_drone', count: 2 }, special: 'data_shield', anim: 'summon', vfx: 'summon', telegraph: true },
  { id: 'b_byte_slam', name: 'Byte Slam', desc: 'Heavy fist (150%).', element: 'physical', target: 'enemy', power: 1.5, armorDmg: 0, anim: 'heavy', vfx: 'impact' },
  { id: 'b_orbital_charge', name: 'Orbital Cannon (charging)', desc: 'Satellite locks on. Next round: devastating strike. Break armor to interrupt!', element: 'plasma', target: 'none', power: 0, armorDmg: 0, cooldown: 4, charge: { release: 'b_orbital_cannon', turns: 1 }, anim: 'charge', vfx: 'charge', telegraph: true },
  { id: 'b_orbital_cannon', name: 'Orbital Cannon', desc: 'Annihilating plasma column on all hunters.', element: 'plasma', target: 'all_enemies', power: 2.1, armorDmg: 0, anim: 'heavy', vfx: 'ult_orbital' },
  { id: 'b_missile_barrage', name: 'Missile Barrage', desc: '5 missiles at random hunters.', element: 'fire', target: 'random_enemies', randomHits: 5, power: 0.55, armorDmg: 0, cooldown: 2, anim: 'swarm', vfx: 'missiles' },
  { id: 'b_titan_stomp', name: 'Titan Stomp', desc: 'Quake on all hunters, delays them.', element: 'gravity', target: 'all_enemies', power: 0.8, armorDmg: 0, cooldown: 3, delay: true, anim: 'heavy', vfx: 'quake' },
  { id: 'b_meltdown_pulse', name: 'Meltdown Pulse', desc: 'Radiation wave scaling with Meltdown stacks.', element: 'fire', target: 'all_enemies', power: 0.7, armorDmg: 0, special: 'meltdown_scale', anim: 'cast', vfx: 'explosion' },
  { id: 'b_reactor_bite', name: 'Reactor Bite', desc: 'Searing bite, Burns.', element: 'fire', target: 'enemy', power: 1.5, armorDmg: 0, apply: [{ status: 'burn', chance: 1, turns: 3 }], anim: 'heavy', vfx: 'fire' },
  { id: 'b_reactor_explosion', name: 'Reactor Explosion', desc: 'Meltdown reaches critical mass!', element: 'fire', target: 'all_enemies', power: 2.6, armorDmg: 0, special: 'reset_meltdown', anim: 'heavy', vfx: 'ult_fire' },
  { id: 'b_mind_hack', name: 'Mind Hack', desc: 'Hijacks a hunter: they attack their allies next round.', element: 'quantum', target: 'enemy', power: 0.6, armorDmg: 0, cooldown: 3, apply: [{ status: 'hacked', chance: 1, turns: 1 }], anim: 'cast', vfx: 'hack', telegraph: true },
  { id: 'b_neural_lance', name: 'Neural Lance', desc: 'Psionic spear (160%).', element: 'quantum', target: 'enemy', power: 1.6, armorDmg: 0, anim: 'beam', vfx: 'quantum_lance' },
  { id: 'b_adaptive_shell', name: 'Adaptive Shell', desc: 'Rewrites its weaknesses and shields itself.', element: 'quantum', target: 'self', power: 0, armorDmg: 0, cooldown: 4, special: 'adapt', shield: 0.12, anim: 'buff', vfx: 'shield' },
  { id: 'b_thought_storm', name: 'Thought Storm', desc: 'Quantum storm on all hunters.', element: 'quantum', target: 'all_enemies', power: 1.0, armorDmg: 0, cooldown: 2, anim: 'cast', vfx: 'quantum_pulse' },
  { id: 'b_omega_beam', name: 'Omega Beam', desc: 'Annihilation beam (180%).', element: 'plasma', target: 'enemy', power: 1.8, armorDmg: 0, anim: 'beam', vfx: 'plasma_beam' },
  { id: 'b_omega_summon', name: 'Fabricate Legion', desc: 'Fabricates machine soldiers.', element: 'physical', target: 'none', power: 0, armorDmg: 0, cooldown: 4, summon: { template: 'scrap_bot', count: 2 }, anim: 'summon', vfx: 'summon' },
  { id: 'b_omega_protocol', name: 'Omega Protocol', desc: 'Countdown to total annihilation. Break its armor to reset the countdown!', element: 'quantum', target: 'none', power: 0, armorDmg: 0, cooldown: 99, special: 'start_countdown', anim: 'charge', vfx: 'charge', telegraph: true },
  { id: 'b_omega_end', name: 'Omega End', desc: 'Total annihilation.', element: 'quantum', target: 'all_enemies', power: 4.0, armorDmg: 0, anim: 'heavy', vfx: 'ult_quantum' },
  { id: 'b_gravity_crush', name: 'Graviton Crush', desc: 'Crushes all hunters.', element: 'gravity', target: 'all_enemies', power: 0.9, armorDmg: 0, cooldown: 2, apply: [{ status: 'crushed', chance: 0.5, turns: 2 }], anim: 'heavy', vfx: 'gravity_well' },
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(S.map((s) => [s.id, s]));

export function getSkill(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error(`Unknown skill ${id}`);
  return s;
}

export const TECH_SKILLS = ['nano_repair', 'overclock', 'emp_pulse', 'barrier_field', 'reboot_protocol', 'cryo_mine', 'thermite_charge'];
