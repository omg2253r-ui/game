/**
 * Battle controller + HUD. Drives the planning phase (command menus, targeting,
 * keyboard shortcuts, auto-battle), locks input during playback and hands plans to a
 * driver: the local engine (single player) or the co-op server.
 */
import type { Action, BattleEvent, BattleState, RoundResult, Unit } from '../../core/combat/types';
import { predictOrder, validateAction, getUnit, hasStatus, TEAM_COMBO_COST, TEAM_ULT_COST, bagFor } from '../../core/combat/engine';
import { chooseAllyAction } from '../../core/combat/ai';
import { getSkill, type TargetMode } from '../../core/data/skills';
import { CONSUMABLE_MAP, STATUS_INFO } from '../../core/data/items';
import { ENEMY_MAP } from '../../core/data/enemies';
import { WEAPON_MAP } from '../../core/data/weapons';
import type { StatusId } from '../../core/combat/types';
import { BattleView } from './view';
import { h, clear, bar, setBar, tip, hideTip } from '../ui/dom';
import type { DungeonTheme } from '../../core/data/regions';
import type { QualityProfile } from '../render/renderer';
import type * as THREE from 'three';
import { audio } from '../audio/audio';
import type { Input } from '../input/input';
import type { Ui } from '../ui/ui';

export interface Driver {
  mode: 'single' | 'coop';
  owner?: string;
  resolve?(state: BattleState, plans: Record<string, Action>): RoundResult;
  sendPlan?(unitId: string, action: Action | null, locked: boolean): void;
}

const ELEM_ICON: Record<string, string> = { physical: '✊', electric: '⚡', fire: '🔥', ice: '❄', plasma: '✦', gravity: '◉', quantum: '∞' };

type Menu = 'root' | 'skill' | 'item' | 'switch' | 'combo' | 'target';

interface Pending {
  action: Action;
  mode: TargetMode | 'enemy';
  label: string;
}

export class Battle {
  readonly view: BattleView;
  state: BattleState;
  private disp: BattleState;
  private root: HTMLDivElement;
  private labels = new Map<string, HTMLDivElement>();
  private cards = new Map<string, HTMLDivElement>();
  private timelineEl!: HTMLDivElement;
  private roundEl!: HTMLDivElement;
  private cmdEl!: HTMLDivElement;
  private logEl!: HTMLDivElement;
  private floatLayer: HTMLDivElement;
  private plans: Record<string, Action> = {};
  private cursor = 0;
  private menu: Menu = 'root';
  private pending: Pending | null = null;
  private targetIdx = 0;
  private busy = false;
  auto = false;
  private done: (r: BattleState) => void = () => {};
  readonly finished: Promise<BattleState>;
  private offKey: () => void;
  private offTap: () => void;
  private offHover: () => void;
  private locked = false;
  private peer: Record<string, { name: string; locked: boolean; plans: Record<string, Action> }> = {};
  private deadline = 0;
  private timerEl: HTMLDivElement | null = null;
  private queue: (() => Promise<void>)[] = [];
  private draining = false;
  private hoverId: string | null = null;
  private pos = { x: 0, y: 0, visible: false };

  constructor(state: BattleState, camera: THREE.PerspectiveCamera, theme: DungeonTheme, profile: QualityProfile, private driver: Driver, private input: Input, private ui: Ui, opts: { auto?: boolean; speed?: number } = {}) {
    this.state = state;
    this.disp = JSON.parse(JSON.stringify(state));
    this.auto = !!opts.auto && driver.mode === 'single';
    this.root = h('div', { class: 'battle-ui pass' });
    this.floatLayer = h('div', { class: 'float-layer' });
    this.root.appendChild(this.floatLayer);
    ui.layer.appendChild(this.root);
    this.view = new BattleView(state, camera, theme, profile, {
      unit: (id, p) => this.patchUnit(id, p),
      status: (id, st, on, stacks) => this.patchStatus(id, st as StatusId, on, stacks),
      float: (id, text, cls, sub) => this.float(id, text, cls, sub),
      banner: (t, c, s) => ui.banner(t, c, s),
      log: (t) => this.log(t),
      team: (v) => {
        this.disp.teamGauge = v;
        this.renderRound();
      },
      flash: () => ui.flash(),
      added: (u) => {
        this.disp.units.push(JSON.parse(JSON.stringify(u)));
        this.makeLabel(u);
      },
      swapped: (o, i) => {
        const ou = getUnit(this.disp, o), iu = getUnit(this.disp, i);
        if (ou) ou.onField = false;
        if (iu) iu.onField = true;
        this.renderParty();
      },
      intents: () => {},
      name: (id) => getUnit(this.disp, id)?.name ?? id,
    });
    this.view.speed = opts.speed ?? 1;
    this.buildHud();
    this.finished = new Promise((r) => (this.done = r));
    this.offKey = input.onKey((e) => this.key(e));
    this.offTap = input.onTap((x, y) => this.tap(x, y));
    this.offHover = input.onHover((x, y) => {
      this.hoverId = this.view.pick(x, y);
    });
    audio.music(state.units.some((u) => u.isBoss) ? 'boss' : 'battle');
    if (driver.mode === 'single') this.beginPlanning();
    else this.renderCmd();
  }

  // ---------------------------------------------------------------------------
  // HUD construction
  // ---------------------------------------------------------------------------

