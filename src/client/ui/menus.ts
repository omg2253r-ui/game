/**
 * All non-battle panels: inventory & equipment, skill tree, shops, PC workshop,
 * market, guild, quests, storage, dungeon select, settings & account.
 */
import { h, clear, fmt, bar } from './dom';
import { itemRow, itemName, ELEM_ICON } from './items';
import type { Ui } from './ui';
import type { Store } from '../state/store';
import { RARITIES, DIFFICULTIES } from '../../core/types';
import { WEAPON_MAP, upgradeCost, MAX_WEAPON_LEVEL } from '../../core/data/weapons';
import { CONSUMABLES } from '../../core/data/items';
import { COMPANIONS, SKILL_TREE, TREE_MAP, canLearn, expToNext, hunterStats, powerRating, type HunterSave } from '../../core/progression';
import { STACKABLE, type ItemInstance } from '../../core/economy/items';
import { PRODUCTS, PRODUCT_MAP, sellPrice, marketMult, type BuildParts } from '../../core/economy/crafting';
import { DUNGEONS } from '../../core/data/regions';
import { ENEMY_MAP } from '../../core/data/enemies';
import { getSkill } from '../../core/data/skills';
import { isEquipped, validateSave, migrateSave } from '../../core/save';
import { api } from '../net/api';
import type { Quality } from '../render/renderer';
import { audio } from '../audio/audio';

export interface GameApi {
  ui: Ui;
  store: Store;
  startDungeon(id: string, difficulty: number): void;
  openLobby(): void;
  refreshHud(): void;
  setQuality(q: Quality): void;
  setFps(on: boolean): void;
}

const statRows = (s: Record<string, number>) => h('div', { class: 'stat-grid' },
  Object.entries({ HP: s.hp, ATK: s.atk, DEF: s.def, SPD: s.spd, 'Crit Rate': `${Math.round(s.critRate * 100)}%`, 'Crit DMG': `+${Math.round(s.critDmg * 100)}%`, Energy: s.energy, 'Elem DMG': `+${Math.round(s.elemBonus * 100)}%` }).map(([k, v]) => h('div', null, h('span', { class: 'mu' }, k), h('b', null, String(v)))));

function equippedBy(store: Store, uid: string): string | undefined {
  const hh = store.s.hunters.find((x) => x.weaponUid === uid || x.armorUid === uid || x.accessoryUid === uid);
  return hh?.name;
}

// ---------------------------------------------------------------------------
// Inventory / hunters / skills
// ---------------------------------------------------------------------------

