export interface DungeonTheme {
  floor: string;
  wall: string;
  accent: string;
  accent2: string;
  fog: string;
  sky: string;
  prop: 'racks' | 'pipes' | 'barrels' | 'labs' | 'gears';
}

export interface DungeonDef {
  id: string;
  name: string;
  region: string;
  tier: number;
  levels: [number, number];
  boss: string;
  miniBoss: string;
  pool: string[];
  theme: DungeonTheme;
  unlock: string | null;
  rooms: [number, number];
  desc: string;
  music: number;
}

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'data_center', name: 'Abandoned Data Center', region: 'Abandoned City', tier: 0, levels: [1, 6], boss: 'server_golem', miniBoss: 'processor_bot',
    pool: ['scrap_bot', 'scrap_bot', 'processor_bot', 'memory_drone'], unlock: null, rooms: [8, 10], music: 0,
    theme: { floor: '#1b2333', wall: '#2a3550', accent: '#4fd8ff', accent2: '#2a7bff', fog: '#0b1220', sky: '#05080f', prop: 'racks' },
    desc: 'Server halls swarming with scavenger bots. The Server Golem guards the core.',
  },
  {
    id: 'cyber_factory', name: 'Cybernetic Factory', region: 'Cybernetic Factory', tier: 1, levels: [5, 11], boss: 'titan_mech', miniBoss: 'storage_beast',
    pool: ['scrap_bot', 'processor_bot', 'graphics_guardian', 'cooling_mech'], unlock: 'data_center', rooms: [9, 11], music: 1,
    theme: { floor: '#2a2420', wall: '#463a30', accent: '#ffb44f', accent2: '#ff6a2a', fog: '#140e0a', sky: '#0a0705', prop: 'pipes' },
    desc: 'Assembly lines still printing war machines. A Titan Mech oversees production.',
  },
  {
    id: 'nuclear_core', name: 'Nuclear Server Core', region: 'Nuclear Wasteland', tier: 2, levels: [10, 17], boss: 'reactor_beast', miniBoss: 'power_core_golem',
    pool: ['power_core_golem', 'cooling_mech', 'storage_beast', 'scrap_bot'], unlock: 'cyber_factory', rooms: [10, 12], music: 2,
    theme: { floor: '#1d2a18', wall: '#34452a', accent: '#9dff4f', accent2: '#ff5a2a', fog: '#0c140a', sky: '#060a04', prop: 'barrels' },
    desc: 'Irradiated reactor halls. Something enormous feeds on the core.',
  },
  {
    id: 'ai_lab', name: 'AI Research Facility', region: 'AI Research Facility', tier: 3, levels: [16, 23], boss: 'neural_overlord', miniBoss: 'graphics_guardian',
    pool: ['memory_drone', 'graphics_guardian', 'processor_bot', 'cooling_mech'], unlock: 'nuclear_core', rooms: [10, 13], music: 3,
    theme: { floor: '#1f1a2e', wall: '#352b4f', accent: '#d06bff', accent2: '#5cffb0', fog: '#0f0a18', sky: '#07050c', prop: 'labs' },
    desc: 'Clean white labs gone dark. The Neural Overlord rewrites itself constantly.',
  },
  {
    id: 'abyss', name: 'Mechanical Abyss', region: 'Mechanical Abyss', tier: 4, levels: [22, 32], boss: 'omega_machine', miniBoss: 'storage_beast',
    pool: ['storage_beast', 'power_core_golem', 'graphics_guardian', 'memory_drone', 'processor_bot', 'cooling_mech'], unlock: 'ai_lab', rooms: [11, 14], music: 4,
    theme: { floor: '#251418', wall: '#40202a', accent: '#ff3a6b', accent2: '#ffd84a', fog: '#12070a', sky: '#080305', prop: 'gears' },
    desc: 'The bottomless forge where the machines began. Omega waits at the bottom.',
  },
];

export const DUNGEON_MAP: Record<string, DungeonDef> = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));
export const DIFF_LEVEL_OFFSET = [0, 3, 6, 10];

export const ENEMY_COST: Record<string, number> = {
  scrap_bot: 1, processor_bot: 1.3, memory_drone: 1.1, graphics_guardian: 1.6, cooling_mech: 1.4, storage_beast: 2, power_core_golem: 1.8,
};