  private buildHud() {
    const top = h('div', { class: 'b-top' });
    this.roundEl = h('div', { class: 'b-round' });
    this.timelineEl = h('div', { class: 'timeline', 'aria-label': 'Turn order' });
    top.append(this.roundEl, this.timelineEl);
    this.root.appendChild(top);
    const tools = h('div', { class: 'b-tools' });
    if (this.driver.mode === 'single') {
      tools.append(
        h('button', { class: `btn sm ${this.auto ? 'on' : ''}`, id: 'b-auto', on: { click: () => this.toggleAuto() }, title: 'Auto battle (A)' }, '⟳ Auto'),
      );
    }
    tools.append(h('button', { class: 'btn sm', id: 'b-speed', on: { click: () => this.toggleSpeed() }, title: 'Playback speed (Space)' }, `${this.view.speed}×`));
    this.root.appendChild(tools);
    this.logEl = h('div', { class: 'b-log' });
    this.root.appendChild(this.logEl);
    const party = h('div', { class: 'b-party' });
    this.root.appendChild(party);
    this.cmdEl = h('div', { class: 'b-cmd' });
    this.root.appendChild(this.cmdEl);
    for (const u of this.disp.units) this.makeLabel(u);
    this.renderParty();
    this.renderRound();
    this.renderTimeline();
  }