export function openInventory(g: GameApi, tab = 'items', hunterId = 'main') {
  const { ui, store } = g;
  let filter = 'all';
  let selected: string | null = null;
  let hid = hunterId;
  const p = ui.panel('Hunter Terminal', {
    tabs: [{ id: 'items', label: '🎒 Inventory' }, { id: 'hunters', label: '🧑‍🚀 Hunters & Gear' }, { id: 'skills', label: '🌳 Skill Tree' }],
    tab, onTab: (t) => openInventory(g, t, hid), onClose: () => g.refreshHud(),
  });
  const render = () => {
    clear(p.body);
    if (tab === 'items') renderItems();
    else if (tab === 'hunters') renderHunters();
    else renderSkills();
  };
  const renderItems = () => {
    const s = store.s;
    const filters: [string, string][] = [['all', 'All'], ['gear', 'Gear'], ['component', 'Parts'], ['pc', 'PCs'], ['material', 'Materials'], ['consumable', 'Items']];
    const top = h('div', { class: 'row', style: 'margin-bottom:8px' },
      ...filters.map(([id, l]) => h('button', { class: `btn sm ${filter === id ? 'on' : ''}`, on: { click: () => { filter = id; render(); } } }, l)),
      h('span', { class: 'grow' }),
      h('span', { class: 'mu' }, `${s.inventory.length}/150`),
      h('button', { class: 'btn sm ghost', on: { click: () => { store.sortInventory('rarity'); render(); } } }, 'Sort ★'),
      h('button', { class: 'btn sm ghost', on: { click: () => { store.sortInventory('type'); render(); } } }, 'Sort type'));
    const list = h('div', { class: 'list' });
    const items = s.inventory.filter((i) => filter === 'all' || (filter === 'gear' ? ['weapon', 'armor', 'accessory'].includes(i.kind) : i.kind === filter));
    if (!items.length) list.append(h('p', { class: 'mu' }, 'Nothing here yet. Explore dungeons to find loot!'));
    for (const i of items) list.append(itemRow(i, { sel: selected === i.uid, equipped: equippedBy(store, i.uid), onClick: () => { selected = i.uid; i.isNew = false; render(); } }));
    const detail = h('div', { class: 'card' });
    const it = selected ? store.item(selected) : undefined;
    if (!it) detail.append(h('p', { class: 'mu' }, 'Select an item to see details, compare and act on it.'));
    else detail.append(itemDetail(g, it, render));
    p.body.append(top, h('div', { class: 'split' }, list, detail));
  };
  const renderHunters = () => {
    const s = store.s;
    const tabs = h('div', { class: 'row', style: 'margin-bottom:10px' }, ...s.hunters.map((x) => h('button', { class: `btn sm ${x.id === hid ? 'on' : ''}`, on: { click: () => { hid = x.id; render(); } } }, `${x.name} Lv${x.level}${s.party.includes(x.id) ? ' ★' : ''}`)));
    const hu = store.hunter(hid);
    const st = hunterStats(hu, s.inventory);
    const w = WEAPON_MAP[st.weaponId];
    const left = h('div', { class: 'card' },
      h('h3', null, `${hu.name} `, h('span', { class: 'mu' }, `Lv ${hu.level} · ${ELEM_ICON[w.element]} ${w.name} · Power ${powerRating(st.stats)}`)),
      h('div', { class: 'mu' }, `EXP ${hu.exp}/${expToNext(hu.level)}`), bar('en', hu.exp / expToNext(hu.level)),
      h('div', { style: 'height:8px' }), statRows(st.stats as unknown as Record<string, number>),
      h('p', { class: 'mu' }, `Skill: ${getSkill(w.skill).name} · Ultimate: ${getSkill(w.ultimate).name}`),
      h('p', { class: 'mu' }, `Passive — ${w.passiveName}: ${w.passiveDesc}`));
    const slots = h('div', { class: 'slots' });
    const slot = (label: string, uid: string | undefined, kind: 'weapon' | 'armor' | 'accessory') => {
      const it = store.item(uid);
      const el = h('div', { class: `slot ${it ? 'filled' : ''}` }, h('div', { class: 'lbl' }, label), it ? h('div', { class: `r${it.rarity}`, style: 'font-weight:700' }, itemName(it)) : h('div', { class: 'mu' }, 'Empty'));
      const pick = h('div', { class: 'list', style: 'margin-top:6px' });
      const options = s.inventory.filter((i) => i.kind === kind && i.uid !== uid);
      for (const o of options.slice(0, 12)) {
        const cur = it;
        const delta = compareLine(store, hu, o, cur);
        pick.append(itemRow(o, { sub: delta, equipped: equippedBy(store, o.uid), onClick: () => { const e = store.equip(hid, o.uid); if (e) ui.toast(e, 'bad'); else audio.sfx('confirm'); render(); } }));
      }
      if (!options.length) pick.append(h('div', { class: 'mu' }, 'No other items'));
      if (it && kind !== 'weapon') pick.append(h('button', { class: 'btn sm ghost', on: { click: () => { store.unequip(hid, kind); render(); } } }, 'Unequip'));
      return h('div', null, el, pick);
    };
    slots.append(slot('Weapon', hu.weaponUid, 'weapon'), slot('Armor', hu.armorUid, 'armor'), slot('Accessory', hu.accessoryUid, 'accessory'));
    p.body.append(tabs, h('div', { class: 'split' }, left, h('div', { class: 'card' }, h('h3', null, 'Equipment'), slots)));
  };
  const renderSkills = () => {
    const s = store.s;
    const tabs = h('div', { class: 'row', style: 'margin-bottom:10px' }, ...s.hunters.map((x) => h('button', { class: `btn sm ${x.id === hid ? 'on' : ''}`, on: { click: () => { hid = x.id; render(); } } }, `${x.name} (${x.skillPoints} SP)`)));
    const hu = store.hunter(hid);
    const tree = h('div', { class: 'tree' });
    for (const br of ['offense', 'defense', 'tech'] as const) {
      const col = h('div', { class: 'tree-branch' }, h('h4', null, br));
      for (const n of SKILL_TREE.filter((x) => x.branch === br)) {
        const have = hu.tree.includes(n.id);
        const err = canLearn(hu, n.id);
        const node = h('button', { class: `node ${have ? 'have' : !err ? 'can' : 'lock'}`, style: 'width:100%;text-align:left', 'data-node': n.id, on: { click: () => { if (have) return; const e = store.learn(hid, n.id); if (e) { ui.toast(e, 'bad'); audio.sfx('error'); } else { audio.sfx('levelup'); ui.toast(`Learned ${n.name}!`, 'good'); } render(); } } },
          h('b', null, `${have ? '✔ ' : ''}${n.name}`), `${n.desc} · ${n.cost} SP${n.requires ? ` · needs ${TREE_MAP[n.requires].name}` : ''}`);
        col.append(node);
      }
      tree.append(col);
    }
    p.body.append(tabs, h('div', { class: 'row', style: 'margin-bottom:8px' }, h('b', null, `${hu.name}: ${hu.skillPoints} skill points`), h('span', { class: 'mu' }, '(1 per level)'), h('span', { class: 'grow' }), h('button', { class: 'btn sm ghost', on: { click: () => { const e = store.respec(hid); ui.toast(e ?? 'Skill points refunded', e ? 'bad' : 'good'); render(); } } }, `Reset (${200 * hu.level} cr)`)), tree);
  };
  render();
}

function compareLine(store: Store, hu: HunterSave, cand: ItemInstance, cur?: ItemInstance): string {
  const clone: HunterSave = { ...hu };
  if (cand.kind === 'weapon') clone.weaponUid = cand.uid;
  if (cand.kind === 'armor') clone.armorUid = cand.uid;
  if (cand.kind === 'accessory') clone.accessoryUid = cand.uid;
  const a = hunterStats(hu, store.s.inventory).stats;
  const b = hunterStats(clone, store.s.inventory).stats;
  const parts: string[] = [];
  for (const k of ['atk', 'hp', 'def', 'spd'] as const) {
    const d = b[k] - a[k];
    if (d) parts.push(`${k.toUpperCase()} ${d > 0 ? '▲+' : '▼'}${d}`);
  }
  const cr = Math.round((b.critRate - a.critRate) * 100);
  if (cr) parts.push(`CR ${cr > 0 ? '▲+' : '▼'}${cr}%`);
  void cur;
  return parts.join(' · ') || 'No stat change';
}

