/** Computer hardware loot definitions. */

export type ComponentType = 'cpu' | 'gpu' | 'ram' | 'ssd' | 'hdd' | 'motherboard' | 'cooling_fan' | 'power_supply' | 'quantum_chip';
export type MaterialType = 'scrap_metal' | 'copper_wire';
export type Socket = 'AM-X' | 'LGA-Z' | 'Q-SOCKET';
export type RamType = 'DDR4' | 'DDR5' | 'QRAM';

export interface ComponentSpec {
  socket?: Socket;
  ramType?: RamType;
  cores?: number;
  perf?: number; // performance score
  watts?: number; // power draw (negative = PSU supply)
  heat?: number; // heat output / cooling capacity for fans
  capacity?: number; // GB
  pcie?: number; // PCIe generation (GPU requirement / board support)
  formFactor?: 'mini' | 'atx' | 'eatx';
  gpuLength?: number; // mm
  ramSlots?: number;
  supply?: number; // PSU watts
  cooling?: number; // fan cooling capacity
  qubits?: number;
}

export interface MaterialDef {
  id: string;
  name: string;
  kind: 'material' | 'component';
  icon: string;
  basePrice: number;
  desc: string;
}

export const MATERIALS: MaterialDef[] = [
  { id: 'scrap_metal', name: 'Scrap Metal', kind: 'material', icon: '🔩', basePrice: 6, desc: 'Used for PC cases and weapon upgrades.' },
  { id: 'copper_wire', name: 'Copper Wire', kind: 'material', icon: '🧵', basePrice: 9, desc: 'Cabling for PCs; needed for high weapon upgrades.' },
  { id: 'cpu', name: 'CPU', kind: 'component', icon: '🧠', basePrice: 90, desc: 'Processor. Socket must match the motherboard.' },
  { id: 'gpu', name: 'GPU', kind: 'component', icon: '🎮', basePrice: 140, desc: 'Graphics card. Needs PCIe support, power and cooling.' },
  { id: 'ram', name: 'RAM', kind: 'component', icon: '📏', basePrice: 50, desc: 'Memory. Type must match the motherboard.' },
  { id: 'ssd', name: 'SSD', kind: 'component', icon: '💾', basePrice: 55, desc: 'Fast storage.' },
  { id: 'hdd', name: 'HDD', kind: 'component', icon: '🗄', basePrice: 30, desc: 'Bulk storage.' },
  { id: 'motherboard', name: 'Motherboard', kind: 'component', icon: '🟩', basePrice: 80, desc: 'Defines socket, RAM type, PCIe generation and form factor.' },
  { id: 'cooling_fan', name: 'Cooling Fan', kind: 'component', icon: '🌀', basePrice: 35, desc: 'Cooling capacity must exceed CPU + GPU heat.' },
  { id: 'power_supply', name: 'Power Supply', kind: 'component', icon: '🔌', basePrice: 60, desc: 'Must supply 110% of the build’s power draw.' },
  { id: 'quantum_chip', name: 'Quantum Chip', kind: 'component', icon: '⚛', basePrice: 900, desc: 'Ancient tech. Required for Quantum PCs (Q-SOCKET).' },
];

export const MATERIAL_MAP: Record<string, MaterialDef> = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));

export const COMPONENT_TYPES: ComponentType[] = ['cpu', 'gpu', 'ram', 'ssd', 'hdd', 'motherboard', 'cooling_fan', 'power_supply', 'quantum_chip'];

export const COMPONENT_LABEL: Record<ComponentType, string> = {
  cpu: 'CPU', gpu: 'GPU', ram: 'RAM', ssd: 'SSD', hdd: 'HDD', motherboard: 'Motherboard', cooling_fan: 'Cooling Fan', power_supply: 'Power Supply', quantum_chip: 'Quantum Chip',
};

export const MODEL_NAMES: Record<ComponentType, string[]> = {
  cpu: ['Scrapdragon', 'Corex', 'Ryzan', 'Neuron', 'Hypercore', 'Omnicore'],
  gpu: ['PixelPush', 'Raytron', 'VoxelForce', 'Radiant', 'Titanis', 'Infinity'],
  ram: ['MemStick', 'FlashLane', 'Vortex', 'Dominus', 'Paragon', 'Eternity'],
  ssd: ['QuickDisk', 'NanoStore', 'Blaze', 'Velocity', 'Hyperion', 'Zero-Lag'],
  hdd: ['SpinDrive', 'Barrel', 'Archive', 'Vault', 'Monolith', 'Abyssal'],
  motherboard: ['BaseBoard', 'CircuitOne', 'Apex', 'Sovereign', 'Overlord', 'Genesis'],
  cooling_fan: ['Breeze', 'Cyclone', 'Glacier', 'Blizzard', 'Cryostorm', 'Absolute Zero'],
  power_supply: ['Spark', 'Dynamo', 'Fusion', 'Reactor', 'Stellar', 'Singularity'],
  quantum_chip: ['Qubit', 'Entangler', 'Superposer', 'Tesseract', 'Paradox', 'Omega'],
};
