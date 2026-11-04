/**
 * Save management + all player-facing economy/progression mutations.
 * Local save is always written; when a server session exists the save is synced
 * (debounced) and validated server-side.
 */
import { Rng, randomSeed, uid } from '../../core/rng';
import type { Rarity } from '../../core/types';
import { SaveData, addItem, consumableBag, countItem, isEquipped, migrateSave, newSave, questProgress, refreshQuests, removeQty, validateSave } from '../../core/save';
import { COMPANION_MAP, canLearn, grantExp, TREE_MAP, type HunterSave } from '../../core/progression';
import { WEAPON_MAP, upgradeCost, MAX_WEAPON_LEVEL } from '../../core/data/weapons';
import { CONSUMABLE_MAP } from '../../core/data/items';
import { ARMOR_MAP, STACKABLE, type ItemInstance } from '../../core/economy/items';
import { assemblePc, checkBuild, generateOrders, marketStock, orderFulfils, sellPrice, PRODUCT_MAP, type BuildParts, type MarketListing } from '../../core/economy/crafting';
import type { DropResult } from '../../core/economy/loot';
import { api } from '../net/api';
import type { RunState } from '../world/dungeon';

const KEY = 'scrapbound.save.v2';
const RUN_KEY = 'scrapbound.run.v1';

export type Listener = () => void;

