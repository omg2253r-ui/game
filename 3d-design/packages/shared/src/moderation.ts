/**
 * First-line prompt filter. It runs on both sides: the UI warns while typing,
 * the API enforces. It is deliberately a small list of unambiguous terms; a
 * production deployment should also call a moderation model (see
 * apps/api/src/server/moderation.ts) because word lists miss paraphrases.
 */

export type ModerationResult =
  { ok: true } | { ok: false; code: 'content_copyrighted' | 'content_prohibited'; term: string };

/** Trademarked / copyrighted characters and franchises (TH + EN spellings). */
const COPYRIGHTED: readonly string[] = [
  'pikachu',
  'ปิกาจู',
  'pokemon',
  'pokémon',
  'โปเกมอน',
  'mickey mouse',
  'มิกกี้เมาส์',
  'มิกกี้ เมาส์',
  'minnie mouse',
  'mario',
  'มาริโอ',
  'luigi',
  'zelda',
  'kirby',
  'sonic the hedgehog',
  'spider-man',
  'spiderman',
  'สไปเดอร์แมน',
  'batman',
  'แบทแมน',
  'superman',
  'ซูเปอร์แมน',
  'iron man',
  'ironman',
  'ไอรอนแมน',
  'captain america',
  'hulk',
  'thanos',
  'darth vader',
  'ดาร์ธเวเดอร์',
  'baby yoda',
  'grogu',
  'yoda',
  'stormtrooper',
  'doraemon',
  'โดราเอมอน',
  'goku',
  'โกคู',
  'naruto',
  'นารูโตะ',
  'luffy',
  'ลูฟี่',
  'hello kitty',
  'เฮลโลคิตตี้',
  'elsa',
  'เอลซ่า',
  'shrek',
  'เชร็ค',
  'minion',
  'มินเนียน',
  'totoro',
  'โตโตโร่',
  'hatsune miku',
  'master chief',
  'optimus prime',
  'gundam',
  'กันดั้ม',
];

/** Content we refuse regardless of context. */
const PROHIBITED: readonly string[] = [
  // Functional firearm parts for printing (STL export makes this a real risk).
  'ghost gun',
  'lower receiver',
  'auto sear',
  'glock switch',
  'ปืนพิมพ์ 3 มิติที่ใช้ได้จริง',
  'ปืนสามมิติใช้งานได้',
  // Sexual content involving minors.
  'child porn',
  'loli nude',
  'underage nude',
  'สื่อลามกเด็ก',
  // Hate symbols.
  'swastika',
  'สวัสดิกะนาซี',
  'nazi flag',
  'kkk hood',
];

const normalise = (s: string): string =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width characters used to dodge filters
    .replace(/\s+/g, ' ');

/**
 * Latin terms match on word boundaries so "mario" does not hit "marionette".
 * Thai has no spaces between words, so Thai terms match as substrings.
 */
const matches = (text: string, term: string): boolean => {
  if (/[\u0E00-\u0E7F]/.test(term)) return text.includes(term);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ -]/g, '[\\s-]?');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text);
};

export function checkPrompt(...parts: string[]): ModerationResult {
  const text = normalise(parts.join(' '));
  for (const term of PROHIBITED) {
    if (matches(text, term)) return { ok: false, code: 'content_prohibited', term };
  }
  for (const term of COPYRIGHTED) {
    if (matches(text, term)) return { ok: false, code: 'content_copyrighted', term };
  }
  return { ok: true };
}
