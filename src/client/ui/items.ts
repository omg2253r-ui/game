import { RARITIES } from '../../core/types';
import type { ItemInstance } from '../../core/economy/items';
import { gearStats, ARMOR_MAP } from '../../core/economy/items';
import { WEAPON_MAP, weaponAtk, weaponCrit } from '../../core/data/weapons';
import { MATERIAL_MAP, COMPONENT_LABEL, type ComponentType } from '../../core/data/hardware';
import { CONSUMABLE_MAP } from '../../core/data/items';
import { PRODUCT_MAP } from '../../core/economy/crafting';
import { getSkill } from '../../core/data/skills';
import { h, tip } from './dom';

const ELEM_ICON: Record<string, string> = { physical: '✊', electric: '⚡', fire: '🔥', ice: '❄', plasma: '✦', gravity: '◉', quantum: '∞' };
const WEAPON_ICON: Record<string, string> = { katana: '🗡', dual: '⚔', rifle: '🔫', railgun: '🎯', hammer: '🔨', greatsword: '🗡', spear: '🔱', scythe: '☾' };

export function itemIcon(i: ItemInstance): string {
  switch (i.kind) {
    case 'weapon':
      return WEAPON_ICON[WEAPON_MAP[i.defId]?.cls] ?? '⚔';
    case 'armor':
      return '🧥';
    case 'accessory':
      return '💠';
    case 'pc':
      return '🖥';
    case 'consumable':
      return CONSUMABLE_MAP[i.defId]?.icon ?? '🧪';
    default:
      return MATERIAL_MAP[i.defId]?.icon ?? '📦';
  }
}

export function itemName(i: ItemInstance): string {
  const base = i.name ?? (i.kind === 'consumable' ? CONSUMABLE_MAP[i.defId]?.name : i.kind === 'pc' ? PRODUCT_MAP[i.defId]?.name : MATERIAL_MAP[i.defId]?.name ?? ARMOR_MAP[i.defId]?.name ?? WEAPON_MAP[i.defId]?.name) ?? i.defId;
  return `${base}${i.level ? ` +${i.level}` : ''}`;
}

export function specLine(i: ItemInstance): string {
  const s = i.specs ?? {};
  switch (i.kind) {
    case 'weapon': {
      const w = WEAPON_MAP[i.defId];
      if (!w) return '';
      const c = weaponCrit(w, i.rarity, i.level ?? 0);
      return `${ELEM_ICON[w.element]} ATK ${weaponAtk(w, i.rarity, i.level ?? 0)} · SPD ${w.speed >= 0 ? '+' : ''}${w.speed} · CR ${(c.critRate * 100).toFixed(0)}% · CD +${(c.critDmg * 100).toFixed(0)}%`;
    }
    case 'armor':
    case 'accessory':
      return Object.entries(gearStats(i)).map(([k, v]) => `${k.toUpperCase()} ${['critRate', 'critDmg', 'elemBonus'].includes(k) ? '+' + Math.round((v as number) * 100) + '%' : '+' + v}`).join(' · ');
    case 'component': {
      const parts: string[] = [];
      if (s.socket) parts.push(s.socket);
      if (s.cores) parts.push(`${s.cores} cores`);
      if (s.ramType) parts.push(s.ramType);
      if (s.capacity) parts.push(s.capacity >= 1000 ? `${s.capacity / 1000}TB` : `${s.capacity}GB`);
      if (s.formFactor) parts.push(s.formFactor.toUpperCase());
      if (s.pcie) parts.push(`PCIe${s.pcie}`);
      if (s.gpuLength && i.defId === 'gpu') parts.push(`${s.gpuLength}mm`);
      if (s.perf) parts.push(`perf ${s.perf}`);
      if (s.supply) parts.push(`${s.supply}W out`);
      if (s.cooling) parts.push(`cool ${s.cooling}`);
      if (s.watts) parts.push(`${s.watts}W`);
      if (s.heat) parts.push(`heat ${s.heat}`);
      if (s.qubits) parts.push(`${s.qubits} qubits`);
      return `${parts.join(' · ')} · Q${i.quality}`;
    }
    case 'pc':
      return `perf ${i.pc?.perf} · quality ${i.pc?.quality} · value ${i.pc?.value}cr`;
    case 'consumable':
      return CONSUMABLE_MAP[i.defId]?.desc ?? '';
    case 'material':
      return MATERIAL_MAP[i.defId]?.desc ?? '';
  }
}

export function itemTip(i: ItemInstance): string {
  let extra = '';
  if (i.kind === 'weapon') {
    const w = WEAPON_MAP[i.defId];
    if (w) extra = `<br><b>Skill:</b> ${getSkill(w.skill).name} — ${getSkill(w.skill).desc}<br><b>Ultimate:</b> ${getSkill(w.ultimate).name}<br><b>Passive:</b> ${w.passiveName} — ${w.passiveDesc}`;
  }
  if (i.kind === 'component') extra = `<br>${COMPONENT_LABEL[i.defId as ComponentType] ?? ''}`;
  if (i.kind === 'pc') extra = `<br>${(i.pc?.parts ?? []).join(', ')}`;
  return `<b class="r${i.rarity}">${RARITIES[i.rarity]} ${itemName(i)}</b><br>${specLine(i)}${extra}`;
}

export function itemRow(i: ItemInstance, opts: { sel?: boolean; onClick?: () => void; right?: Node | string; sub?: string; equipped?: string } = {}): HTMLElement {
  const el = h('div', { class: `item rb${i.rarity} ${opts.sel ? 'sel' : ''}`, on: { click: () => opts.onClick?.() }, 'data-uid': i.uid },
    h('span', { class: 'ic' }, itemIcon(i)),
    h('div', { style: 'min-width:0;flex:1' },
      h('div', { class: `nm r${i.rarity}` }, itemName(i), i.locked ? ' 🔒' : '', opts.equipped ? h('span', { class: 'tag', style: 'margin-left:6px' }, opts.equipped) : null),
      h('div', { class: 'sub' }, opts.sub ?? specLine(i))),
    i.qty > 1 || i.kind === 'material' || i.kind === 'consumable' ? h('span', { class: 'qty' }, `×${i.qty}`) : null,
    opts.right ?? null,
    i.isNew ? h('span', { class: 'new' }, 'NEW') : null);
  tip(el, () => itemTip(i));
  return el;
}

export { ELEM_ICON };
