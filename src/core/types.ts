export type Element = 'physical' | 'electric' | 'fire' | 'ice' | 'plasma' | 'gravity' | 'quantum';
export const ELEMENTS: Element[] = ['physical', 'electric', 'fire', 'ice', 'plasma', 'gravity', 'quantum'];

export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5;
export const RARITY_COLORS = ['#c8c8d0', '#5fe08a', '#4fa3ff', '#c27bff', '#ffc044', '#ff5fd2'];

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number; // 0..1
  critDmg: number; // bonus multiplier, 0.5 = +50%
  energy: number; // max energy
  elemBonus: number; // 0.1 = +10% elemental damage
}

export const emptyStats = (): Stats => ({ hp: 0, atk: 0, def: 0, spd: 0, critRate: 0, critDmg: 0, energy: 0, elemBonus: 0 });

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  return {
    hp: a.hp + (b.hp ?? 0),
    atk: a.atk + (b.atk ?? 0),
    def: a.def + (b.def ?? 0),
    spd: a.spd + (b.spd ?? 0),
    critRate: a.critRate + (b.critRate ?? 0),
    critDmg: a.critDmg + (b.critDmg ?? 0),
    energy: a.energy + (b.energy ?? 0),
    elemBonus: a.elemBonus + (b.elemBonus ?? 0),
  };
}

export type Difficulty = 0 | 1 | 2 | 3;
export const DIFFICULTIES = ['Normal', 'Hard', 'Nightmare', 'Abyss'] as const;

export interface Appearance {
  hair: number; // style index
  hairColor: string;
  eyeColor: string;
  skin: string;
  outfit: number; // style index
  outfitColor: string;
  accentColor: string;
  accessory: number; // 0 none, 1 visor, 2 headphones, 3 cat-ear antenna
  body: 0 | 1; // 0 slim, 1 sturdy
}
