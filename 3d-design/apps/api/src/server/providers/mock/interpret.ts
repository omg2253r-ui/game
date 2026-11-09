import type { Quality, Style } from '@3d-design/shared';

export const ARCHETYPES = [
  'sword',
  'tree',
  'car',
  'house',
  'vase',
  'crystal',
  'chest',
  'rock',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

const ARCHETYPE_WORDS: Record<Exclude<Archetype, 'rock'>, string[]> = {
  sword: ['sword', 'blade', 'katana', 'saber', 'sabre', 'ดาบ', 'กระบี่'],
  tree: [
    'tree',
    'oak',
    'pine',
    'sakura',
    'bonsai',
    'ต้นไม้',
    'ต้นสน',
    'ต้นโอ๊ก',
    'ซากุระ',
    'บอนไซ',
  ],
  car: ['car', 'vehicle', 'truck', 'racer', 'buggy', 'รถยนต์', 'รถแข่ง', 'รถบรรทุก', 'รถ'],
  house: ['house', 'hut', 'cabin', 'cottage', 'shop', 'บ้าน', 'กระท่อม', 'ร้าน'],
  vase: ['vase', 'pot', 'jar', 'urn', 'pottery', 'แจกัน', 'หม้อ', 'โถ', 'ไห'],
  crystal: ['crystal', 'gem', 'ore', 'shard', 'คริสตัล', 'อัญมณี', 'ผลึก'],
  chest: ['chest', 'crate', 'treasure', 'หีบ', 'ลัง'],
};

const COLOR_WORDS: [string[], number][] = [
  [['red', 'crimson', 'แดง'], 0xc8342b],
  [['blue', 'navy', 'น้ำเงิน'], 0x2f5fc0],
  [['cyan', 'sky', 'ฟ้า'], 0x4fb3e8],
  [['green', 'emerald', 'เขียว'], 0x3e9b4f],
  [['yellow', 'เหลือง'], 0xe3b92b],
  [['purple', 'violet', 'ม่วง'], 0x7e4cc2],
  [['pink', 'ชมพู'], 0xe07aa8],
  [['orange', 'ส้ม'], 0xe07b2e],
  [['black', 'ดำ'], 0x222226],
  [['white', 'ขาว'], 0xe9e7e1],
  [['brown', 'น้ำตาล'], 0x7a5232],
  [['gray', 'grey', 'เทา'], 0x8a8d90],
  [['gold', 'golden', 'ทอง'], 0xd4a93a],
  [['silver', 'สีเงิน'], 0xc4c8cd],
];

export type MaterialKind = 'metal' | 'wood' | 'stone' | 'glass' | 'ceramic' | 'default';
const MATERIAL_WORDS: [string[], MaterialKind][] = [
  [['metal', 'steel', 'iron', 'chrome', 'โลหะ', 'เหล็ก', 'โครเมียม'], 'metal'],
  [['wood', 'wooden', 'ไม้'], 'wood'],
  [['stone', 'rock', 'marble', 'หิน', 'หินอ่อน'], 'stone'],
  [['glass', 'ice', 'แก้ว', 'น้ำแข็ง'], 'glass'],
  [['ceramic', 'clay', 'porcelain', 'เซรามิก', 'ดินเผา', 'กระเบื้อง'], 'ceramic'],
];

export interface Interpretation {
  archetype: Archetype;
  colors: number[];
  material: MaterialKind;
  magic: boolean;
  cyber: boolean;
  fantasy: boolean;
  pine: boolean;
  style: Style;
  quality: Quality;
  /** Segment multiplier from quality. */
  detail: number;
}

/** Earliest occurrence wins, so "ดาบที่มีอัญมณี" is a sword with a gem, not a gem. */
function firstIndex(text: string, words: string[]): number {
  let best = Infinity;
  for (const w of words) {
    const i = text.indexOf(w);
    if (i !== -1 && i < best) best = i;
  }
  return best;
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function interpret(
  prompt: string,
  negativePrompt: string,
  style: Style,
  quality: Quality,
): Interpretation {
  const text = prompt.toLowerCase();
  const neg = negativePrompt.toLowerCase();

  let archetype: Archetype = 'rock';
  let bestAt = Infinity;
  for (const [a, words] of Object.entries(ARCHETYPE_WORDS)) {
    const i = firstIndex(text, words);
    if (i < bestAt) {
      bestAt = i;
      archetype = a as Archetype;
    }
  }

  const colors = COLOR_WORDS.map(([words, hex]) => ({ i: firstIndex(text, words), hex, words }))
    .filter((c) => c.i !== Infinity && !has(neg, c.words))
    .sort((a, b) => a.i - b.i)
    .map((c) => c.hex);

  let material: MaterialKind = 'default';
  let matAt = Infinity;
  for (const [words, kind] of MATERIAL_WORDS) {
    const i = firstIndex(text, words);
    // "ไม้" inside "ต้นไม้" is the tree itself, not a material request.
    if (kind === 'wood' && archetype === 'tree' && !has(text, ['wood', 'wooden', 'ทำจากไม้']))
      continue;
    if (i < matAt) {
      matAt = i;
      material = kind;
    }
  }

  return {
    archetype,
    colors,
    material,
    magic:
      has(text, ['magic', 'enchant', 'arcane', 'glow', 'เวท', 'มนตร์', 'เรือง']) &&
      !has(neg, ['glow', 'เรือง']),
    cyber: has(text, ['cyber', 'neon', 'sci-fi', 'scifi', 'futur', 'ไซเบอร์', 'นีออน', 'อนาคต']),
    fantasy: has(text, ['fantasy', 'fairy', 'elven', 'แฟนตาซี', 'เทพนิยาย']),
    pine: has(text, ['pine', 'fir', 'สน']),
    style,
    quality,
    detail: quality === 'draft' ? 0.6 : quality === 'standard' ? 1 : 1.8,
  };
}