function itemDetail(g: GameApi, it: ItemInstance, rerender: () => void): HTMLElement {
  const { store, ui } = g;
  const s = store.s;
  const wrap = h('div', { class: 'col' });
  wrap.append(itemRow(it, { equipped: equippedBy(store, it.uid) }));
  if (it.kind === 'weapon') {
    const w = WEAPON_MAP[it.defId];
    wrap.append(h('div', { class: 'mu' }, `${w.desc}`), h('div', { class: 'mu' }, `Skill: ${getSkill(w.skill).name} — ${getSkill(w.skill).desc}`), h('div', { class: 'mu' }, `Ultimate: ${getSkill(w.ultimate).name} — ${getSkill(w.ultimate).desc}`), h('div', { class: 'mu' }, `Passive: ${w.passiveName} — ${w.passiveDesc}`));
  }
  const actions = h('div', { class: 'row' });
  if (['weapon', 'armor', 'accessory'].includes(it.kind)) {
    for (const hu of s.hunters) {
      actions.append(h('button', { class: 'btn sm', on: { click: () => { const e = store.equip(hu.id, it.uid); ui.toast(e ?? `Equipped on ${hu.name}`, e ? 'bad' : 'good'); rerender(); } } }, `Equip: ${hu.name}`));
    }
    actions.append(h('div', { class: 'mu', style: 'width:100%' }, 'Compare vs current:'));
    for (const hu of s.hunters.filter((x) => s.party.includes(x.id))) actions.append(h('div', { class: 'mu', style: 'width:100%' }, `${hu.name}: ${compareLine(store, hu, it)}`));
    if ((it.level ?? 0) < MAX_WEAPON_LEVEL) {
      const c = upgradeCost(it.rarity, it.level ?? 0);
      actions.append(h('button', { class: 'btn sm gold', on: { click: () => { const e = store.upgrade(it.uid); ui.toast(e ?? `Upgraded to +${it.level}!`, e ? 'bad' : 'good'); if (!e) audio.sfx('levelup'); rerender(); } } }, `Upgrade +${(it.level ?? 0) + 1} (${c.credits}cr · ${c.scrap} scrap${c.copper ? ` · ${c.copper} copper` : ''})`));
    }
  }
  const price = sellPrice(it, s.day);
  if (!isEquipped(s, it.uid)) {
    actions.append(h('button', { class: 'btn sm danger', disabled: !!it.locked, on: { click: async () => {
      if (it.rarity >= 3 && !(await ui.confirm('Sell item?', `Sell ${itemName(it)} for ${price * (STACKABLE.includes(it.kind) ? it.qty : 1)} credits?`, 'Sell', true))) { openInventory(g, 'items'); return; }
      const e = store.sell(it.uid, it.qty);
      ui.toast(e ?? `Sold for ${price * (STACKABLE.includes(it.kind) ? it.qty : 1)} credits`, e ? 'bad' : 'gold');
      if (!e) audio.sfx('coin');
      if (it.rarity >= 3) openInventory(g, 'items'); else rerender();
    } } }, `Sell ${STACKABLE.includes(it.kind) ? 'all ' : ''}(${price * (STACKABLE.includes(it.kind) ? it.qty : 1)}cr)`));
  }
  actions.append(h('button', { class: 'btn sm ghost', on: { click: () => { store.toggleLock(it.uid); rerender(); } } }, it.locked ? '🔓 Unlock' : '🔒 Lock'));
  wrap.append(actions);
  return wrap;
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

export function openWeaponShop(g: GameApi, armor = false) {
  const { ui, store } = g;
  let tab = 'buy';
  const p = ui.panel(armor ? 'Armor Shop — Tailor Mei' : 'Weapon Shop — Smith Gorou', { tabs: [{ id: 'buy', label: 'Buy' }, { id: 'upgrade', label: 'Upgrade' }, { id: 'items', label: 'Consumables' }], tab, onTab: (t) => { tab = t; render(); }, onClose: () => g.refreshHud() });
  const render = () => {
    clear(p.body);
    p.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab));
    p.body.append(h('div', { class: 'row', style: 'margin-bottom:8px' }, h('b', { class: 'hud-money' }, `💰 ${fmt(store.s.credits)} credits`), h('span', { class: 'mu' }, `Stock refreshes daily (Day ${store.s.day})`)));
    if (tab === 'buy') {
      const list = h('div', { class: 'grid' });
      for (const { item, price } of armor ? store.shopArmor() : store.shopWeapons()) {
        const owned = store.s.inventory.some((i) => i.defId === item.defId && i.rarity >= item.rarity);
        list.append(h('div', { class: `card rb${item.rarity}` }, itemRow(item), item.kind === 'weapon' ? h('div', { class: 'mu', style: 'margin:6px 0' }, WEAPON_MAP[item.defId].desc) : null,
          h('button', { class: 'btn sm pri', style: 'width:100%;margin-top:6px', disabled: store.s.credits < price, on: { click: () => { const e = store.buyGear(item, price); ui.toast(e ?? `Bought ${itemName(item)}`, e ? 'bad' : 'good'); if (!e) audio.sfx('coin'); render(); } } }, `Buy ${fmt(price)}cr${owned ? ' (owned)' : ''}`)));
      }
      p.body.append(list);
    } else if (tab === 'upgrade') {
      const list = h('div', { class: 'list' });
      const kinds = armor ? ['armor', 'accessory'] : ['weapon'];
      for (const it of store.s.inventory.filter((i) => kinds.includes(i.kind))) {
        const lvl = it.level ?? 0;
        const c = upgradeCost(it.rarity, lvl);
        list.append(itemRow(it, { equipped: equippedBy(store, it.uid), right: lvl >= MAX_WEAPON_LEVEL ? h('span', { class: 'tag' }, 'MAX') : h('button', { class: 'btn sm gold', on: { click: (e: Event) => { e.stopPropagation(); const err = store.upgrade(it.uid); ui.toast(err ?? `${itemName(it)}!`, err ? 'bad' : 'good'); if (!err) audio.sfx('levelup'); render(); } } }, `+${lvl + 1}: ${fmt(c.credits)}cr · ${c.scrap}🔩${c.copper ? ` · ${c.copper}🧵` : ''}`) }));
      }
      p.body.append(h('p', { class: 'mu' }, `Materials: ${store.count('scrap_metal')} Scrap Metal · ${store.count('copper_wire')} Copper Wire. +5 and +10 unlock skill power bonuses.`), list);
    } else {
      const list = h('div', { class: 'grid' });
      for (const c of CONSUMABLES) {
        list.append(h('div', { class: 'card' }, h('h3', null, `${c.icon} ${c.name}`), h('div', { class: 'mu' }, c.desc), h('div', { class: 'mu' }, `Owned: ${store.count(c.id)}`),
          h('div', { class: 'row', style: 'margin-top:6px' },
            h('button', { class: 'btn sm pri grow', disabled: store.s.credits < c.price, on: { click: () => { const e = store.buyConsumable(c.id, 1); ui.toast(e ?? `Bought ${c.name}`, e ? 'bad' : 'good'); if (!e) audio.sfx('coin'); render(); } } }, `Buy ${c.price}cr`),
            h('button', { class: 'btn sm grow', disabled: store.s.credits < c.price * 5, on: { click: () => { const e = store.buyConsumable(c.id, 5); ui.toast(e ?? `Bought 5× ${c.name}`, e ? 'bad' : 'good'); render(); } } }, `×5 ${c.price * 5}cr`))));
      }
      p.body.append(list);
    }
  };
  render();
}