  private makeLabel(u: Unit) {
    if (u.side !== 'enemy' || this.labels.has(u.id)) return;
    const el = h('div', { class: 'unit-label' });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.chooseTarget(u.id);
    });
    tip(el, () => this.enemyTip(u.id));
    this.floatLayer.appendChild(el);
    this.labels.set(u.id, el);
    this.renderLabel(u.id);
  }

  private enemyTip(id: string): string {
    const u = getUnit(this.disp, id);
    if (!u) return '';
    const d = ENEMY_MAP[u.templateId];
    const prof = u.scanned ? `<br>Weak: ${u.profile.weak.map((e) => ELEM_ICON[e] + e).join(', ') || '—'}<br>Resist: ${u.profile.resist.join(', ') || '—'}<br>Immune: ${u.profile.immune.join(', ') || '—'}` : '<br><i>Scan to reveal weaknesses</i>';
    return `<b>${u.name}</b> Lv${u.level}<br>${d?.desc ?? ''}${prof}<br>Statuses: ${u.statuses.map((s) => STATUS_INFO[s.id].name).join(', ') || 'none'}`;
  }

  private renderLabel(id: string) {
    const el = this.labels.get(id);
    const u = getUnit(this.disp, id);
    if (!el || !u) return;
    clear(el);
    el.classList.toggle('dead', !u.alive);
    const intent = this.state.intents[id];
    if (intent && intent.type === 'enemy' && u.alive) {
      const sk = getSkill(intent.skillId);
      const tgt = intent.target ? getUnit(this.disp, intent.target)?.name : sk.target === 'all_enemies' ? 'ALL' : '';
      el.append(h('div', { class: `intent ${sk.telegraph || sk.power >= 1.6 ? 'danger' : ''}` }, `${sk.telegraph ? '⚠ ' : ''}${sk.name}${tgt ? ' → ' + tgt : ''}`));
    }
    el.append(h('div', { class: 'nm' }, `${u.isBoss ? '👑 ' : ''}${u.name} `, h('span', { class: 'elm' }, `Lv${u.level}`)));
    const hb = bar(`hp ${u.hp / u.stats.hp < 0.3 ? 'low' : ''}`, u.hp / u.stats.hp);
    el.append(hb);
    if (u.maxArmor > 0) el.append(bar('arm', u.armor / u.maxArmor));
    const sts = h('div', { class: 'sts' });
    if (u.scanned) for (const w of u.profile.weak) sts.append(h('span', { class: 'st', style: 'color:#ffe066', title: `Weak: ${w}` }, ELEM_ICON[w]));
    for (const s of u.statuses) {
      const info = STATUS_INFO[s.id];
      sts.append(h('span', { class: 'st', style: `color:${info.color}`, title: `${info.name}: ${info.desc}` }, info.icon, s.stacks > 1 ? h('sub', null, s.stacks) : null, s.id === 'countdown' ? h('sub', null, s.value) : null));
    }
    el.append(sts);
  }

  private renderParty() {
    const wrap = this.root.querySelector('.b-party')!;
    clear(wrap as HTMLElement);
    this.cards.clear();
    const allies = this.disp.units.filter((u) => u.side === 'ally' && u.onField).sort((a, b) => a.slot - b.slot);
    const current = this.currentUnit();
    for (const u of allies) {
      const mine = this.controls(u);
      const c = h('div', { class: `pcard ${u.alive ? '' : 'dead'} ${current?.id === u.id && !this.busy ? 'active' : ''} ${this.plans[u.id] ? 'planned' : ''}` });
      const w = WEAPON_MAP[u.weaponId ?? ''];
      c.append(h('div', { class: 'hd' }, h('span', null, ELEM_ICON[u.element]), u.name, h('span', { class: 'lv' }, `Lv${u.level}`), this.driver.mode === 'coop' ? h('span', { class: 'own' }, mine ? 'YOU' : u.autoControl ? 'AI' : this.peerName(u.ownerId)) : null));
      const bars = h('div', { class: 'bars' });
      bars.append(bar(`hp ${u.hp / u.stats.hp < 0.3 ? 'low' : ''}`, u.hp / u.stats.hp), bar('en', u.energy / u.stats.energy), bar(`ult ${u.ult >= 100 ? 'full' : ''}`, u.ult / 100));
      c.append(bars);
      c.append(h('div', { class: 'nums' }, h('span', null, `HP ${u.hp}/${u.stats.hp}`), h('span', null, `EN ${u.energy}`), h('span', null, `ULT ${u.ult}%`)));
      const sts = h('div', { class: 'sts', style: 'display:flex;gap:2px;flex-wrap:wrap;margin-top:2px' });
      for (const s of u.statuses) {
        const info = STATUS_INFO[s.id];
        sts.append(h('span', { class: 'st', style: `color:${info.color}`, title: info.name }, info.icon));
      }
      c.append(sts);
      const plan = this.plans[u.id] ?? this.peerPlan(u.id);
      if (plan) c.append(h('div', { class: 'plan' }, '▸ ' + this.describe(plan)));
      tip(c, () => `<b>${u.name}</b> · ${w?.name ?? ''}<br>ATK ${u.stats.atk} DEF ${u.stats.def} SPD ${u.stats.spd}<br>Crit ${(u.stats.critRate * 100).toFixed(0)}% / +${(u.stats.critDmg * 100).toFixed(0)}%<br>Passive: ${w?.passiveName ?? ''} — ${w?.passiveDesc ?? ''}`);
      c.addEventListener('click', () => this.cardClick(u.id));
      wrap.appendChild(c);
      this.cards.set(u.id, c);
    }
    // reserve indicator
    const reserve = this.disp.units.filter((u) => u.side === 'ally' && !u.onField && u.alive);
    if (reserve.length && this.driver.mode === 'single') wrap.appendChild(h('div', { class: 'mu', style: 'padding:0 4px' }, `Reserve: ${reserve.map((r) => r.name).join(', ')}`));
  }

  private renderRound() {
    clear(this.roundEl);
    const tb = bar('team', this.disp.teamGauge / 100);
    this.roundEl.append(h('span', null, `ROUND ${this.state.round}`), h('span', { class: 'mu' }, 'TEAM'), tb, h('span', { style: 'font-weight:700;color:#ffc044' }, `${this.disp.teamGauge}`));
    if (this.driver.mode === 'coop' && this.deadline) {
      this.timerEl = h('div', { class: 'timer', style: 'width:80px;margin:0' }, h('i', { style: 'width:100%' }));
      this.roundEl.append(this.timerEl);
    }
  }

  private renderTimeline() {
    clear(this.timelineEl);
    this.timelineEl.append(h('span', { class: 'lbl' }, 'ORDER'));
    const order = predictOrder(this.state, { ...this.peerPlansAll(), ...this.plans });
    const current = this.currentUnit();
    for (const o of order) {
      const u = getUnit(this.disp, o.id);
      if (!u) continue;
      const chip = h('div', { class: `tl ${u.side} ${u.isBoss ? 'boss' : ''} ${o.skip ? 'skip' : ''} ${current?.id === u.id && !this.busy ? 'now' : ''}`, title: `${u.name}${o.skip ? ' (' + o.skip + ')' : ''} · SPD ${Math.round(o.spd)}` }, u.name.slice(0, 2).toUpperCase(), o.priority > 0 ? h('span', { class: 'p' }, '+' + o.priority) : o.priority < 0 ? h('span', { class: 'p', style: 'background:#b28cff' }, String(o.priority)) : null);
      this.timelineEl.append(chip);
    }
  }

  // ---------------------------------------------------------------------------
  // planning
  // ---------------------------------------------------------------------------

  private controls(u: Unit): boolean {
    if (this.driver.mode === 'single') return true;
    return u.ownerId === this.driver.owner;
  }

  private controllable(): Unit[] {
    return this.state.units.filter((u) => u.side === 'ally' && u.alive && u.onField && this.controls(u)).sort((a, b) => a.slot - b.slot);
  }

  private currentUnit(): Unit | undefined {
    const list = this.controllable();
    return list[Math.min(this.cursor, list.length - 1)];
  }

  private beginPlanning() {
    this.busy = false;
    this.locked = false;
    this.plans = {};
    this.menu = 'root';
    this.pending = null;
    this.cursor = 0;
    // in co-op, consumed partner plans: skip units whose plan is decided by combos
    this.renderAll();
    if (this.auto && this.driver.mode === 'single') setTimeout(() => this.autoPlan(), 250);
  }

  private renderAll() {
    this.renderParty();
    this.renderRound();
    this.renderTimeline();
    for (const id of this.labels.keys()) this.renderLabel(id);
    this.renderCmd();
  }

  private remainingBag(u: Unit): Record<string, number> {
    const bag = { ...bagFor(this.state, u) };
    for (const [id, a] of Object.entries(this.plans)) {
      const pu = getUnit(this.state, id);
      if (a.type === 'item' && pu && (pu.ownerId ?? 'local') === (u.ownerId ?? 'local')) bag[a.itemId] = (bag[a.itemId] ?? 0) - 1;
    }
    return bag;
  }

  private renderCmd() {
    const el = this.cmdEl;
    clear(el);
    el.className = 'b-cmd';
    if (this.state.phase === 'ended') {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    if (this.busy) {
      el.className = 'b-status';
      el.append(h('div', null, '▶ Resolving round… ', h('span', { class: 'mu' }, '(commands locked)')));
      return;
    }
    if (this.driver.mode === 'coop' && (this.locked || this.controllable().length === 0)) {
      el.className = 'b-status';
      el.append(h('div', null, this.controllable().length ? '🔒 Commands locked in. Waiting for party…' : 'Your hunter is down — waiting for a revive…'));
      el.append(this.peerList());
      if (this.locked) el.append(h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'btn sm', on: { click: () => this.unlock() } }, 'Change commands')));
      return;
    }
    const u = this.currentUnit();
    if (!u) return;
    if (this.driver.mode === 'coop' && this.deadline) {
      this.timerEl = h('div', { class: 'timer' }, h('i', { style: 'width:100%' }));
      el.append(this.timerEl);
    }
    const w = WEAPON_MAP[u.weaponId ?? ''];
    el.append(h('div', { class: 'who' }, ELEM_ICON[u.element], u.name, h('span', { class: 'mu' }, `${w?.name ?? ''} · ${this.cursor + 1}/${this.controllable().length}`), this.pending ? h('span', { class: 'mu', style: 'margin-left:auto' }, `Target: ${this.pending.label}`) : null));

    if (this.menu === 'root') {
      const g = h('div', { class: 'cmd-grid' });
      const ult = u.ultimate ? getSkill(u.ultimate) : null;
      const anyReserve = this.state.units.some((x) => x.side === 'ally' && !x.onField && x.alive);
      const partners = this.state.units.filter((x) => x.side === 'ally' && x.alive && x.onField && x.id !== u.id);
      const cmds: [string, string, string, string, boolean, () => void, string, string?][] = [
        ['1', '⚔', 'Attack', `${ELEM_ICON[u.element]} ${u.element}`, true, () => this.startTarget({ type: 'attack', target: '' }, 'enemy', 'Attack'), `Basic ${u.element} attack. +15 Energy, builds Ultimate.`],
        ['2', '✦', 'Skill', `EN ${u.energy}`, u.skills.some((s) => (getSkill(s).energyCost ?? 0) <= u.energy && !(u.cooldowns[s] > 0)), () => this.setMenu('skill'), 'Weapon & tech skills (cost Energy).'],
        ['3', '★', 'Ultimate', `${u.ult}%`, u.ult >= 100, () => ult && this.startTarget({ type: 'ultimate', target: '' }, ult.target, ult.name), ult ? `${ult.name}: ${ult.desc}` : '', 'ult'],
        ['4', '⛨', 'Defend', '-50% dmg', true, () => this.setPlan({ type: 'defend' }), 'Acts first. Halves damage taken this round. +20 Energy.'],
        ['5', '↯', 'Dodge', '70% evade', true, () => this.setPlan({ type: 'dodge' }), 'Acts first. 70% chance to evade single-target attacks.'],
        ['6', '🎒', 'Item', '', Object.values(this.remainingBag(u)).some((n) => n > 0), () => this.setMenu('item'), 'Use a consumable.'],
        ['7', '◎', 'Scan', 'weak pts', true, () => this.startTarget({ type: 'scan', target: '' }, 'enemy', 'Scan'), 'Reveal weaknesses & intent, mark a Weak Point (+30% crit vs target). +20 Energy.'],
        ['8', '⚭', 'Combo', `${TEAM_COMBO_COST} TG`, this.state.teamGauge >= TEAM_COMBO_COST && partners.length > 0, () => this.setMenu('combo'), 'Team Combination with a partner: both elements strike, priming a reaction. On a Broken enemy it becomes a TEAM FINISHER.', 'team'],
        ['9', '✸', 'Team Ult', `${this.state.teamGauge}/100`, this.state.teamGauge >= TEAM_ULT_COST, () => this.setPlan({ type: 'team_ultimate' }), this.driver.mode === 'coop' ? 'Every player must choose Team Ultimate this round.' : 'All hunters unleash a multi-element storm on every enemy.', 'team'],
      ];
      if (this.driver.mode === 'single') cmds.push(['0', '⇄', 'Switch', 'reserve', anyReserve, () => this.setMenu('switch'), 'Swap with a reserve hunter (acts first).']);
      if (this.state.canFlee && this.driver.mode === 'single') cmds.push(['F', '🏃', 'Escape', '', true, () => this.setPlan({ type: 'flee' }), 'Try to escape (not possible vs bosses).']);
      for (const [k, i, n, c, en, fn, desc, cls] of cmds) {
        const b = h('button', { class: `cmd ${cls ?? ''} ${cls === 'ult' && en ? 'ready' : ''}`, disabled: !en, on: { click: () => { audio.sfx('click'); fn(); } }, 'data-cmd': n.toLowerCase().replace(' ', '_') }, h('span', { class: 'k' }, k), h('span', { class: 'i' }, i), n, h('span', { class: 'c' }, c));
        tip(b, () => `<b>${n}</b><br>${desc}`);
        g.append(b);
      }
      el.append(g);
    } else if (this.menu === 'skill') {
      const list = h('div', { class: 'sub-list' });
      u.skills.forEach((id, idx) => {
        const sk = getSkill(id);
        const cd = u.cooldowns[id] ?? 0;
        const ok = (sk.energyCost ?? 0) <= u.energy && cd <= 0;
        list.append(h('button', { class: 'sub-item', disabled: !ok, 'data-skill': id, on: { click: () => this.startTarget({ type: 'skill', skillId: id }, sk.target, sk.name) } }, h('span', { class: 'cost' }, `${idx + 1} · EN ${sk.energyCost ?? 0}${cd ? ` · CD ${cd}` : ''}`), h('b', null, `${ELEM_ICON[sk.element]} ${sk.name}`), h('span', { class: 'd' }, sk.desc)));
      });
      el.append(list);
    } else if (this.menu === 'item') {
      const list = h('div', { class: 'sub-list' });
      const bag = this.remainingBag(u);
      Object.entries(bag).filter(([, n]) => n > 0).forEach(([id, n], idx) => {
        const d = CONSUMABLE_MAP[id];
        if (!d) return;
        list.append(h('button', { class: 'sub-item', on: { click: () => this.startTarget({ type: 'item', itemId: id }, d.target, d.name) } }, h('span', { class: 'cost' }, `${idx + 1} · ×${n}`), h('b', null, `${d.icon} ${d.name}`), h('span', { class: 'd' }, d.desc)));
      });
      el.append(list);
    } else if (this.menu === 'switch') {
      const list = h('div', { class: 'sub-list' });
      this.state.units.filter((x) => x.side === 'ally' && !x.onField && x.alive).forEach((r, idx) => {
        list.append(h('button', { class: 'sub-item', on: { click: () => this.setPlan({ type: 'switch', reserveId: r.id }) } }, h('span', { class: 'cost' }, `${idx + 1}`), h('b', null, `${ELEM_ICON[r.element]} ${r.name}`), h('span', { class: 'd' }, `HP ${r.hp}/${r.stats.hp} · ${WEAPON_MAP[r.weaponId ?? '']?.name}`)));
      });
      el.append(list);
    } else if (this.menu === 'combo') {
      const list = h('div', { class: 'sub-list' });
      this.state.units.filter((x) => x.side === 'ally' && x.alive && x.onField && x.id !== u.id).forEach((p, idx) => {
        const mine = this.controls(p);
        list.append(h('button', { class: 'sub-item', on: { click: () => this.startTarget({ type: 'combo', partner: p.id, target: '' }, 'enemy', `Combo with ${p.name}`) } }, h('span', { class: 'cost' }, `${idx + 1}`), h('b', null, `${ELEM_ICON[u.element]} + ${ELEM_ICON[p.element]}  ${u.name} × ${p.name}`), h('span', { class: 'd' }, mine ? `${p.name} gives up their action.` : `${p.name}'s player must also choose Combo with you.`)));
      });
      el.append(list);
    } else if (this.menu === 'target') {
      el.append(h('div', { class: 'mu', style: 'margin:4px 0 6px' }, this.input.touch ? 'Tap a highlighted target' : 'Click a target · ←/→ to cycle · Enter to confirm'));
      const list = h('div', { class: 'sub-list' });
      this.validTargets().forEach((t, i) => {
        list.append(h('button', { class: `sub-item ${i === this.targetIdx ? 'sel' : ''}`, style: i === this.targetIdx ? 'border-color:#ffc044' : '', 'data-target': t.id, on: { click: () => this.chooseTarget(t.id) } }, h('b', null, `${t.isBoss ? '👑 ' : ''}${t.name}`), h('span', { class: 'd' }, `HP ${t.hp}/${t.stats.hp}${t.maxArmor ? ` · Armor ${t.armor}` : ''}${t.scanned && t.profile.weak.length ? ` · Weak ${t.profile.weak.map((x) => ELEM_ICON[x]).join('')}` : ''}`)));
      });
      el.append(list);
    }
    const foot = h('div', { class: 'foot' });
    foot.append(h('button', { class: 'btn sm ghost', disabled: this.menu === 'root' && this.cursor === 0 && !this.plans[u.id], on: { click: () => this.back() } }, '← Back', h('span', { class: 'kbd' }, 'Esc')));
    if (this.driver.mode === 'single') foot.append(h('button', { class: 'btn sm', on: { click: () => this.autoPlan() } }, '⟳ Auto turn'));
    else {
      const ready = this.controllable().every((x) => this.plans[x.id]);
      foot.append(h('button', { class: 'btn sm pri', disabled: !ready, on: { click: () => this.lockIn() } }, '🔒 Lock in'));
    }
    el.append(foot);
    if (this.driver.mode === 'coop') el.append(this.peerList());
    this.highlightTargets();
  }

  private peerList(): HTMLElement {
    const wrap = h('div', { class: 'mu', style: 'margin-top:6px;display:flex;gap:8px;flex-wrap:wrap' });
    for (const [, p] of Object.entries(this.peer)) wrap.append(h('span', { class: 'tag', style: p.locked ? 'border-color:#5fe08a' : '' }, `${p.locked ? '🔒' : '…'} ${p.name}`));
    return wrap;
  }

  private peerName(owner?: string) {
    return owner ? this.peer[owner]?.name ?? 'Ally' : 'AI';
  }
  private peerPlan(unitId: string): Action | undefined {
    for (const p of Object.values(this.peer)) if (p.plans[unitId]) return p.plans[unitId];
    return undefined;
  }
  private peerPlansAll(): Record<string, Action> {
    const out: Record<string, Action> = {};
    for (const p of Object.values(this.peer)) Object.assign(out, p.plans);
    return out;
  }

  private describe(a: Action): string {
    const nm = (id?: string) => (id ? getUnit(this.disp, id)?.name ?? '?' : '');
    switch (a.type) {
      case 'attack':
        return `Attack → ${nm(a.target)}`;
      case 'skill':
        return `${getSkill(a.skillId).name}${a.target ? ' → ' + nm(a.target) : ''}`;
      case 'ultimate':
        return `ULT${a.target ? ' → ' + nm(a.target) : ''}`;
      case 'item':
        return `${CONSUMABLE_MAP[a.itemId]?.name}${a.target ? ' → ' + nm(a.target) : ''}`;
      case 'combo':
        return `Combo w/ ${nm(a.partner)} → ${nm(a.target)}`;
      case 'switch':
        return `Switch → ${nm(a.reserveId)}`;
      case 'scan':
        return `Scan → ${nm(a.target)}`;
      case 'team_ultimate':
        return 'TEAM ULTIMATE';
      case 'flee':
        return 'Escape';
      default:
        return a.type[0].toUpperCase() + a.type.slice(1);
    }
  }

  private setMenu(m: Menu) {
    this.menu = m;
    this.pending = null;
    this.renderCmd();
  }

  private startTarget(action: Action, mode: TargetMode | 'enemy', label: string) {
    if (mode === 'enemy' || mode === 'ally' || mode === 'dead_ally') {
      this.pending = { action, mode, label };
      this.menu = 'target';
      const vt = this.validTargets();
      // default to the hovered or a sensible target
      const pref = vt.findIndex((t) => t.id === this.hoverId);
      this.targetIdx = pref >= 0 ? pref : 0;
      if (vt.length === 0) {
        this.ui.toast('No valid target', 'bad');
        this.menu = 'root';
        this.pending = null;
      }
      this.renderCmd();
      return;
    }
    this.setPlan(action);
  }

  private validTargets(): Unit[] {
    if (!this.pending) return [];
    const m = this.pending.mode;
    if (m === 'enemy') return this.state.units.filter((u) => u.side === 'enemy' && u.alive && u.onField).sort((a, b) => (this.view.units.get(a.id)?.home.x ?? 0) - (this.view.units.get(b.id)?.home.x ?? 0));
    if (m === 'ally') return this.state.units.filter((u) => u.side === 'ally' && u.alive && u.onField);
    if (m === 'dead_ally') return this.state.units.filter((u) => u.side === 'ally' && !u.alive);
    return [];
  }

  private highlightTargets() {
    const valid = new Set(this.menu === 'target' ? this.validTargets().map((u) => u.id) : []);
    const vt = this.validTargets();
    const sel = vt[this.targetIdx]?.id;
    for (const [id, el] of this.labels) {
      el.classList.toggle('targetable', valid.has(id));
      el.style.outline = sel === id && valid.has(id) ? '2px solid #ffc044' : '';
      el.style.borderRadius = '10px';
    }
    for (const [id, el] of this.cards) el.classList.toggle('targetable', valid.has(id));
  }

  private chooseTarget(id: string) {
    if (this.menu !== 'target' || !this.pending) return;
    if (!this.validTargets().some((t) => t.id === id)) return;
    const a = { ...this.pending.action } as Action & { target?: string };
    a.target = id;
    this.setPlan(a as Action);
  }

  private setPlan(a: Action) {
    const u = this.currentUnit();
    if (!u) return;
    const err = validateAction(this.state, u.id, a, this.driver.mode === 'coop' ? this.driver.owner : undefined);
    if (err) {
      audio.sfx('error');
      this.ui.toast(err, 'bad');
      return;
    }
    audio.sfx('confirm');
    this.plans[u.id] = a;
    // single player: a combo/team-ult consumes partner actions automatically
    if (this.driver.mode === 'single') {
      if (a.type === 'combo') delete this.plans[a.partner];
      if (a.type === 'team_ultimate') {
        for (const x of this.controllable()) if (x.id !== u.id) this.plans[x.id] = { type: 'pass' };
      }
    }
    this.driver.sendPlan?.(u.id, a, false);
    this.menu = 'root';
    this.pending = null;
    this.advance();
  }

  private advance() {
    const list = this.controllable();
    const consumed = new Set<string>();
    if (this.driver.mode === 'single') for (const a of Object.values(this.plans)) if (a.type === 'combo') consumed.add(a.partner);
    let next = -1;
    for (let i = 0; i < list.length; i++) {
      if (!this.plans[list[i].id] && !consumed.has(list[i].id)) {
        next = i;
        break;
      }
    }
    if (next === -1) {
      if (this.driver.mode === 'single') {
        this.renderAll();
        void this.execute();
      } else {
        this.cursor = list.length - 1;
        this.renderAll();
      }
      return;
    }
    this.cursor = next;
    this.renderAll();
  }

  private back() {
    audio.sfx('back');
    if (this.menu !== 'root') {
      this.menu = this.menu === 'target' && this.pending && ['skill', 'item', 'combo'].includes(this.pending.action.type) ? (this.pending.action.type as Menu) : 'root';
      this.pending = null;
      this.renderCmd();
      return;
    }
    const list = this.controllable();
    const u = list[this.cursor];
    if (u && this.plans[u.id]) {
      delete this.plans[u.id];
      this.driver.sendPlan?.(u.id, null, false);
    } else if (this.cursor > 0) {
      this.cursor--;
      const prev = list[this.cursor];
      if (prev) {
        const pa = this.plans[prev.id];
        delete this.plans[prev.id];
        if (pa?.type === 'team_ultimate') for (const x of list) if (this.plans[x.id]?.type === 'pass') delete this.plans[x.id];
        this.driver.sendPlan?.(prev.id, null, false);
      }
    }
    this.renderAll();
  }

  private cardClick(id: string) {
    if (this.menu === 'target') return this.chooseTarget(id);
    if (this.busy) return;
    const list = this.controllable();
    const i = list.findIndex((u) => u.id === id);
    if (i >= 0) {
      this.cursor = i;
      delete this.plans[id];
      this.menu = 'root';
      this.renderAll();
    }
  }

  private autoPlan() {
    if (this.busy) return;
    for (const u of this.controllable()) {
      if (this.plans[u.id]) continue;
      const a = chooseAllyAction(this.state, u, this.remainingBag(u));
      if (!validateAction(this.state, u.id, a)) this.plans[u.id] = a;
      else this.plans[u.id] = { type: 'defend' };
    }
    if (this.driver.mode === 'single') void this.execute();
    else this.lockIn();
  }

  private toggleAuto() {
    this.auto = !this.auto;
    this.root.querySelector('#b-auto')?.classList.toggle('on', this.auto);
    this.ui.toast(this.auto ? 'Auto battle ON' : 'Auto battle OFF');
    if (this.auto && !this.busy) this.autoPlan();
  }

  private toggleSpeed() {
    this.view.speed = this.view.speed === 1 ? 2 : this.view.speed === 2 ? 3 : 1;
    const b = this.root.querySelector('#b-speed');
    if (b) b.textContent = `${this.view.speed}×`;
  }

  // ---------------------------------------------------------------------------
  // input
  // ---------------------------------------------------------------------------

  private key(e: KeyboardEvent) {
    if (this.state.phase === 'ended') return;
    if (e.code === 'Space') {
      this.toggleSpeed();
      return;
    }
    if (e.code === 'KeyA' && this.driver.mode === 'single') {
      this.toggleAuto();
      return;
    }
    if (this.busy || this.locked) return;
    if (e.code === 'Escape' || e.code === 'Backspace') {
      this.back();
      return;
    }
    if (this.menu === 'target') {
      const vt = this.validTargets();
      if (e.code === 'ArrowRight' || e.code === 'Tab' || e.code === 'ArrowDown') {
        this.targetIdx = (this.targetIdx + 1) % vt.length;
        this.renderCmd();
        e.preventDefault();
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        this.targetIdx = (this.targetIdx - 1 + vt.length) % vt.length;
        this.renderCmd();
      } else if (e.code === 'Enter' || e.code === 'KeyE') {
        if (vt[this.targetIdx]) this.chooseTarget(vt[this.targetIdx].id);
      } else if (/^Digit[1-9]$/.test(e.code)) {
        const i = Number(e.code.slice(5)) - 1;
        if (vt[i]) this.chooseTarget(vt[i].id);
      }
      return;
    }
    const digit = /^Digit([0-9])$/.exec(e.code)?.[1];
    if (this.menu !== 'root' && digit) {
      const btns = this.cmdEl.querySelectorAll<HTMLButtonElement>('.sub-item');
      const b = btns[Number(digit) - 1];
      if (b && !b.disabled) b.click();
      return;
    }
    if (this.menu === 'root') {
      const key = digit ?? (e.code === 'KeyF' ? 'F' : null);
      if (!key) return;
      const btn = [...this.cmdEl.querySelectorAll<HTMLButtonElement>('.cmd')].find((b) => b.querySelector('.k')?.textContent === key);
      if (btn && !btn.disabled) btn.click();
    }
  }

  private tap(x: number, y: number) {
    if (this.menu !== 'target') return;
    const id = this.view.pick(x, y);
    if (id) this.chooseTarget(id);
  }

  // ---------------------------------------------------------------------------
  // execution & playback
  // ---------------------------------------------------------------------------

  private async execute() {
    if (this.busy || !this.driver.resolve) return;
    this.busy = true;
    hideTip();
    this.renderAll();
    const r = this.driver.resolve(this.state, this.plans);
    await this.playback(r.events, r.state);
  }

  private async playback(events: BattleEvent[], next: BattleState) {
    this.busy = true;
    this.menu = 'root';
    this.pending = null;
    this.renderAll();
    try {
      await this.view.play(events, next);
    } catch (err) {
      console.error('playback error', err);
    }
    this.state = next;
    this.disp = JSON.parse(JSON.stringify(next));
    this.view.releaseHolds(next);
    for (const u of next.units) {
      if (u.side === 'enemy' && !this.labels.has(u.id)) this.makeLabel(u);
      const v = this.view.units.get(u.id);
      if (v && u.side === 'enemy') v.robot?.setCharging(!!hasStatus(u, 'charging'));
    }
    if (next.phase === 'ended') {
      this.busy = true;
      this.renderAll();
      await new Promise((r) => setTimeout(r, 900));
      this.done(next);
      return;
    }
    if (this.driver.mode === 'single') this.beginPlanning();
    else {
      this.busy = false;
      this.renderAll();
    }
  }

  // ---------------------------------------------------------------------------
  // co-op hooks (called by the network layer)
  // ---------------------------------------------------------------------------

  serverRoundOpen(state: BattleState, deadline: number, peers: Record<string, { name: string }>) {
    this.enqueue(async () => {
      this.state = state;
      this.disp = JSON.parse(JSON.stringify(state));
      this.deadline = deadline;
      this.peer = {};
      for (const [id, p] of Object.entries(peers)) if (id !== this.driver.owner) this.peer[id] = { name: p.name, locked: false, plans: {} };
      this.beginPlanning();
    });
  }

  serverPeerPlan(owner: string, unitId: string, action: Action | null, locked: boolean) {
    const p = this.peer[owner];
    if (!p) return;
    if (action) p.plans[unitId] = action;
    else delete p.plans[unitId];
    p.locked = locked;
    if (!this.busy) {
      this.renderParty();
      this.renderTimeline();
      if (this.locked || this.menu === 'root') this.renderCmd();
    }
  }

  serverResult(events: BattleEvent[], state: BattleState) {
    this.enqueue(async () => {
      this.deadline = 0;
      this.locked = true;
      await this.playback(events, state);
    });
  }

  private enqueue(fn: () => Promise<void>) {
    this.queue.push(fn);
    if (!this.draining) void this.drain();
  }
  private async drain() {
    this.draining = true;
    while (this.queue.length) await this.queue.shift()!();
    this.draining = false;
  }

  private lockIn() {
    const list = this.controllable();
    if (!list.every((u) => this.plans[u.id])) return;
    this.locked = true;
    for (const u of list) this.driver.sendPlan?.(u.id, this.plans[u.id], true);
    audio.sfx('confirm');
    this.renderCmd();
  }

  private unlock() {
    this.locked = false;
    for (const u of this.controllable()) this.driver.sendPlan?.(u.id, this.plans[u.id] ?? null, false);
    this.renderCmd();
  }

  /** time-out from the server: auto-fill remaining plans */
  autoFillForTimeout() {
    if (this.locked || this.busy) return;
    this.autoPlan();
  }

  // ---------------------------------------------------------------------------
  // per-frame + display patches
  // ---------------------------------------------------------------------------

  update(dt: number) {
    this.view.update(dt);
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const entries = [...this.labels].map(([id, el]) => ({ id, el, p: { ...this.view.screenPos(id, this.pos) } })).sort((a, b) => a.p.x - b.p.x);
    for (const { el, p } of entries) {
      if (!p.visible || el.classList.contains('dead')) {
        el.style.display = el.classList.contains('dead') ? '' : 'none';
        continue;
      }
      el.style.display = '';
      const w = el.offsetWidth || 120;
      const hgt = el.offsetHeight || 50;
      let y = p.y;
      // nudge labels upward so they never overlap (narrow phone screens)
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find((r) => Math.abs(r.x - p.x) < (r.w + w) / 2 && Math.abs(r.y - y) < (r.h + hgt) / 2);
        if (!hit) break;
        y = hit.y - (hit.h + hgt) / 2 - 2;
      }
      placed.push({ x: p.x, y, w, h: hgt });
      el.style.left = `${p.x}px`;
      el.style.top = `${y}px`;
    }
    if (this.timerEl && this.deadline) {
      const left = Math.max(0, this.deadline - Date.now());
      const i = this.timerEl.querySelector('i') as HTMLElement;
      if (i) i.style.width = `${Math.min(100, (left / 30000) * 100)}%`;
    }
  }

  private patchUnit(id: string, p: Partial<{ hp: number; maxHp: number; armor: number; maxArmor: number; energy: number; ult: number; alive: boolean }>) {
    const u = getUnit(this.disp, id);
    if (!u) return;
    if (p.hp !== undefined) u.hp = p.hp;
    if (p.armor !== undefined) u.armor = p.armor;
    if (p.energy !== undefined) u.energy = p.energy;
    if (p.ult !== undefined) u.ult = p.ult;
    if (p.alive !== undefined) u.alive = p.alive;
    else if (p.hp !== undefined && p.hp > 0 && u.side === 'ally') u.alive = true;
    if (u.side === 'enemy') {
      const el = this.labels.get(id);
      if (el) {
        const bars = el.querySelectorAll('.bar');
        setBar(bars[0], u.hp / u.stats.hp);
        bars[0]?.classList.toggle('low', u.hp / u.stats.hp < 0.3);
        if (bars[1]) setBar(bars[1], u.armor / Math.max(1, u.maxArmor));
        el.classList.toggle('dead', !u.alive);
      }
    } else {
      const c = this.cards.get(id);
      if (c) {
        const bars = c.querySelectorAll('.bar');
        setBar(bars[0], u.hp / u.stats.hp);
        bars[0]?.classList.toggle('low', u.hp / u.stats.hp < 0.3);
        setBar(bars[1], u.energy / u.stats.energy);
        setBar(bars[2], u.ult / 100);
        c.classList.toggle('dead', !u.alive);
        const nums = c.querySelector('.nums');
        if (nums) nums.firstElementChild!.textContent = `HP ${u.hp}/${u.stats.hp}`;
      }
    }
  }

  private patchStatus(id: string, st: StatusId, on: boolean, stacks?: number) {
    const u = getUnit(this.disp, id);
    if (!u) return;
    const ex = u.statuses.find((s) => s.id === st);
    if (on) {
      if (ex) ex.stacks = stacks ?? ex.stacks;
      else u.statuses.push({ id: st, turns: 1, stacks: stacks ?? 1 });
    } else u.statuses = u.statuses.filter((s) => s.id !== st);
    if (u.side === 'enemy') this.renderLabel(id);
  }

  private float(id: string, text: string, cls: string, sub?: string) {
    this.view.screenPos(id, this.pos);
    if (!this.pos.visible) return;
    const el = h('div', { class: `dmg ${cls}`, style: `left:${this.pos.x + (Math.random() - 0.5) * 50}px;top:${this.pos.y + 30 + (Math.random() - 0.5) * 20}px` }, text, sub ? h('small', null, sub) : null);
    this.floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  private log(t: string) {
    this.logEl.prepend(h('div', null, t));
    while (this.logEl.childElementCount > 9) this.logEl.lastElementChild?.remove();
  }

  dispose() {
    this.offKey();
    this.offTap();
    this.offHover();
    hideTip();
    this.root.remove();
    this.view.dispose();
  }
}
