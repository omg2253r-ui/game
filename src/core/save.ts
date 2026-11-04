/**
 * Save data schema, creation, migration, validation and anti-cheat plausibility checks.
 * Shared by the client (local save) and the Worker (server save).
 */
import { Rng, hashString, uid } from './rng';
import type { Appearance, Rarity } from './types';
import { COMPANION_MAP, MAX_LEVEL, TREE_MAP, expToNext, type HunterSave } from './progression';
import { WEAPON_MAP } from './data/weapons';
import { ARMOR_MAP, STACKABLE, type ItemInstance, type ItemKind } from './economy/items';
import { CONSUMABLE_MAP } from './data/items';
import { MATERIAL_MAP } from './data/hardware';
import { PRODUCT_MAP, type CustomerOrder } from './economy/crafting';
import { DUNGEON_MAP } from './data/regions';
import { ENEMY_MAP } from './data/enemies';

export const SAVE_VERSION = 2;
export const INVENTORY_CAP = 150;
export const STORAGE_CAP = 400;
export const MAX_CREDITS = 99_999_999;

export interface QuestState {
  id: string;
  kind: 'kill' | 'clear' | 'build' | 'sell';
  target: string;
  count: number;
  progress: number;
  reward: number;
  exp: number;
  title: string;
  done: boolean;
  claimed: boolean;
}

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  music: number;
  sfx: number;
  showFps: boolean;
  camSensitivity: number;
  autoBattleSpeed: number;
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  playTime: number;
  name: string;
  credits: number;
  reputation: number;
  hunters: HunterSave[];
  party: string[]; // up to 4 hunter ids (index 3 = reserve)
  inventory: ItemInstance[];
  storage: ItemInstance[];
  cleared: Record<string, number>; // dungeon id -> highest difficulty cleared (0..3), -1 none
  orders: CustomerOrder[];
  completedOrders: string[];
  quests: QuestState[];
  questDay: number;
  day: number;
  dayStartedAt: number;
  stats: { kills: number; battles: number; wins: number; bossKills: number; pcsBuilt: number; pcsSold: number; reactions: number; breaks: number; maxChain: number; chestsOpened: number };
  position?: { x: number; z: number };
  settings: Settings;
  tutorial: Record<string, boolean>;
  grantsClaimed: string[];
}

export function defaultSettings(): Settings {
  return { quality: 'medium', music: 0.5, sfx: 0.7, showFps: false, camSensitivity: 1, autoBattleSpeed: 1 };
}

export function newSave(name: string, look: Appearance, weaponId: string): SaveData {
  const rng = new Rng(hashString(name + Date.now()));
  const now = Date.now();
  const mainWeapon: ItemInstance = { uid: uid(rng), kind: 'weapon', defId: weaponId, rarity: 0, qty: 1, level: 0, name: WEAPON_MAP[weaponId].name };
  const rin = COMPANION_MAP['rin'];
  const vex = COMPANION_MAP['vex'];
  const rinW: ItemInstance = { uid: uid(rng), kind: 'weapon', defId: rin.weapon, rarity: 0, qty: 1, level: 0, name: WEAPON_MAP[rin.weapon].name };
  const vexW: ItemInstance = { uid: uid(rng), kind: 'weapon', defId: vex.weapon, rarity: 0, qty: 1, level: 0, name: WEAPON_MAP[vex.weapon].name };
  const vest: ItemInstance = { uid: uid(rng), kind: 'armor', defId: 'hunter_coat', rarity: 0, qty: 1, level: 0, name: 'Hunter Coat' };
  const hunters: HunterSave[] = [
    { id: 'main', name, isMain: true, look, level: 1, exp: 0, skillPoints: 1, tree: [], weaponUid: mainWeapon.uid, armorUid: vest.uid },
    { id: 'rin', name: 'Rin', isMain: false, look: rin.look, level: 1, exp: 0, skillPoints: 1, tree: [], weaponUid: rinW.uid },
    { id: 'vex', name: 'Vex', isMain: false, look: vex.look, level: 1, exp: 0, skillPoints: 1, tree: [], weaponUid: vexW.uid },
  ];
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    playTime: 0,
    name,
    credits: 500,
    reputation: 0,
    hunters,
    party: ['main', 'rin', 'vex'],
    inventory: [
      mainWeapon, rinW, vexW, vest,
      { uid: 'con_repair_kit', kind: 'consumable', defId: 'repair_kit', rarity: 0, qty: 4 },
      { uid: 'con_nano_revive', kind: 'consumable', defId: 'nano_revive', rarity: 0, qty: 1 },
      { uid: 'con_energy_cell', kind: 'consumable', defId: 'energy_cell', rarity: 0, qty: 2 },
      { uid: 'mat_scrap_metal', kind: 'material', defId: 'scrap_metal', rarity: 0, qty: 10 },
      { uid: 'mat_copper_wire', kind: 'material', defId: 'copper_wire', rarity: 0, qty: 6 },
    ],
    storage: [],
    cleared: {},
    orders: [],
    completedOrders: [],
    quests: [],
    questDay: -1,
    day: 1,
    dayStartedAt: now,
    stats: { kills: 0, battles: 0, wins: 0, bossKills: 0, pcsBuilt: 0, pcsSold: 0, reactions: 0, breaks: 0, maxChain: 0, chestsOpened: 0 },
    settings: defaultSettings(),
    tutorial: {},
    grantsClaimed: [],
  };
}