// ---------------------------------------------------------------------------
// PC Workshop
// ---------------------------------------------------------------------------

export function openWorkshop(g: GameApi) {
  const { ui, store } = g;
  store.ensureDay();
  let tab = 'build';
  let product = 'basic_pc';
  const parts: BuildParts = { ram: [], storage: [] };
  let picking: keyof BuildParts | null = null;
  const p = ui.panel('Computer Workshop — Engineer Ohm', { tabs: [{ id: 'build', label: '🛠 Assemble' }, { id: 'orders', label: '📦 Orders & Contracts' }, { id: 'sell', label: '💰 Sell PCs' }], tab, onTab: (t) => { tab = t; render(); }, onClose: () => g.refreshHud() });
  const slotDefs: [keyof BuildParts, string, string][] = [['cpu', 'CPU', 'cpu'], ['motherboard', 'Motherboard', 'motherboard'], ['ram', 'RAM (multi)', 'ram'], ['gpu', 'GPU', 'gpu'], ['storage', 'Storage SSD/HDD (multi)', 'ssd|hdd'], ['cooling_fan', 'Cooling', 'cooling_fan'], ['power_supply', 'Power Supply', 'power_supply'], ['quantum_chip', 'Quantum Chip', 'quantum_chip']];
  const used = () => new Set([parts.cpu, parts.motherboard, ...parts.ram, parts.gpu, ...parts.storage, parts.cooling_fan, parts.power_supply, parts.quantum_chip].filter(Boolean).map((x) => x!.uid));
  const render = () => {
    clear(p.body);
    p.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab));
    const s = store.s;
    p.body.append(h('div', { class: 'row', style: 'margin-bottom:8px' }, h('b', { class: 'hud-money' }, `💰 ${fmt(s.credits)}`), h('span', { class: 'mu' }, `🔩 ${store.count('scrap_metal')} · 🧵 ${store.count('copper_wire')} · Rep ${s.reputation} · Day ${s.day}`)));
    if (tab === 'build') {
      const prods = h('div', { class: 'row', style: 'margin-bottom:8px' });
      const lvl = store.main().level;
      for (const pr of PRODUCTS) prods.append(h('button', { class: `btn sm ${product === pr.id ? 'on' : ''}`, disabled: lvl < pr.unlockLevel, title: pr.desc, 'data-product': pr.id, on: { click: () => { product = pr.id; render(); } } }, `${pr.name}${lvl < pr.unlockLevel ? ` (Lv${pr.unlockLevel})` : ''}`));
      const prod = PRODUCT_MAP[product];
      const slots = h('div', { class: 'slots' });
      for (const [key, label] of slotDefs) {
        const val = parts[key];
        const arr = Array.isArray(val) ? val : val ? [val as ItemInstance] : [];
        const needed = prod.needs.includes(key as never) || (key === 'storage');
        slots.append(h('div', { class: `slot ${arr.length ? 'filled' : ''}`, 'data-slot': key, style: needed ? '' : 'opacity:.75', on: { click: () => { picking = key; render(); } } },
          h('div', { class: 'lbl' }, `${label}${needed ? ' *' : ''}`),
          ...(arr.length ? arr.map((x) => h('div', { class: `r${x.rarity}`, style: 'font-weight:600' }, itemName(x))) : [h('div', { class: 'mu' }, 'Tap to choose')])));
      }
      const chk = store.checkBuild(product, parts);
      const res = h('div', { class: 'card issues' }, h('h3', null, `${prod.name} — ${prod.desc}`),
        h('div', null, `Performance ${chk.perf} · Quality ${chk.quality} · Power ${chk.watts}W · Heat ${chk.heat} · RAM ${chk.ramTotal}GB`),
        h('div', { style: 'font-size:18px;margin:6px 0' }, 'Estimated value: ', h('b', { class: 'hud-money' }, `${fmt(chk.value)} cr`)),
        ...chk.issues.map((x) => h('div', { class: 'bad' }, '✖ ' + x)), ...chk.warnings.map((x) => h('div', { class: 'warn' }, '⚠ ' + x)), chk.ok ? h('div', { class: 'ok' }, '✔ All parts compatible') : null,
        h('div', { class: 'row', style: 'margin-top:8px' },
          h('button', { class: 'btn pri grow', disabled: !chk.ok, 'data-action': 'assemble', on: { click: () => { const r = store.build(product, parts); if (r.err) { ui.toast(r.err, 'bad'); audio.sfx('error'); } else { ui.toast(`Built ${r.pc!.name}! Value ${r.pc!.pc!.value}cr`, 'good'); audio.sfx('chest'); parts.cpu = parts.motherboard = parts.gpu = parts.cooling_fan = parts.power_supply = parts.quantum_chip = undefined; parts.ram = []; parts.storage = []; } render(); } } }, '🛠 Assemble'),
          h('button', { class: 'btn ghost', on: { click: () => { autoFill(store, product, parts); render(); } } }, '✨ Auto-pick best'),
          h('button', { class: 'btn ghost', on: { click: () => { parts.cpu = parts.motherboard = parts.gpu = parts.cooling_fan = parts.power_supply = parts.quantum_chip = undefined; parts.ram = []; parts.storage = []; render(); } } }, 'Clear')));
      const pickEl = h('div', { class: 'card' });
      if (picking) {
        const def = slotDefs.find((x) => x[0] === picking)!;
        const types = def[2].split('|');
        const u = used();
        const opts = s.inventory.filter((i) => i.kind === 'component' && types.includes(i.defId) && !i.locked);
        pickEl.append(h('h3', null, `Choose ${def[1]}`));
        const list = h('div', { class: 'list' });
        for (const o of opts) {
          const inUse = u.has(o.uid);
          list.append(itemRow(o, { sel: inUse, onClick: () => {
            const k = picking!;
            if (k === 'ram' || k === 'storage') {
              const arr = parts[k];
              const ix = arr.indexOf(o);
              if (ix >= 0) arr.splice(ix, 1);
              else arr.push(o);
            } else {
              (parts as unknown as Record<string, ItemInstance | undefined>)[k] = inUse ? undefined : o;
              picking = null;
            }
            audio.sfx('click');
            render();
          } }));
        }
        if (!opts.length) list.append(h('p', { class: 'mu' }, 'No parts of this type. Hunt machines or buy at the Market.'));
        pickEl.append(list, h('button', { class: 'btn sm ghost', style: 'margin-top:6px', on: { click: () => { picking = null; render(); } } }, 'Done'));
      } else pickEl.append(h('p', { class: 'mu' }, 'Pick a slot to see compatible parts. The checker validates socket, RAM type, PCIe/GPU size, PSU headroom (+10%) and cooling.'));
      p.body.append(prods, h('div', { class: 'split' }, h('div', { class: 'col' }, slots, res), pickEl));
    } else if (tab === 'orders') {
      const pcs = s.inventory.filter((i) => i.kind === 'pc');
      const list = h('div', { class: 'grid' });
      for (const o of s.orders) {
        const match = pcs.filter((pc) => pc.defId === o.product && (pc.pc?.perf ?? 0) >= o.minPerf && (pc.quality ?? 0) >= o.minQuality);
        list.append(h('div', { class: `card ${o.contract ? 'rb4' : ''}` }, h('h3', null, `${o.contract ? '📜 ' : '👤 '}${o.customer}`), h('div', { class: 'mu' }, `"${o.note}"`),
          h('div', null, `Wants: ${PRODUCT_MAP[o.product].name}`), h('div', { class: 'mu' }, `Perf ≥ ${o.minPerf} · Quality ≥ ${o.minQuality} · Expires day ${o.expiresDay}`),
          h('div', { style: 'margin:4px 0' }, 'Reward: ', h('b', { class: 'hud-money' }, `${fmt(o.reward)}cr`), ` · +${o.rep} rep`),
          match.length ? h('button', { class: 'btn sm gold', style: 'width:100%', on: { click: () => { const e = store.fulfil(o.id, match[0].uid); ui.toast(e ?? `Delivered! +${o.reward}cr`, e ? 'bad' : 'gold'); if (!e) audio.sfx('coin'); render(); } } }, `Deliver ${itemName(match[0])} (perf ${match[0].pc?.perf})`) : h('div', { class: 'mu' }, 'No matching PC in inventory')));
      }
      if (!s.orders.length) list.append(h('p', { class: 'mu' }, 'No orders today. New customers arrive each day (after returning from a dungeon).'));
      p.body.append(list);
    } else {
      const list = h('div', { class: 'list' });
      for (const pc of s.inventory.filter((i) => i.kind === 'pc')) {
        const price = sellPrice(pc, s.day);
        list.append(itemRow(pc, { right: h('button', { class: 'btn sm gold', disabled: !!pc.locked, on: { click: (e: Event) => { e.stopPropagation(); const err = store.sell(pc.uid); ui.toast(err ?? `Sold for ${price}cr`, err ? 'bad' : 'gold'); if (!err) audio.sfx('coin'); render(); } } }, `Sell ${fmt(price)}cr (${Math.round(marketMult(s.day, `pc:${pc.defId}`) * 100)}%)`) }));
      }
      if (!list.childElementCount) list.append(h('p', { class: 'mu' }, 'No PCs built yet.'));
      p.body.append(h('p', { class: 'mu' }, 'Market demand changes daily — orders usually pay 25-60% more than direct sale.'), list);
    }
  };
  render();
}