export class Store {
  save: SaveData | null = null;
  run: RunState | null = null;
  private listeners: Listener[] = [];
  private pushTimer: number | null = null;
  lastSync = 0;
  syncStatus: 'local' | 'synced' | 'pending' | 'error' = 'local';
  private sessionStart = Date.now();

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.save = migrateSave(JSON.parse(raw));
      const run = localStorage.getItem(RUN_KEY);
      if (run) this.run = JSON.parse(run);
    } catch (e) {
      console.warn('save load failed', e);
    }
    window.addEventListener('pagehide', () => this.persist(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist(true);
    });
    setInterval(() => this.persist(), 30000);
  }

  on(l: Listener) {
    this.listeners.push(l);
    return () => (this.listeners = this.listeners.filter((x) => x !== l));
  }
  emit() {
    for (const l of this.listeners) l();
  }

  get s(): SaveData {
    if (!this.save) throw new Error('No save');
    return this.save;
  }

  create(name: string, look: HunterSave['look'], weaponId: string) {
    this.save = newSave(name, look, weaponId);
    this.save.orders = generateOrders(this.save.day, 1);
    refreshQuests(this.save);
    this.persist(true);
  }

  persist(immediate = false) {
    if (!this.save) return;
    const now = Date.now();
    this.save.playTime += Math.round((now - this.sessionStart) / 1000);
    this.sessionStart = now;
    this.save.updatedAt = now;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.save));
      if (this.run) localStorage.setItem(RUN_KEY, JSON.stringify(this.run));
      else localStorage.removeItem(RUN_KEY);
    } catch (e) {
      console.warn('local save failed', e);
    }
    if (api.session && api.online) {
      this.syncStatus = 'pending';
      if (this.pushTimer) clearTimeout(this.pushTimer);
      const push = () => {
        if (!this.save) return;
        api.putSave(this.save).then((r) => {
          this.syncStatus = 'synced';
          this.lastSync = r.updatedAt;
        }).catch((e) => {
          console.warn('server save failed', e);
          this.syncStatus = 'error';
        });
      };
      if (immediate) push();
      else this.pushTimer = window.setTimeout(push, 2500);
    }
    this.emit();
  }

  /** adopt the server save if it is newer than the local one */
  async syncFromServer(): Promise<'server' | 'local' | 'none'> {
    if (!api.session || !api.online) return 'none';
    try {
      const r = await api.loadSave();
      if (r.save && validateSave(r.save).ok && (!this.save || r.save.updatedAt > this.save.updatedAt)) {
        this.save = migrateSave(r.save);
        localStorage.setItem(KEY, JSON.stringify(this.save));
        this.syncStatus = 'synced';
        this.emit();
        return 'server';
      }
      if (this.save) {
        await api.putSave(this.save);
        this.syncStatus = 'synced';
      }
      return 'local';
    } catch (e) {
      console.warn('sync failed', e);
      this.syncStatus = 'error';
      return 'none';
    }
  }

  async claimGrants(): Promise<string[]> {
    if (!api.session || !api.online || !this.save) return [];
    try {
      const r = await api.claimGrants();
      const msgs: string[] = [];
      for (const g of r.grants) {
        if (this.save.grantsClaimed.includes(g.id)) continue;
        this.save.grantsClaimed.push(g.id);
        this.save.grantsClaimed = this.save.grantsClaimed.slice(-200);
        this.applyRewards({ credits: g.credits, exp: g.exp, items: g.items as ItemInstance[] }, {});
        msgs.push(`${g.label}: +${g.credits} credits, +${g.exp} EXP, ${g.items.length} items`);
      }
      if (msgs.length) this.persist(true);
      return msgs;
    } catch {
      return [];
    }
  }

  reset() {
    this.save = null;
    this.run = null;
    localStorage.removeItem(KEY);
    localStorage.removeItem(RUN_KEY);
  }

  // ---------------------------------------------------------------------------
  // queries
  // ---------------------------------------------------------------------------

  hunter(id: string) {
    return this.s.hunters.find((h) => h.id === id)!;
  }
  main() {
    return this.s.hunters.find((h) => h.isMain)!;
  }
  item(uid?: string) {
    return uid ? this.s.inventory.find((i) => i.uid === uid) : undefined;
  }
  count(defId: string) {
    return countItem(this.s, defId);
  }
  bag() {
    return consumableBag(this.s);
  }
  partyLevel() {
    const p = this.s.party.slice(0, 3).map((id) => this.hunter(id)?.level ?? 1);
    return Math.round(p.reduce((a, b) => a + b, 0) / Math.max(1, p.length));
  }
  unlocked(dungeonId: string, unlock: string | null) {
    return !unlock || (this.s.cleared[unlock] ?? -1) >= 0 || dungeonId === 'data_center';
  }

  // ---------------------------------------------------------------------------
  // rewards
  // ---------------------------------------------------------------------------

  applyRewards(r: Pick<DropResult, 'credits' | 'exp' | 'items'>, kills: Record<string, number>, hunterIds?: string[]): { levels: { name: string; level: number }[]; lost: number } {
    const s = this.s;
    s.credits = Math.min(99_999_999, s.credits + Math.max(0, Math.round(r.credits)));
    const ids = hunterIds ?? s.party.slice(0, 4);
    const levels: { name: string; level: number }[] = [];
    for (const id of ids) {
      const h = this.hunter(id);
      if (!h) continue;
      // reserve gets 50% exp
      const share = s.party.indexOf(id) === 3 ? 0.5 : 1;
      const g = grantExp(h, r.exp * share);
      if (g > 0) levels.push({ name: h.name, level: h.level });
    }
    let lost = 0;
    for (const it of r.items) if (!addItem(s, { ...it })) lost++;
    for (const [t, n] of Object.entries(kills)) {
      s.stats.kills += n;
      questProgress(s, 'kill', t, n);
    }
    return { levels, lost };
  }

  consumeUsed(used: Record<string, number>) {
    for (const [id, n] of Object.entries(used)) removeQty(this.s, id, n);
  }

  // ---------------------------------------------------------------------------
  // shops
  // ---------------------------------------------------------------------------

  spend(n: number): boolean {
    if (this.s.credits < n) return false;
    this.s.credits -= n;
    return true;
  }

  buyConsumable(id: string, qty = 1): string | null {
    const d = CONSUMABLE_MAP[id];
    if (!d) return 'Unknown item';
    if (!this.spend(d.price * qty)) return 'Not enough credits';
    addItem(this.s, { uid: `con_${id}`, kind: 'consumable', defId: id, rarity: 0, qty });
    this.persist();
    return null;
  }

  shopWeapons(): { item: ItemInstance; price: number }[] {
    const rng = new Rng(this.s.day * 31 + 7);
    const lvl = this.partyLevel();
    const maxR = Math.min(3, Math.floor(lvl / 6) + 1);
    return Object.values(WEAPON_MAP).map((w) => {
      const rarity = Math.min(maxR, rng.int(0, maxR)) as Rarity;
      return { item: { uid: `shop_${w.id}_${this.s.day}`, kind: 'weapon' as const, defId: w.id, rarity, qty: 1, level: 0, name: w.name }, price: Math.round(400 * Math.pow(2.1, rarity)) };
    });
  }

  shopArmor(): { item: ItemInstance; price: number }[] {
    const rng = new Rng(this.s.day * 17 + 3);
    const lvl = this.partyLevel();
    const maxR = Math.min(3, Math.floor(lvl / 6) + 1);
    return Object.values(ARMOR_MAP).map((a) => {
      const rarity = Math.min(maxR, rng.int(0, maxR)) as Rarity;
      return { item: { uid: `shop_${a.id}_${this.s.day}`, kind: a.slot === 'armor' ? 'armor' as const : 'accessory' as const, defId: a.id, rarity, qty: 1, level: 0, name: a.name }, price: Math.round(300 * Math.pow(2, rarity)) };
    });
  }

  buyGear(item: ItemInstance, price: number): string | null {
    if (this.s.inventory.length >= 150) return 'Inventory full';
    if (!this.spend(price)) return 'Not enough credits';
    addItem(this.s, { ...item, uid: uid(), isNew: true });
    this.persist();
    return null;
  }

  upgrade(itemUid: string): string | null {
    const it = this.item(itemUid);
    if (!it || !['weapon', 'armor', 'accessory'].includes(it.kind)) return 'Cannot upgrade';
    const lvl = it.level ?? 0;
    if (lvl >= MAX_WEAPON_LEVEL) return 'Already max level';
    const c = upgradeCost(it.rarity, lvl);
    if (this.count('scrap_metal') < c.scrap) return `Needs ${c.scrap} Scrap Metal`;
    if (this.count('copper_wire') < c.copper) return `Needs ${c.copper} Copper Wire`;
    if (!this.spend(c.credits)) return 'Not enough credits';
    removeQty(this.s, 'scrap_metal', c.scrap);
    if (c.copper) removeQty(this.s, 'copper_wire', c.copper);
    it.level = lvl + 1;
    this.persist();
    return null;
  }

  sell(itemUid: string, qty = 1): string | null {
    const s = this.s;
    const it = this.item(itemUid);
    if (!it) return 'Missing item';
    if (it.locked) return 'Item is locked';
    if (isEquipped(s, it.uid)) return 'Unequip it first';
    const n = STACKABLE.includes(it.kind) ? Math.min(qty, it.qty) : 1;
    const price = sellPrice(it, s.day) * n;
    if (STACKABLE.includes(it.kind)) removeQty(s, it.defId, n);
    else s.inventory = s.inventory.filter((x) => x !== it);
    s.credits += price;
    if (it.kind === 'pc') {
      s.stats.pcsSold++;
      questProgress(s, 'sell', 'any');
    }
    this.persist();
    return null;
  }

  toggleLock(itemUid: string) {
    const it = this.item(itemUid) ?? this.s.storage.find((i) => i.uid === itemUid);
    if (it) it.locked = !it.locked;
    this.persist();
  }

  equip(hunterId: string, itemUid: string): string | null {
    const h = this.hunter(hunterId);
    const it = this.item(itemUid);
    if (!h || !it) return 'Missing';
    // unequip from any other hunter
    for (const o of this.s.hunters) {
      if (o.weaponUid === itemUid) o.weaponUid = undefined;
      if (o.armorUid === itemUid) o.armorUid = undefined;
      if (o.accessoryUid === itemUid) o.accessoryUid = undefined;
    }
    if (it.kind === 'weapon') h.weaponUid = it.uid;
    else if (it.kind === 'armor') h.armorUid = it.uid;
    else if (it.kind === 'accessory') h.accessoryUid = it.uid;
    else return 'Not equippable';
    // hunters without weapons get re-armed with any free weapon
    for (const o of this.s.hunters) {
      if (!o.weaponUid) {
        const free = this.s.inventory.find((i) => i.kind === 'weapon' && !isEquipped(this.s, i.uid));
        if (free) o.weaponUid = free.uid;
      }
    }
    it.isNew = false;
    this.persist();
    return null;
  }

  unequip(hunterId: string, slot: 'armor' | 'accessory') {
    const h = this.hunter(hunterId);
    if (slot === 'armor') h.armorUid = undefined;
    else h.accessoryUid = undefined;
    this.persist();
  }

  learn(hunterId: string, nodeId: string): string | null {
    const h = this.hunter(hunterId);
    const err = canLearn(h, nodeId);
    if (err) return err;
    h.skillPoints -= TREE_MAP[nodeId].cost;
    h.tree.push(nodeId);
    this.persist();
    return null;
  }

  respec(hunterId: string): string | null {
    const h = this.hunter(hunterId);
    const cost = 200 * h.level;
    const preset = h.isMain ? [] : COMPANION_MAP[h.id]?.tree ?? [];
    const refund = h.tree.filter((n) => !preset.includes(n)).reduce((s, n) => s + TREE_MAP[n].cost, 0);
    if (refund === 0) return 'Nothing to reset';
    if (!this.spend(cost)) return `Needs ${cost} credits`;
    h.tree = [...preset];
    h.skillPoints += refund;
    this.persist();
    return null;
  }

  recruit(id: string): string | null {
    const c = COMPANION_MAP[id];
    const s = this.s;
    if (!c) return 'Unknown';
    if (s.hunters.some((h) => h.id === id)) return 'Already recruited';
    if (!this.spend(c.cost)) return 'Not enough credits';
    const w: ItemInstance = { uid: uid(), kind: 'weapon', defId: c.weapon, rarity: 0, qty: 1, level: 0, name: WEAPON_MAP[c.weapon].name };
    addItem(s, w);
    const lvl = Math.max(1, this.partyLevel() - 1);
    s.hunters.push({ id, name: c.name, isMain: false, look: c.look, level: lvl, exp: 0, skillPoints: lvl, tree: [...c.tree], weaponUid: w.uid });
    if (s.party.length < 4) s.party.push(id);
    this.persist();
    return null;
  }

  setParty(ids: string[]): string | null {
    if (ids.length < 1 || ids.length > 4) return 'Party must have 1–4 hunters';
    if (!ids.includes('main')) return 'Your hunter must be in the party';
    this.s.party = ids;
    this.persist();
    return null;
  }

  // ---------------------------------------------------------------------------
  // storage
  // ---------------------------------------------------------------------------

  toStorage(itemUid: string): string | null {
    const s = this.s;
    const it = this.item(itemUid);
    if (!it) return 'Missing';
    if (isEquipped(s, it.uid)) return 'Unequip it first';
    if (s.storage.length >= 400) return 'Storage full';
    s.inventory = s.inventory.filter((x) => x !== it);
    const ex = STACKABLE.includes(it.kind) ? s.storage.find((x) => x.kind === it.kind && x.defId === it.defId) : undefined;
    if (ex) ex.qty += it.qty;
    else s.storage.push(it);
    this.persist();
    return null;
  }

  fromStorage(itemUid: string): string | null {
    const s = this.s;
    const it = s.storage.find((i) => i.uid === itemUid);
    if (!it) return 'Missing';
    if (s.inventory.length >= 150 && !STACKABLE.includes(it.kind)) return 'Inventory full';
    s.storage = s.storage.filter((x) => x !== it);
    addItem(s, it);
    this.persist();
    return null;
  }

  // ---------------------------------------------------------------------------
  // workshop & market
  // ---------------------------------------------------------------------------

  checkBuild(productId: string, parts: BuildParts) {
    return checkBuild(productId, parts, { scrap: this.count('scrap_metal'), copper: this.count('copper_wire') });
  }

  build(productId: string, parts: BuildParts): { err: string | null; pc?: ItemInstance } {
    const s = this.s;
    const chk = this.checkBuild(productId, parts);
    if (!chk.ok) return { err: chk.issues[0] };
    const used = [parts.cpu, parts.motherboard, ...parts.ram, parts.gpu, ...parts.storage, parts.cooling_fan, parts.power_supply, parts.quantum_chip].filter(Boolean) as ItemInstance[];
    for (const u of used) if (!s.inventory.includes(u) || u.locked) return { err: `${u.name} is not available (locked?)` };
    const prod = PRODUCT_MAP[productId];
    const pc = assemblePc(productId, parts, chk, new Rng(randomSeed()));
    s.inventory = s.inventory.filter((x) => !used.includes(x));
    removeQty(s, 'scrap_metal', prod.scrap);
    removeQty(s, 'copper_wire', prod.copper);
    addItem(s, pc);
    s.stats.pcsBuilt++;
    questProgress(s, 'build', 'any');
    this.persist();
    return { err: null, pc };
  }

  ensureDay() {
    const s = this.s;
    if (!s.orders.length || s.orders.every((o) => o.expiresDay < s.day)) s.orders = generateOrders(s.day, this.main().level);
    s.orders = s.orders.filter((o) => o.expiresDay >= s.day && !s.completedOrders.includes(o.id));
    refreshQuests(s);
  }

  advanceDay() {
    const s = this.s;
    s.day += 1;
    s.dayStartedAt = Date.now();
    const fresh = generateOrders(s.day, this.main().level).filter((o) => !s.orders.some((x) => x.id === o.id));
    s.orders = [...s.orders.filter((o) => o.expiresDay >= s.day), ...fresh].slice(-7);
    refreshQuests(s);
  }

  fulfil(orderId: string, pcUid: string): string | null {
    const s = this.s;
    const o = s.orders.find((x) => x.id === orderId);
    const pc = this.item(pcUid);
    if (!o || !pc) return 'Missing';
    if (!orderFulfils(o, pc)) return 'This PC does not meet the order requirements';
    s.inventory = s.inventory.filter((x) => x !== pc);
    s.credits += o.reward;
    s.reputation += o.rep;
    s.completedOrders.push(o.id);
    s.completedOrders = s.completedOrders.slice(-100);
    s.orders = s.orders.filter((x) => x !== o);
    s.stats.pcsSold++;
    questProgress(s, 'sell', 'any');
    this.persist();
    return null;
  }

  market(): MarketListing[] {
    const tier = Math.min(4, Math.floor(this.partyLevel() / 7));
    const bought = new Set((this.s as SaveData & { bought?: string[] }).bought ?? []);
    return marketStock(this.s.day, tier).filter((l) => !bought.has(l.id));
  }

  buyListing(l: MarketListing): string | null {
    const s = this.s as SaveData & { bought?: string[] };
    if (s.inventory.length >= 150) return 'Inventory full';
    if (!this.spend(l.price)) return 'Not enough credits';
    addItem(s, { ...l.item, uid: uid(), isNew: true });
    s.bought = [...(s.bought ?? []).filter((id) => id.startsWith(`m${s.day}_`)), l.id];
    this.persist();
    return null;
  }

  claimQuest(id: string): string | null {
    const q = this.s.quests.find((x) => x.id === id);
    if (!q || !q.done || q.claimed) return 'Not claimable';
    q.claimed = true;
    this.applyRewards({ credits: q.reward, exp: q.exp, items: [] }, {});
    this.persist();
    return null;
  }

  sortInventory(by: 'rarity' | 'type' | 'new') {
    const order = ['weapon', 'armor', 'accessory', 'pc', 'component', 'consumable', 'material'];
    this.s.inventory.sort((a, b) => {
      if (by === 'rarity') return b.rarity - a.rarity || order.indexOf(a.kind) - order.indexOf(b.kind);
      if (by === 'new') return Number(!!b.isNew) - Number(!!a.isNew);
      return order.indexOf(a.kind) - order.indexOf(b.kind) || a.defId.localeCompare(b.defId) || b.rarity - a.rarity;
    });
    this.persist();
  }
}

export const store = new Store();