// ---------------------------------------------------------------------------
// inventory helpers
// ---------------------------------------------------------------------------

export function countItem(save: SaveData, defId: string): number {
  return save.inventory.filter((i) => i.defId === defId && STACKABLE.includes(i.kind)).reduce((s, i) => s + i.qty, 0);
}

export function addItem(save: SaveData, item: ItemInstance): boolean {
  if (STACKABLE.includes(item.kind)) {
    const ex = save.inventory.find((i) => i.kind === item.kind && i.defId === item.defId);
    if (ex) {
      ex.qty = Math.min(9999, ex.qty + item.qty);
      ex.isNew = true;
      return true;
    }
    if (save.inventory.length >= INVENTORY_CAP) return false;
    save.inventory.push({ ...item, uid: `${item.kind === 'material' ? 'mat' : 'con'}_${item.defId}` });
    return true;
  }
  if (save.inventory.length >= INVENTORY_CAP) {
    if (save.storage.length < STORAGE_CAP) {
      save.storage.push(item);
      return true;
    }
    return false;
  }
  if (save.inventory.some((i) => i.uid === item.uid)) item = { ...item, uid: item.uid + 'x' + save.inventory.length };
  save.inventory.push(item);
  return true;
}

export function removeQty(save: SaveData, defId: string, qty: number): boolean {
  const ex = save.inventory.find((i) => i.defId === defId && STACKABLE.includes(i.kind));
  if (!ex || ex.qty < qty) return false;
  ex.qty -= qty;
  if (ex.qty <= 0) save.inventory = save.inventory.filter((i) => i !== ex);
  return true;
}

export function isEquipped(save: SaveData, itemUid: string): boolean {
  return save.hunters.some((h) => h.weaponUid === itemUid || h.armorUid === itemUid || h.accessoryUid === itemUid);
}

export function consumableBag(save: SaveData): Record<string, number> {
  const bag: Record<string, number> = {};
  for (const i of save.inventory) if (i.kind === 'consumable') bag[i.defId] = i.qty;
  return bag;
}

// ---------------------------------------------------------------------------
// daily quests
// ---------------------------------------------------------------------------

export function refreshQuests(save: SaveData) {
  if (save.questDay === save.day && save.quests.length) return;
  const rng = new Rng(hashString(`quests:${save.day}:${save.createdAt}`));
  const unlocked = Object.keys(DUNGEON_MAP).filter((d) => !DUNGEON_MAP[d].unlock || (save.cleared[DUNGEON_MAP[d].unlock!] ?? -1) >= 0);
  const pool = [...new Set(unlocked.flatMap((d) => DUNGEON_MAP[d].pool))];
  const lvl = save.hunters.find((h) => h.isMain)?.level ?? 1;
  const q: QuestState[] = [];
  const kt = rng.pick(pool);
  const kc = rng.int(4, 8);
  q.push({ id: `q${save.day}a`, kind: 'kill', target: kt, count: kc, progress: 0, reward: 60 * kc + lvl * 20, exp: 30 * kc, title: `Bounty: destroy ${kc} ${ENEMY_MAP[kt].name}s`, done: false, claimed: false });
  const dd = rng.pick(unlocked);
  q.push({ id: `q${save.day}b`, kind: 'clear', target: dd, count: 1, progress: 0, reward: 400 + DUNGEON_MAP[dd].tier * 400, exp: 200 + DUNGEON_MAP[dd].tier * 250, title: `Clear ${DUNGEON_MAP[dd].name}`, done: false, claimed: false });
  q.push({ id: `q${save.day}c`, kind: 'build', target: 'any', count: rng.int(1, 2), progress: 0, reward: 250, exp: 120, title: 'Assemble computers at the Workshop', done: false, claimed: false });
  q.push({ id: `q${save.day}d`, kind: 'sell', target: 'any', count: 1, progress: 0, reward: 200, exp: 100, title: 'Sell a PC or fulfil a customer order', done: false, claimed: false });
  save.quests = q;
  save.questDay = save.day;
}