function autoFill(store: Store, product: string, parts: BuildParts) {
  const inv = store.s.inventory.filter((i) => i.kind === 'component' && !i.locked);
  const by = (t: string) => inv.filter((i) => i.defId === t).sort((a, b) => (b.specs?.perf ?? b.specs?.supply ?? b.specs?.cooling ?? 0) - (a.specs?.perf ?? a.specs?.supply ?? a.specs?.cooling ?? 0) || b.quality! - a.quality!);
  const prod = PRODUCT_MAP[product];
  // choose a motherboard first, then compatible parts
  const boards = by('motherboard').filter((m) => !prod.ramTypes || prod.ramTypes.includes(m.specs?.ramType ?? ''));
  let best: BuildParts | null = null;
  let bestVal = -1;
  for (const mb of boards.slice(0, 6)) {
    const cand: BuildParts = { motherboard: mb, ram: [], storage: [] };
    cand.cpu = by('cpu').find((c) => c.specs?.socket === mb.specs?.socket && (!prod.minCores || (c.specs?.cores ?? 0) >= prod.minCores));
    const rams = by('ram').filter((r) => r.specs?.ramType === mb.specs?.ramType);
    let total = 0;
    for (const r of rams) {
      if (cand.ram.length >= (mb.specs?.ramSlots ?? 2)) break;
      cand.ram.push(r);
      total += r.specs?.capacity ?? 0;
      if (total >= prod.minRam * 2) break;
    }
    if (prod.needs.includes('gpu')) cand.gpu = by('gpu').find((x) => (x.specs?.pcie ?? 3) <= (mb.specs?.pcie ?? 3) && (x.specs?.gpuLength ?? 0) <= (mb.specs?.gpuLength ?? 999));
    const ssd = by('ssd')[0];
    const hdd = by('hdd')[0];
    if (ssd) cand.storage.push(ssd);
    else if (hdd) cand.storage.push(hdd);
    cand.cooling_fan = by('cooling_fan')[0];
    if (prod.needQuantum) cand.quantum_chip = by('quantum_chip')[0];
    const watts = [cand.cpu, cand.motherboard, ...cand.ram, cand.gpu, ...cand.storage, cand.cooling_fan, cand.quantum_chip].reduce((s, x) => s + (x?.specs?.watts ?? 0), 0);
    cand.power_supply = by('power_supply').filter((x) => (x.specs?.supply ?? 0) >= watts * 1.1).sort((a, b) => (a.specs?.supply ?? 0) - (b.specs?.supply ?? 0))[0] ?? by('power_supply')[0];
    const chk = store.checkBuild(product, cand);
    const v = chk.value + (chk.ok ? 100000 : 0) - chk.issues.length * 1000;
    if (v > bestVal) {
      bestVal = v;
      best = cand;
    }
  }
  if (best) Object.assign(parts, best);
}

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

export function openMarket(g: GameApi) {
  const { ui, store } = g;
  let tab = 'buy';
  const p = ui.panel('Market — Trader Lulu', { tabs: [{ id: 'buy', label: 'Buy parts' }, { id: 'sell', label: 'Sell parts & loot' }], tab, onTab: (t) => { tab = t; render(); }, onClose: () => g.refreshHud() });
  const render = () => {
    clear(p.body);
    p.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab));
    const s = store.s;
    p.body.append(h('div', { class: 'row', style: 'margin-bottom:8px' }, h('b', { class: 'hud-money' }, `💰 ${fmt(s.credits)}`), h('span', { class: 'mu' }, `Day ${s.day} prices`)));
    if (tab === 'buy') {
      const list = h('div', { class: 'list' });
      for (const l of store.market()) {
        list.append(itemRow(l.item, { right: h('button', { class: 'btn sm pri', disabled: s.credits < l.price, on: { click: (e: Event) => { e.stopPropagation(); const err = store.buyListing(l); ui.toast(err ?? `Bought ${itemName(l.item)}`, err ? 'bad' : 'good'); if (!err) audio.sfx('coin'); render(); } } }, `${fmt(l.price)}cr`) }));
      }
      p.body.append(list);
    } else {
      const list = h('div', { class: 'list' });
      const sellable = s.inventory.filter((i) => ['component', 'material', 'weapon', 'armor', 'accessory'].includes(i.kind) && !isEquipped(s, i.uid));
      for (const it of sellable) {
        const price = sellPrice(it, s.day) * (STACKABLE.includes(it.kind) ? it.qty : 1);
        list.append(itemRow(it, { right: h('button', { class: 'btn sm gold', disabled: !!it.locked, on: { click: (e: Event) => { e.stopPropagation(); const err = store.sell(it.uid, it.qty); ui.toast(err ?? `+${price}cr`, err ? 'bad' : 'gold'); if (!err) audio.sfx('coin'); render(); } } }, `Sell ${fmt(price)}cr`) }));
      }
      const junk = sellable.filter((i) => i.kind === 'component' && i.rarity === 0 && !i.locked);
      p.body.append(h('div', { class: 'row', style: 'margin-bottom:8px' }, h('button', { class: 'btn sm', disabled: !junk.length, on: { click: () => { let t = 0; for (const j of junk) { t += sellPrice(j, s.day); store.sell(j.uid); } ui.toast(`Sold ${junk.length} common parts for ${t}cr`, 'gold'); render(); } } }, `Quick-sell all Common parts (${junk.length})`), h('span', { class: 'mu' }, 'Locked items are never sold.')), list);
    }
  };
  render();
}

// ---------------------------------------------------------------------------
// Guild
// ---------------------------------------------------------------------------

export function openGuild(g: GameApi) {
  const { ui, store } = g;
  let tab = 'party';
  const p = ui.panel('Hunter Guild — Guildmaster Ren', { tabs: [{ id: 'party', label: '👥 Party' }, { id: 'recruit', label: '🤝 Recruit' }, { id: 'rank', label: '🏅 Records' }], tab, onTab: (t) => { tab = t; render(); }, onClose: () => g.refreshHud() });
  const render = () => {
    clear(p.body);
    p.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === tab));
    const s = store.s;
    if (tab === 'party') {
      p.body.append(h('p', { class: 'mu' }, 'Up to 4 hunters: the first 3 fight, the 4th waits in reserve (use Switch in battle; reserve earns 50% EXP). Tap to add/remove, arrows to reorder.'));
      const list = h('div', { class: 'list' });
      const party = [...s.party];
      party.forEach((id, i) => {
        const hu = store.hunter(id);
        const st = hunterStats(hu, s.inventory);
        list.append(h('div', { class: 'item sel' }, h('span', { class: 'ic' }, i < 3 ? '⚔' : '⇄'), h('div', { style: 'flex:1' }, h('div', { class: 'nm' }, `${hu.name} · Lv${hu.level}`), h('div', { class: 'sub' }, `${WEAPON_MAP[st.weaponId].name} · ${i < 3 ? 'Active' : 'Reserve'} · Power ${powerRating(st.stats)}`)),
          h('button', { class: 'btn sm ghost', disabled: i === 0, on: { click: () => { [party[i - 1], party[i]] = [party[i], party[i - 1]]; store.setParty(party); render(); } } }, '↑'),
          h('button', { class: 'btn sm ghost', disabled: id === 'main', on: { click: () => { const e = store.setParty(party.filter((x) => x !== id)); if (e) ui.toast(e, 'bad'); render(); } } }, 'Remove')));
      });
      const bench = s.hunters.filter((x) => !party.includes(x.id));
      if (bench.length) list.append(h('h3', null, 'Bench'));
      for (const hu of bench) {
        list.append(h('div', { class: 'item' }, h('span', { class: 'ic' }, '💤'), h('div', { style: 'flex:1' }, h('div', { class: 'nm' }, `${hu.name} · Lv${hu.level}`)), h('button', { class: 'btn sm', disabled: party.length >= 4, on: { click: () => { store.setParty([...party, hu.id]); render(); } } }, 'Add')));
      }
      p.body.append(list);
    } else if (tab === 'recruit') {
      const grid = h('div', { class: 'grid' });
      for (const c of COMPANIONS) {
        const have = s.hunters.some((x) => x.id === c.id);
        const w = WEAPON_MAP[c.weapon];
        grid.append(h('div', { class: 'card' }, h('h3', null, `${c.name} `, h('span', { class: 'mu' }, `${ELEM_ICON[w.element]} ${w.name}`)), h('div', { class: 'mu' }, c.bio), h('div', { class: 'mu', style: 'margin:4px 0' }, `Passive: ${w.passiveName}`),
          have ? h('span', { class: 'tag' }, 'In your roster') : h('button', { class: 'btn sm pri', style: 'width:100%', disabled: s.credits < c.cost, on: { click: () => { const e = store.recruit(c.id); ui.toast(e ?? `${c.name} joined the roster!`, e ? 'bad' : 'good'); if (!e) audio.sfx('levelup'); render(); } } }, `Recruit ${fmt(c.cost)}cr`)));
      }
      p.body.append(h('div', { class: 'row', style: 'margin-bottom:8px' }, h('b', { class: 'hud-money' }, `💰 ${fmt(s.credits)}`)), grid);
    } else {
      const st = s.stats;
      const rows = { 'Machines destroyed': st.kills, 'Battles won': `${st.wins}/${st.battles}`, 'Bosses defeated': st.bossKills, 'PCs built': st.pcsBuilt, 'PCs sold': st.pcsSold, 'Elemental reactions': st.reactions, 'Armor breaks': st.breaks, 'Best chain': st.maxChain, 'Chests opened': st.chestsOpened, Reputation: s.reputation, 'Play time': `${Math.round(s.playTime / 60)} min` };
      p.body.append(h('div', { class: 'card' }, h('div', { class: 'stat-grid' }, ...Object.entries(rows).map(([k, v]) => h('div', null, h('span', { class: 'mu' }, k), h('b', null, String(v)))))),
        h('h3', null, 'Dungeons cleared'), h('div', { class: 'list' }, ...DUNGEONS.map((d) => h('div', { class: 'item' }, h('span', { class: 'ic' }, (s.cleared[d.id] ?? -1) >= 0 ? '✔' : '·'), h('div', null, h('div', { class: 'nm' }, d.name), h('div', { class: 'sub' }, (s.cleared[d.id] ?? -1) >= 0 ? `Best: ${DIFFICULTIES[s.cleared[d.id]]}` : 'Not cleared'))))));
    }
  };
  render();
}