export function questProgress(save: SaveData, kind: QuestState['kind'], target: string, amount = 1) {
  for (const q of save.quests) {
    if (q.done || q.kind !== kind) continue;
    if (q.target !== 'any' && q.target !== target) continue;
    q.progress = Math.min(q.count, q.progress + amount);
    if (q.progress >= q.count) q.done = true;
  }
}

// ---------------------------------------------------------------------------
// validation (server + client import)
// ---------------------------------------------------------------------------

const isNum = (v: unknown, min = -Infinity, max = Infinity) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isStr = (v: unknown, max = 64) => typeof v === 'string' && v.length <= max;
const HEX = /^#[0-9a-fA-F]{6}$/;
const KINDS: ItemKind[] = ['weapon', 'armor', 'accessory', 'component', 'material', 'consumable', 'pc'];

function validLook(l: unknown): boolean {
  const a = l as Appearance;
  return !!a && isNum(a.hair, 0, 9) && isNum(a.outfit, 0, 9) && isNum(a.accessory, 0, 9) && (a.body === 0 || a.body === 1) &&
    [a.hairColor, a.eyeColor, a.skin, a.outfitColor, a.accentColor].every((c) => typeof c === 'string' && HEX.test(c));
}

function validItem(i: ItemInstance): string | null {
  if (!i || !isStr(i.uid, 40) || !KINDS.includes(i.kind) || !isNum(i.rarity, 0, 5) || !isNum(i.qty, 1, 9999)) return 'bad item fields';
  if (!Number.isInteger(i.rarity)) return 'bad rarity';
  switch (i.kind) {
    case 'weapon':
      if (!WEAPON_MAP[i.defId] || !isNum(i.level ?? 0, 0, 10)) return `bad weapon ${i.defId}`;
      break;
    case 'armor':
    case 'accessory':
      if (!ARMOR_MAP[i.defId] || !isNum(i.level ?? 0, 0, 10)) return `bad gear ${i.defId}`;
      break;
    case 'material':
      if (MATERIAL_MAP[i.defId]?.kind !== 'material') return `bad material ${i.defId}`;
      break;
    case 'consumable':
      if (!CONSUMABLE_MAP[i.defId]) return `bad consumable ${i.defId}`;
      break;
    case 'component': {
      if (MATERIAL_MAP[i.defId]?.kind !== 'component' || !isNum(i.quality ?? 0, 0, 100)) return `bad component ${i.defId}`;
      const s = i.specs ?? {};
      // spec ranges (anti item-forging): generous upper bounds of the generator
      if (!isNum(s.perf ?? 0, 0, 2000) || !isNum(s.capacity ?? 0, 0, 64000) || !isNum(s.supply ?? 0, 0, 2000) || !isNum(s.cooling ?? 0, 0, 500) || !isNum(s.cores ?? 0, 0, 32) || !isNum(s.watts ?? 0, 0, 600)) return 'component specs out of range';
      break;
    }
    case 'pc':
      if (!PRODUCT_MAP[i.defId] || !i.pc || !isNum(i.pc.value, 0, 60000) || !isNum(i.pc.perf, 0, 8000)) return `bad pc ${i.defId}`;
      break;
  }
  if (i.kind !== 'material' && i.kind !== 'consumable' && i.qty !== 1) return 'non-stackable qty';
  return null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateSave(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const s = raw as SaveData;
  if (!s || typeof s !== 'object') return { ok: false, errors: ['not an object'] };
  if (!isNum(s.version, 1, SAVE_VERSION)) errors.push('version');
  if (!isStr(s.name, 20) || s.name.trim().length < 1) errors.push('name');
  if (!isNum(s.credits, 0, MAX_CREDITS)) errors.push('credits');
  if (!Array.isArray(s.hunters) || s.hunters.length < 1 || s.hunters.length > 12) errors.push('hunters');
  if (!Array.isArray(s.inventory) || s.inventory.length > INVENTORY_CAP) errors.push('inventory size');
  if (!Array.isArray(s.storage) || s.storage.length > STORAGE_CAP) errors.push('storage size');
  if (!Array.isArray(s.party) || s.party.length < 1 || s.party.length > 4) errors.push('party');
  if (errors.length) return { ok: false, errors };

  const uids = new Set<string>();
  for (const i of [...s.inventory, ...s.storage]) {
    const e = validItem(i);
    if (e) errors.push(e);
    if (uids.has(i.uid)) errors.push(`duplicate uid ${i.uid}`);
    uids.add(i.uid);
  }
  const hunterIds = new Set<string>();
  for (const h of s.hunters) {
    if (!isStr(h.id, 24) || hunterIds.has(h.id)) errors.push('hunter id');
    hunterIds.add(h.id);
    if (!h.isMain && !COMPANION_MAP[h.id]) errors.push(`unknown companion ${h.id}`);
    if (!isNum(h.level, 1, MAX_LEVEL) || !Number.isInteger(h.level)) errors.push('hunter level');
    if (!isNum(h.exp, 0, expToNext(h.level) + 1)) errors.push('hunter exp');
    if (!validLook(h.look)) errors.push('hunter look');
    if (!Array.isArray(h.tree) || h.tree.some((n) => !TREE_MAP[n])) errors.push('skill tree');
    // skill point economy: points spent + unspent must equal level-based total (+ companion presets)
    const preset = h.isMain ? [] : COMPANION_MAP[h.id]?.tree ?? [];
    const spent = h.tree.filter((n) => !preset.includes(n)).reduce((sum, n) => sum + (TREE_MAP[n]?.cost ?? 0), 0);
    if (!isNum(h.skillPoints, 0, 99) || spent + h.skillPoints > h.level) errors.push('skill points exceed level');
    for (const n of h.tree) {
      const req = TREE_MAP[n]?.requires;
      if (req && !h.tree.includes(req)) errors.push('skill tree prerequisites');
    }
    for (const u of [h.weaponUid, h.armorUid, h.accessoryUid]) if (u && !s.inventory.some((i) => i.uid === u)) errors.push('equipped item missing');
  }
  if (!s.hunters.some((h) => h.isMain)) errors.push('main hunter');
  if (s.party.some((p) => !hunterIds.has(p)) || new Set(s.party).size !== s.party.length) errors.push('party members');
  for (const [d, v] of Object.entries(s.cleared ?? {})) if (!DUNGEON_MAP[d] || !isNum(v, -1, 3)) errors.push('cleared');
  return { ok: errors.length === 0, errors };
}

/**
 * Plausibility check between two saves (server-side anti-cheat for single-player progress).
 * Single player runs client-side, so we bound how fast wealth and levels can grow over real time.
 */
export function plausibleTransition(prev: SaveData, next: SaveData, elapsedMs: number): string[] {
  const issues: string[] = [];
  const minutes = Math.max(1, elapsedMs / 60000);
  const lvl = Math.max(...next.hunters.map((h) => h.level));
  const creditRate = 2500 + lvl * 400; // credits per real minute, generous
  const creditGain = next.credits - prev.credits;
  if (creditGain > creditRate * minutes + 20000) issues.push(`credit gain too fast (+${creditGain} in ${minutes.toFixed(1)}m)`);
  for (const h of next.hunters) {
    const p = prev.hunters.find((x) => x.id === h.id);
    if (p && h.level - p.level > 3 + minutes * 1.5) issues.push(`level gain too fast for ${h.id}`);
    if (p && h.level < p.level) issues.push(`level decreased for ${h.id}`);
  }
  if (next.createdAt !== prev.createdAt) issues.push('createdAt changed');
  const highR = (arr: ItemInstance[]) => arr.filter((i) => i.rarity >= 4).length;
  if (highR([...next.inventory, ...next.storage]) - highR([...prev.inventory, ...prev.storage]) > 4 + minutes) issues.push('too many legendary items gained');
  return issues;
}

/** forward-migrate older saves */
export function migrateSave(raw: SaveData): SaveData {
  const s = raw;
  if (!s.settings) s.settings = defaultSettings();
  if (!s.tutorial) s.tutorial = {};
  if (!s.grantsClaimed) s.grantsClaimed = [];
  if (!s.storage) s.storage = [];
  if (s.reputation === undefined) s.reputation = 0;
  if (!s.completedOrders) s.completedOrders = [];
  if (!s.stats) s.stats = newSave('x', COMPANION_MAP.rin.look, 'energy_katana').stats;
  for (const k of ['reactions', 'breaks', 'maxChain', 'chestsOpened'] as const) if (s.stats[k] === undefined) s.stats[k] = 0;
  s.version = SAVE_VERSION;
  return s;
}

export function rarityOf(n: number): Rarity {
  return Math.max(0, Math.min(5, Math.floor(n))) as Rarity;
}