// ---------------------------------------------------------------------------
// Quest board, storage
// ---------------------------------------------------------------------------

export function openQuests(g: GameApi) {
  const { ui, store } = g;
  store.ensureDay();
  const p = ui.panel('Quest Board', { narrow: false, onClose: () => g.refreshHud() });
  const render = () => {
    clear(p.body);
    const list = h('div', { class: 'grid' });
    for (const q of store.s.quests) {
      list.append(h('div', { class: `card ${q.done && !q.claimed ? 'sel' : ''}` }, h('h3', null, q.title), bar('en', q.progress / q.count), h('div', { class: 'mu', style: 'margin:4px 0' }, `${q.progress}/${q.count} · Reward ${q.reward}cr + ${q.exp} EXP`),
        q.claimed ? h('span', { class: 'tag' }, '✔ Claimed') : h('button', { class: 'btn sm gold', disabled: !q.done, on: { click: () => { const e = store.claimQuest(q.id); ui.toast(e ?? `Quest complete! +${q.reward}cr`, e ? 'bad' : 'gold'); if (!e) audio.sfx('levelup'); render(); } } }, q.done ? 'Claim reward' : 'In progress')));
    }
    p.body.append(h('p', { class: 'mu' }, `Day ${store.s.day} bounties. New quests arrive every day.`), list);
  };
  render();
}

export function openStorage(g: GameApi) {
  const { ui, store } = g;
  const p = ui.panel('Storage Vault — Keeper Bo', { onClose: () => g.refreshHud() });
  const render = () => {
    clear(p.body);
    const s = store.s;
    const inv = h('div', { class: 'list' }, h('h3', null, `Inventory ${s.inventory.length}/150`));
    for (const i of s.inventory.filter((x) => !isEquipped(s, x.uid))) inv.append(itemRow(i, { right: h('button', { class: 'btn sm', on: { click: (e: Event) => { e.stopPropagation(); const err = store.toStorage(i.uid); if (err) ui.toast(err, 'bad'); render(); } } }, '→ Vault') }));
    const vault = h('div', { class: 'list' }, h('h3', null, `Vault ${s.storage.length}/400`));
    for (const i of s.storage) vault.append(itemRow(i, { right: h('button', { class: 'btn sm', on: { click: (e: Event) => { e.stopPropagation(); const err = store.fromStorage(i.uid); if (err) ui.toast(err, 'bad'); render(); } } }, '← Take') }));
    if (!s.storage.length) vault.append(h('p', { class: 'mu' }, 'Empty. Overflow loot lands here automatically.'));
    p.body.append(h('div', { class: 'split' }, inv, vault));
  };
  render();
}

// ---------------------------------------------------------------------------
// Dungeon select
// ---------------------------------------------------------------------------

export function openDungeonSelect(g: GameApi) {
  const { ui, store } = g;
  const p = ui.panel('Dungeon Gate', { onClose: () => g.refreshHud() });
  const s = store.s;
  const lvl = store.partyLevel();
  p.body.append(h('p', { class: 'mu' }, `Party level ${lvl}. Clear a dungeon on Normal to unlock the next region; clear a difficulty to unlock the next one. Your party's HP carries between fights inside a dungeon.`));
  const list = h('div', { class: 'grid' });
  for (const d of DUNGEONS) {
    const open = store.unlocked(d.id, d.unlock);
    const best = s.cleared[d.id] ?? -1;
    const boss = ENEMY_MAP[d.boss];
    const card = h('div', { class: `card ${open ? '' : 'lock'}`, style: `border-color:${d.theme.accent}66` }, h('h3', { style: `color:${d.theme.accent}` }, d.name), h('div', { class: 'mu' }, `${d.region} · Lv ${d.levels[0]}–${d.levels[1]}`), h('div', { class: 'mu', style: 'margin:4px 0' }, d.desc), h('div', { class: 'mu' }, `Boss: ${boss.name} — ${boss.desc}`));
    if (!open) card.append(h('div', { class: 'tag', style: 'margin-top:6px' }, `🔒 Clear ${DUNGEONS.find((x) => x.id === d.unlock)?.name} first`));
    else {
      const row = h('div', { class: 'row', style: 'margin-top:8px' });
      DIFFICULTIES.forEach((name, i) => {
        const can = i === 0 || best >= i - 1;
        row.append(h('button', { class: `btn sm ${i === 3 ? 'pink' : i === 2 ? 'danger' : i === 1 ? 'gold' : 'pri'}`, disabled: !can, 'data-dungeon': d.id, 'data-diff': i, on: { click: () => { ui.closePanel(true); g.startDungeon(d.id, i); } } }, `${name}${best >= i ? ' ✔' : ''}`));
      });
      card.append(row);
    }
    list.append(card);
  }
  const resume = store.run;
  if (resume) p.body.append(h('div', { class: 'card sel', style: 'margin-bottom:10px' }, h('b', null, `Run in progress: ${DUNGEONS.find((d) => d.id === resume.dungeonId)?.name} (${DIFFICULTIES[resume.difficulty]})`), h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'btn sm pri', on: { click: () => { ui.closePanel(true); g.startDungeon(resume.dungeonId, resume.difficulty); } } }, 'Resume run'), h('button', { class: 'btn sm ghost', on: { click: () => { store.run = null; store.persist(); openDungeonSelect(g); } } }, 'Abandon'))));
  p.body.append(list, h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn pink', on: { click: () => { ui.closePanel(true); g.openLobby(); } } }, '👥 Co-op Raid (2–4 players)')));
}

// ---------------------------------------------------------------------------
// Settings & account
// ---------------------------------------------------------------------------

export function openSettings(g: GameApi) {
  const { ui, store } = g;
  const p = ui.panel('Settings', { narrow: true, onClose: () => g.refreshHud() });
  const s = store.s;
  const render = () => {
    clear(p.body);
    const q = h('div', { class: 'row' }, ...(['low', 'medium', 'high'] as Quality[]).map((x) => h('button', { class: `btn sm ${s.settings.quality === x ? 'on' : ''}`, on: { click: () => { s.settings.quality = x; g.setQuality(x); store.persist(); render(); } } }, x.toUpperCase())));
    const vol = (label: string, key: 'music' | 'sfx') => {
      const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s.settings[key]), style: 'width:100%' }) as HTMLInputElement;
      input.addEventListener('input', () => { s.settings[key] = Number(input.value); audio.setVolumes(s.settings.music, s.settings.sfx); });
      input.addEventListener('change', () => store.persist());
      return h('div', { class: 'field' }, h('label', null, label), input);
    };
    const fps = h('button', { class: `btn sm ${s.settings.showFps ? 'on' : ''}`, on: { click: () => { s.settings.showFps = !s.settings.showFps; g.setFps(s.settings.showFps); store.persist(); render(); } } }, s.settings.showFps ? 'FPS monitor: ON' : 'FPS monitor: OFF');
    const acct = h('div', { class: 'card' });
    const sess = api.session;
    acct.append(h('h3', null, 'Account & cloud save'), h('div', { class: 'mu' }, api.online ? `Server online · ${sess ? (sess.guest ? 'Guest account' : `Signed in as ${sess.name}`) : 'Not signed in'} · Sync: ${store.syncStatus}` : 'Server offline — progress is saved on this device.'));
    if (api.online) {
      const u = h('input', { type: 'text', placeholder: 'Username (3-20)', autocomplete: 'username' }) as HTMLInputElement;
      const pw = h('input', { type: 'password', placeholder: 'Password (8+)', autocomplete: 'current-password' }) as HTMLInputElement;
      acct.append(h('div', { class: 'field' }, u), h('div', { class: 'field' }, pw), h('div', { class: 'row' },
        h('button', { class: 'btn sm pri', on: { click: async () => { try { await api.register(u.value.trim(), pw.value); await store.syncFromServer(); ui.toast('Account created — progress is cloud saved', 'good'); render(); } catch (e) { ui.toast(String((e as Error).message), 'bad'); } } } }, sess?.guest ? 'Upgrade guest → account' : 'Register'),
        h('button', { class: 'btn sm', on: { click: async () => { try { await api.login(u.value.trim(), pw.value); const r = await store.syncFromServer(); ui.toast(r === 'server' ? 'Loaded cloud save' : 'Signed in', 'good'); g.refreshHud(); render(); } catch (e) { ui.toast(String((e as Error).message), 'bad'); } } } }, 'Log in'),
        h('button', { class: 'btn sm ghost', on: { click: async () => { const r = await store.syncFromServer(); ui.toast(r === 'none' ? 'Sync failed' : 'Synced', r === 'none' ? 'bad' : 'good'); render(); } } }, 'Sync now')));
    }
    const exp = h('button', { class: 'btn sm', on: { click: () => { const blob = new Blob([JSON.stringify(s)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: `scrapbound-${s.name}.json` }); a.click(); } } }, 'Export save');
    const imp = h('button', { class: 'btn sm', on: { click: () => { const f = h('input', { type: 'file', accept: 'application/json' }) as HTMLInputElement; f.onchange = async () => { const file = f.files?.[0]; if (!file) return; try { const data = migrateSave(JSON.parse(await file.text())); const v = validateSave(data); if (!v.ok) throw new Error(v.errors.slice(0, 3).join(', ')); store.save = data; store.persist(true); ui.toast('Save imported', 'good'); location.reload(); } catch (e) { ui.toast('Invalid save: ' + (e as Error).message, 'bad'); } }; f.click(); } } }, 'Import save');
    const reset = h('button', { class: 'btn sm danger', on: { click: async () => { if (await ui.confirm('Delete save?', 'This permanently deletes your local progress.', 'Delete', true)) { store.reset(); location.reload(); } else openSettings(g); } } }, 'Delete save');
    p.body.append(h('div', { class: 'field' }, h('label', null, 'Graphics quality (auto-lowers if FPS drops)'), q), vol('Music', 'music'), vol('Sound effects', 'sfx'), h('div', { class: 'row', style: 'margin-bottom:10px' }, fps), acct, h('div', { class: 'row', style: 'margin-top:10px' }, exp, imp, reset),
      h('div', { class: 'card', style: 'margin-top:10px' }, h('h3', null, 'Controls'), h('div', { class: 'mu', html: 'PC: <b>WASD</b> move · <b>Shift</b> run · <b>drag mouse</b> rotate camera · <b>wheel</b> zoom · <b>E</b> interact · <b>I</b> inventory · <b>K</b> skills · <b>J</b> quests · <b>M</b> settings<br>Battle: <b>1-9/0</b> commands · <b>←/→</b> target · <b>Enter</b> confirm · <b>Esc</b> back · <b>A</b> auto · <b>Space</b> speed<br>Mobile: left joystick move · drag right side camera · pinch zoom · tap buttons' })));
  };
  render();
}

export { RARITIES };
