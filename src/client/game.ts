/**
 * Game orchestrator: boot, title & character creator, Hunter City, dungeon runs,
 * single-player battles, co-op raids, HUD and the main loop.
 */
import * as THREE from 'three';
import { Renderer, defaultQuality, isMobile, type Quality } from './render/renderer';
import { Input } from './input/input';
import { Ui } from './ui/ui';
import { h, clear, fmt, bar } from './ui/dom';
import { store } from './state/store';
import { api } from './net/api';
import { coop } from './net/coop';
import { audio } from './audio/audio';
import { CharacterModel } from './render/character';
import { PlayerController } from './world/controller';
import type { Interactable, WorldScene } from './world/common';
import { HunterCity } from './world/city';
import { DungeonScene } from './world/dungeon';
import { Battle } from './battle/battle';
import { generateDungeon, type DungeonLayout, type Encounter, type Room } from '../core/dungeon/generator';
import { DUNGEON_MAP, DUNGEONS } from '../core/data/regions';
import { hunterBuild, hunterStats } from '../core/progression';
import { buildBattle } from '../core/combat/setup';
import { resolveRound } from '../core/combat/engine';
import { Rng, randomSeed } from '../core/rng';
import { chestLoot, generateComponent, makeMaterial, rollDrops, rollRarity, makeConsumable } from '../core/economy/loot';
import { DIFFICULTIES, RARITIES, type Appearance } from '../core/types';
import type { BattleState } from '../core/combat/types';
import type { ItemInstance } from '../core/economy/items';
import { CONSUMABLES } from '../core/data/items';
import { WEAPONS, WEAPON_MAP } from '../core/data/weapons';
import { questProgress } from '../core/save';
import type { ServerMsg } from '../core/net/protocol';
import { itemRow } from './ui/items';
import * as Menus from './ui/menus';

type Mode = 'title' | 'creator' | 'world' | 'battle';

const HAIR_COLORS = ['#2b2f4a', '#e8e1d0', '#ff5fb8', '#5cffb0', '#ffcf4a', '#ff6a2a', '#9a7bff', '#dff6ff', '#1b1b1b', '#7a4a2a'];
const EYE_COLORS = ['#5fd8ff', '#ff4fd8', '#ffc044', '#5fe08a', '#ff4f6b', '#b07bff', '#ffffff'];
const SKINS = ['#ffe6d6', '#ffe0cf', '#f2c9a8', '#e3b08f', '#c98d6a', '#8d5a3c'];
const OUTFIT_COLORS = ['#2b3a78', '#2b1838', '#3a2a1a', '#e8f3ff', '#18303a', '#3a1018', '#1a2a1a', '#2a2a2a'];
const ACCENTS = ['#58d6ff', '#ff4fd8', '#ffc044', '#5cffb0', '#ff4f6b', '#a8f0ff', '#8a6bff'];

export class Game implements Menus.GameApi {
  renderer: Renderer;
  input: Input;
  ui: Ui;
  store = store;
  mode: Mode = 'title';
  world: WorldScene | null = null;
  player: CharacterModel | null = null;
  controller: PlayerController | null = null;
  battle: Battle | null = null;
  layout: DungeonLayout | null = null;
  private clock = new THREE.Clock();
  private minimap: HTMLCanvasElement | null = null;
  private promptEl: HTMLDivElement | null = null;
  private fpsEl: HTMLDivElement | null = null;
  private near: Interactable | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewModel: CharacterModel | null = null;
  private titleOrbit = 0;
  private coopChain: Promise<void> = Promise.resolve();
  private coopRoom: Extract<ServerMsg, { t: 'room' }> | null = null;
  private lobbyRender: (() => void) | null = null;
  private inCoopBattle = false;
  private interactCooldown = 0;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    const q = (store.save?.settings.quality as Quality | undefined) ?? defaultQuality();
    this.renderer = new Renderer(canvas, q);
    this.renderer.onAutoDowngrade = (nq) => {
      this.ui.toast(`Low FPS — graphics set to ${nq.toUpperCase()}`);
      if (store.save) {
        store.s.settings.quality = nq;
        store.persist();
      }
    };
    this.input = new Input(canvas);
    this.ui = new Ui(uiRoot);
    const unlock = () => {
      audio.unlock();
      if (store.save) audio.setVolumes(store.s.settings.music, store.s.settings.sfx);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.input.onKey((e) => this.hotkey(e));
    coop.on((m) => this.onCoop(m));
    coop.onStatus = (s) => {
      if (s === 'reconnecting') this.ui.toast('Connection lost — reconnecting…', 'bad');
      if (s === 'open' && this.inCoopBattle) this.ui.toast('Reconnected', 'good');
    };
    this.setFps(!!store.save?.settings.showFps);
    (window as unknown as { __game: Game }).__game = this;
  }

  async boot() {
    const online = await api.ping();
    if (online && store.save) {
      await api.ensureGuest(store.s.name);
      const r = await store.syncFromServer();
      if (r === 'server') this.ui.toast('Cloud save loaded', 'good');
    }
    document.getElementById('boot')?.classList.add('hide');
    this.showTitle();
    this.loop();
  }

  // ---------------------------------------------------------------------------
  // main loop
  // ---------------------------------------------------------------------------

  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.interactCooldown = Math.max(0, this.interactCooldown - dt);
    if (this.mode === 'battle' && this.battle) {
      this.battle.update(dt);
      this.renderer.scene = this.battle.view.scene;
    } else if (this.mode === 'world' && this.world && this.controller) {
      const allow = !this.ui.panelOpen;
      this.input.enabled = allow;
      this.controller.update(dt, allow);
      this.world.update(dt, this.controller.pos, this.renderer.camera);
      this.renderer.scene = this.world.scene;
      this.updatePrompt();
      if (this.minimap) {
        const g = this.minimap.getContext('2d');
        if (g) this.world.drawMinimap(g, this.minimap.width, this.minimap.height, this.controller.pos, this.controller.yaw);
      }
    } else if (this.mode === 'title' && this.world) {
      this.titleOrbit += dt * 0.08;
      const c = this.renderer.camera;
      c.position.set(Math.sin(this.titleOrbit) * 34, 14, Math.cos(this.titleOrbit) * 34);
      c.lookAt(0, 4, -6);
      this.world.update(dt, new THREE.Vector3(0, 0, 0), c);
      this.renderer.scene = this.world.scene;
    } else if (this.mode === 'creator' && this.previewScene && this.previewModel) {
      this.previewModel.update(dt);
      this.previewModel.root.rotation.y += dt * 0.5;
      const c = this.renderer.camera;
      const wide = window.innerWidth > 760;
      c.position.set(wide ? 1.1 : 0, 1.5, 4.2);
      c.lookAt(wide ? 1.1 : 0, wide ? 1.1 : 1.45, 0);
      this.renderer.scene = this.previewScene;
    }
    this.renderer.render(dt);
    if (this.fpsEl) this.fpsEl.textContent = this.renderer.stats();
  };

  setQuality(q: Quality) {
    this.renderer.setQuality(q);
    if (this.mode === 'world' && this.world) {
      // rebuild the current world so LOD/shadows/fog match the new profile
      if (this.world instanceof HunterCity) void this.enterCity(false);
    }
  }

  setFps(on: boolean) {
    if (on && !this.fpsEl) {
      this.fpsEl = h('div', { class: 'fps' });
      document.body.appendChild(this.fpsEl);
    } else if (!on && this.fpsEl) {
      this.fpsEl.remove();
      this.fpsEl = null;
    }
  }

  private setWorld(w: WorldScene | null) {
    if (this.world && this.world !== w) this.world.dispose();
    this.world = w;
  }

  // ---------------------------------------------------------------------------
  // title & creator
  // ---------------------------------------------------------------------------

  private showTitle() {
    this.mode = 'title';
    this.ui.clearHud();
    this.input.unmountJoystick();
    if (!(this.world instanceof HunterCity)) this.setWorld(new HunterCity(this.renderer.profile, this.cityActions()));
    audio.music('title');
    const t = h('div', { class: 'title-screen' });
    t.append(h('div', { class: 'logo' }, 'SCRAP', h('b', null, 'BOUND')), h('div', { class: 'sub' }, 'Dungeon of Machines'));
    if (store.save) {
      const m = store.main();
      t.append(h('button', { class: 'btn pri', id: 'btn-continue', on: { click: () => { t.remove(); void this.continueGame(); } } }, `▶ Continue — ${store.s.name} Lv${m.level}${store.run ? ' (in dungeon)' : ''}`));
    }
    t.append(h('button', { class: `btn ${store.save ? '' : 'pri'}`, id: 'btn-new', on: { click: async () => { if (store.save && !(await this.ui.confirm('Start over?', 'Creating a new hunter replaces your current save on this device.', 'New game', true))) return; t.remove(); this.showCreator(); } } }, '✦ New Game'));
    t.append(h('div', { class: 'mu', style: 'margin-top:14px' }, api.online ? '🟢 Server online — cloud save & co-op available' : '⚪ Offline mode — single player, saved on this device'));
    t.append(h('div', { class: 'mu' }, isMobile() ? 'Tip: landscape gives the widest battle view' : 'WASD to move · drag to look · E to interact'));
    this.ui.hudLayer.append(t);
  }

  private async continueGame() {
    store.ensureDay();
    if (api.online) {
      await api.ensureGuest(store.s.name);
      const grants = await store.claimGrants();
      for (const g of grants) this.ui.toast(g, 'gold');
    }
    if (store.run) await this.startDungeon(store.run.dungeonId, store.run.difficulty);
    else await this.enterCity();
  }

  private showCreator() {
    this.mode = 'creator';
    this.ui.clearHud();
    const look: Appearance = { hair: 0, hairColor: HAIR_COLORS[0], eyeColor: EYE_COLORS[0], skin: SKINS[1], outfit: 1, outfitColor: OUTFIT_COLORS[0], accentColor: ACCENTS[0], accessory: 0, body: 0 };
    let weapon = 'energy_katana';
    let name = '';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1022');
    scene.add(new THREE.HemisphereLight('#9fb8ff', '#2a1838', 1.6));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.PointLight('#ff4fd8', 6, 8);
    rim.position.set(-2, 2, -2);
    scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.12, 40), new THREE.MeshToonMaterial({ color: '#1c2440' }));
    disc.position.y = -0.06;
    scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: '#4fd8ff', toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
    this.previewScene = scene;
    const rebuild = () => {
      if (this.previewModel) {
        scene.remove(this.previewModel.root);
        this.previewModel.dispose();
      }
      const m = new CharacterModel({ look: { ...look }, weaponId: weapon, scale: 0.85 });
      const rot = this.previewModel?.root.rotation.y ?? 0.4;
      m.root.rotation.y = rot;
      scene.add(m.root);
      this.previewModel = m;
    };
    rebuild();
    const panel = h('div', { class: 'creator' });
    const body = h('div', { class: 'panel-b' });
    panel.append(h('div', { class: 'panel-h' }, h('h2', null, 'Create your Hunter')), body);
    const swatches = (label: string, colors: string[], key: keyof Appearance) => {
      const w = h('div', { class: 'swatches' });
      for (const c of colors) w.append(h('button', { class: `swatch ${look[key] === c ? 'on' : ''}`, style: `background:${c}`, 'aria-label': c, on: { click: () => { (look as unknown as Record<string, unknown>)[key] = c; rebuild(); render(); } } }));
      return h('div', { class: 'field' }, h('label', null, label), w);
    };
    const choice = (label: string, n: number, key: keyof Appearance, names?: string[]) => {
      const w = h('div', { class: 'row' });
      for (let i = 0; i < n; i++) w.append(h('button', { class: `btn sm ${look[key] === i ? 'on' : ''}`, on: { click: () => { (look as unknown as Record<string, unknown>)[key] = i; rebuild(); render(); } } }, names?.[i] ?? String(i + 1)));
      return h('div', { class: 'field' }, h('label', null, label), w);
    };
    const render = () => {
      clear(body);
      const nameIn = h('input', { type: 'text', maxlength: '16', placeholder: 'Hunter name', value: name, id: 'cc-name' }) as HTMLInputElement;
      nameIn.addEventListener('input', () => (name = nameIn.value));
      body.append(h('div', { class: 'field' }, h('label', null, 'Name'), nameIn),
        choice('Hair style', 6, 'hair', ['Spiky', 'Short', 'Long', 'Bob', 'Twin tails', 'Ponytail']), swatches('Hair colour', HAIR_COLORS, 'hairColor'), swatches('Eyes', EYE_COLORS, 'eyeColor'), swatches('Skin', SKINS, 'skin'),
        choice('Outfit', 4, 'outfit', ['Suit', 'Coat', 'Jacket', 'Plate']), swatches('Outfit colour', OUTFIT_COLORS, 'outfitColor'), swatches('Neon accent', ACCENTS, 'accentColor'),
        choice('Accessory', 4, 'accessory', ['None', 'Visor', 'Headphones', 'Antenna ears']), choice('Build', 2, 'body', ['Slim', 'Sturdy']));
      const wl = h('div', { class: 'list' });
      for (const w of WEAPONS) {
        wl.append(h('div', { class: `item ${weapon === w.id ? 'sel' : ''}`, 'data-weapon': w.id, on: { click: () => { weapon = w.id; rebuild(); render(); } } }, h('span', { class: 'ic', style: `color:${w.color}` }, '◆'), h('div', null, h('div', { class: 'nm' }, w.name), h('div', { class: 'sub' }, `${w.element} · ${w.desc}`))));
      }
      body.append(h('div', { class: 'field' }, h('label', null, 'Starting weapon (you can collect all 8 later)'), wl));
      body.append(h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn ghost', on: { click: () => { panel.remove(); this.showTitle(); } } }, 'Back'), h('button', { class: 'btn pri grow', id: 'cc-start', on: { click: () => this.finishCreator(name, look, weapon, panel) } }, 'Begin the hunt ▶')));
    };
    render();
    this.ui.hudLayer.append(panel);
  }

  private async finishCreator(name: string, look: Appearance, weapon: string, panel: HTMLElement) {
    const n = name.trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 16);
    if (n.length < 2) {
      this.ui.toast('Name needs at least 2 characters', 'bad');
      return;
    }
    store.reset();
    store.create(n, look, weapon);
    store.s.settings.quality = this.renderer.quality;
    panel.remove();
    if (this.previewModel) this.previewModel.dispose();
    this.previewModel = null;
    this.previewScene = null;
    if (api.online) {
      await api.ensureGuest(n);
      store.persist(true);
    }
    await this.enterCity();
    this.ui.toast(`Welcome to Hunter City, ${n}!`, 'good');
    setTimeout(() => this.ui.toast('Rin & Vex joined your party. Enter the Dungeon Gate (north) to hunt machines.'), 1500);
  }

  // ---------------------------------------------------------------------------
  // world
  // ---------------------------------------------------------------------------

  private makePlayer(): CharacterModel {
    const m = store.main();
    const wid = store.item(m.weaponUid)?.defId ?? 'energy_katana';
    return new CharacterModel({ look: m.look, weaponId: wid });
  }

  private mountWorld(w: WorldScene, spawn: { x: number; z: number; facing: number }) {
    this.setWorld(w);
    if (this.player) this.player.dispose();
    this.player = this.makePlayer();
    w.scene.add(this.player.root);
    this.controller = new PlayerController(this.player, this.renderer.camera, this.input, w.collision);
    this.controller.sensitivity = store.s.settings.camSensitivity;
    this.controller.onStep = () => audio.sfx('step');
    this.controller.place(spawn.x, spawn.z, spawn.facing);
    this.mode = 'world';
    audio.music(w.music);
    this.buildHud();
  }

  cityActions() {
    return {
      weapon: () => Menus.openWeaponShop(this, false),
      armor: () => Menus.openWeaponShop(this, true),
      workshop: () => Menus.openWorkshop(this),
      market: () => Menus.openMarket(this),
      guild: () => Menus.openGuild(this),
      quests: () => Menus.openQuests(this),
      storage: () => Menus.openStorage(this),
      lobby: () => this.openLobby(),
      gate: () => Menus.openDungeonSelect(this),
      npc: (id?: string) => {
        if (id === 'fountain') {
          store.persist(true);
          this.ui.toast(api.session && api.online ? 'Game saved (cloud sync)' : 'Game saved on this device', 'good');
        }
      },
    };
  }

  async enterCity(fade = true) {
    const go = () => {
      this.ui.clearHud();
      this.ui.closePanel(true);
      const city = new HunterCity(this.renderer.profile, this.cityActions());
      const pos = store.s.position;
      this.mountWorld(city, pos ? { x: pos.x, z: pos.z, facing: Math.PI } : city.spawn);
    };
    if (fade) await this.ui.fade(go);
    else go();
  }

  async startDungeon(id: string, difficulty: number) {
    const def = DUNGEON_MAP[id];
    if (!def) return;
    let run = store.run;
    if (!run || run.dungeonId !== id || run.difficulty !== difficulty) {
      const hp: Record<string, number> = {};
      const energy: Record<string, number> = {};
      for (const hid of store.s.party) {
        const st = hunterStats(store.hunter(hid), store.s.inventory).stats;
        hp[hid] = st.hp;
        energy[hid] = Math.round(st.energy * 0.4);
      }
      run = { dungeonId: id, difficulty, seed: randomSeed(), defeated: [], opened: [], gathered: [], eventsUsed: [], secrets: [], visited: [], pos: { x: 0, z: 0 }, hp, energy, startedAt: Date.now(), bossDefeated: false, lootValue: 0 };
      store.run = run;
      if (store.s.position === undefined && this.controller) store.s.position = { x: this.controller.pos.x, z: this.controller.pos.z };
    }
    if (this.world instanceof HunterCity && this.controller) store.s.position = { x: this.controller.pos.x, z: this.controller.pos.z + 4 };
    store.persist();
    this.layout = generateDungeon(id, difficulty, store.partyLevel(), run.seed, Math.min(3, store.s.party.length));
    if (this.layout.warning) this.ui.toast(this.layout.warning, 'bad');
    await this.ui.fade(() => {
      this.ui.clearHud();
      const d = new DungeonScene(this.layout!, run!, this.renderer.profile, this.dungeonCallbacks());
      this.mountWorld(d, d.spawn);
    });
    this.ui.banner(def.name.toUpperCase(), def.theme.accent, `${def.region} · ${DIFFICULTIES[difficulty]}`);
  }

  private dungeonCallbacks() {
    return {
      onEncounter: (room: Room, idx: number, enc: Encounter) => void this.startBattle(enc, `${room.id}:${idx}`),
      onChest: (room: Room) => this.openChest(room),
      onGather: (room: Room, node: number) => this.gather(room, node),
      onEvent: (room: Room) => this.dungeonEvent(room),
      onSecret: (room: Room) => {
        const run = store.run!;
        run.secrets.push(room.id);
        (this.world as DungeonScene).revealSecret(room.id);
        audio.sfx('chest');
        this.ui.banner('HIDDEN PASSAGE', '#ffd84a', 'The cracked wall crumbles…');
        store.persist();
      },
      onExit: async () => {
        if (!(await this.ui.confirm('Leave the dungeon?', 'Returning to Hunter City ends this run. Loot you collected is kept.', 'Return to city'))) return;
        await this.endRun(false);
      },
    };
  }

  private async endRun(cleared: boolean) {
    store.run = null;
    store.advanceDay();
    store.persist(true);
    await this.enterCity();
    if (cleared) this.ui.toast('Dungeon cleared! New orders and quests are available (Day ' + store.s.day + ')', 'gold');
    else this.ui.toast(`A new day begins (Day ${store.s.day}). Your party has recovered.`);
  }

  private openChest(room: Room) {
    const run = store.run!;
    const def = DUNGEON_MAP[run.dungeonId];
    const rng = new Rng(run.seed ^ (room.id * 7919));
    const loot = chestLoot(rng, def.tier, run.difficulty, room.type === 'hidden');
    run.opened.push(room.id);
    store.s.stats.chestsOpened++;
    store.applyRewards(loot, {});
    (this.world as DungeonScene).openChestVisual(room.id);
    audio.sfx('chest');
    this.lootPanel(room.type === 'hidden' ? 'Ancient Cache' : 'Supply Crate', loot.items, loot.credits, 0, []);
    store.persist();
  }

  private gather(room: Room, node: number) {
    const run = store.run!;
    const key = `${room.id}:${node}`;
    const rng = new Rng(run.seed ^ (room.id * 131 + node));
    const def = DUNGEON_MAP[run.dungeonId];
    const items: ItemInstance[] = [makeMaterial('scrap_metal', rng.int(2, 4)), makeMaterial('copper_wire', rng.int(1, 3))];
    if (rng.chance(0.45)) items.push(generateComponent(rng.pick(['hdd', 'cooling_fan', 'ram', 'power_supply'] as const), rollRarity(rng, def.tier * 0.3), rng, def.tier));
    run.gathered.push(key);
    store.applyRewards({ credits: 0, exp: 0, items }, {});
    (this.world as DungeonScene).hideNode(key);
    audio.sfx('coin');
    this.ui.toast(`Salvaged: ${items.map((i) => (i.kind === 'material' ? `${i.qty}× ${i.defId.replace('_', ' ')}` : i.name)).join(', ')}`, 'good');
    store.persist();
  }

  private dungeonEvent(room: Room) {
    const run = store.run!;
    const ui = this.ui;
    const done = () => {
      run.eventsUsed.push(room.id);
      store.persist();
    };
    if (room.event === 'shrine') {
      for (const id of store.s.party) run.hp[id] = hunterStats(store.hunter(id), store.s.inventory).stats.hp;
      done();
      audio.sfx('heal');
      ui.banner('PARTY RESTORED', '#5fe08a', 'The ancient core hums warmly');
      this.refreshHud();
    } else if (room.event === 'terminal') {
      const p = ui.panel('Data Terminal', { narrow: true });
      p.body.append(h('p', null, 'The terminal still has root access. Choose one hack:'),
        h('div', { class: 'col' },
          h('button', { class: 'btn pri', on: { click: () => { run.buff = 'overclock'; done(); ui.closePanel(true); ui.toast('Next battle: party starts with +40 Energy and 40 Team Gauge', 'good'); } } }, '⚡ Overclock the party (next battle buff)'),
          h('button', { class: 'btn', on: { click: () => { run.visited = this.layout!.rooms.filter((r) => r.type !== 'hidden').map((r) => r.id); done(); ui.closePanel(true); ui.toast('Map downloaded', 'good'); } } }, '🗺 Download the dungeon map'),
          h('button', { class: 'btn gold', on: { click: () => { const rng = new Rng(run.seed + room.id); const c = Math.round(rng.int(80, 160) * (1 + DUNGEON_MAP[run.dungeonId].tier)); store.s.credits += c; done(); ui.closePanel(true); ui.toast(`Transferred ${c} credits`, 'gold'); audio.sfx('coin'); } } }, '💰 Siphon credits')));
    } else if (room.event === 'merchant') {
      const p = ui.panel('Merchant Drone', { narrow: true });
      const render = () => {
        clear(p.body);
        p.body.append(h('p', { class: 'mu' }, `"Dungeon prices, hunter! +25%." · 💰 ${fmt(store.s.credits)}`));
        for (const c of CONSUMABLES) {
          const price = Math.round(c.price * 1.25);
          p.body.append(h('div', { class: 'item' }, h('span', { class: 'ic' }, c.icon), h('div', { style: 'flex:1' }, h('div', { class: 'nm' }, c.name), h('div', { class: 'sub' }, c.desc)), h('button', { class: 'btn sm pri', disabled: store.s.credits < price, on: { click: () => { if (store.spend(price)) { store.applyRewards({ credits: 0, exp: 0, items: [makeConsumable(c.id, 1)] }, {}); audio.sfx('coin'); store.persist(); render(); } } } }, `${price}cr`)));
        }
      };
      render();
    } else if (room.event === 'trap') {
      const rng = new Rng(run.seed ^ room.id);
      done();
      if (rng.chance(0.6)) {
        ui.toast('Trap disarmed! Salvaged its capacitor.', 'good');
        store.applyRewards({ credits: 0, exp: 30, items: [generateComponent('power_supply', rollRarity(rng, 1), rng, DUNGEON_MAP[run.dungeonId].tier)] }, {});
      } else {
        for (const id of store.s.party) run.hp[id] = Math.max(1, Math.round(run.hp[id] * 0.82));
        audio.sfx('electric');
        ui.banner('EMP TRAP!', '#ff4f6b', 'The party takes damage');
      }
      this.refreshHud();
    }
  }

  // ---------------------------------------------------------------------------
  // single player battle
  // ---------------------------------------------------------------------------

  private async startBattle(enc: Encounter, key: string) {
    if (this.mode === 'battle') return;
    const run = store.run!;
    const def = DUNGEON_MAP[run.dungeonId];
    const s = store.s;
    const hunters = s.party.map((id) => hunterBuild(store.hunter(id), s.inventory));
    const state = buildBattle({ seed: randomSeed(), hunters, enc, difficulty: run.difficulty, mode: 'single', bags: { local: store.bag() }, carry: { hp: run.hp, energy: run.energy }, arena: def.id, label: def.name });
    if (run.buff === 'overclock') {
      for (const u of state.units) if (u.side === 'ally') u.energy = Math.min(u.stats.energy, u.energy + 40);
      state.teamGauge = 40;
      run.buff = undefined;
    }
    audio.sfx('encounter');
    this.ui.flash();
    this.mode = 'battle';
    this.input.unmountJoystick();
    await this.ui.fade(() => {
      this.ui.clearHud();
      this.ui.closePanel(true);
      this.battle = new Battle(state, this.renderer.camera, def.theme, this.renderer.profile, { mode: 'single', resolve: (st, plans) => resolveRound(st, plans) }, this.input, this.ui, { speed: s.settings.autoBattleSpeed });
    });
    if (enc.boss) this.ui.banner(state.units.find((u) => u.isBoss)?.name.toUpperCase() ?? 'BOSS', '#ff3a6b', 'BOSS BATTLE');
    const final = await this.battle!.finished;
    await this.afterBattle(final, enc, key);
  }

  private async afterBattle(st: BattleState, enc: Encounter, key: string) {
    const run = store.run!;
    const s = store.s;
    const def = DUNGEON_MAP[run.dungeonId];
    store.consumeUsed(st.used.local ?? {});
    s.stats.battles++;
    s.stats.reactions += st.stats.reactions;
    s.stats.breaks += st.stats.breaks;
    s.stats.maxChain = Math.max(s.stats.maxChain, st.stats.maxChain);
    for (const u of st.units) {
      if (u.side !== 'ally') continue;
      run.hp[u.templateId] = u.alive ? u.hp : 0;
      run.energy[u.templateId] = u.energy;
    }
    const finish = async () => {
      this.battle?.dispose();
      this.battle = null;
      const d = this.world as DungeonScene;
      this.mode = 'world';
      this.renderer.scene = d.scene;
      this.buildHud();
      audio.music('dungeon');
    };
    if (st.result === 'victory') {
      s.stats.wins++;
      const rng = new Rng(randomSeed());
      const items: ItemInstance[] = [];
      let credits = 0, exp = 0;
      for (const u of st.units) {
        if (u.side !== 'enemy' || u.alive) continue;
        const r = rollDrops(u.templateId, u.level, run.difficulty, rng, def.tier, u.isElite);
        items.push(...r.items);
        credits += r.credits;
        exp += r.exp;
      }
      // downed hunters revive with 1 HP after victory
      for (const id of s.party) if (run.hp[id] <= 0) run.hp[id] = 1;
      const res = store.applyRewards({ credits, exp, items }, st.kills);
      run.defeated.push(key);
      run.lootValue += credits;
      const boss = enc.boss;
      if (boss) {
        s.stats.bossKills++;
        s.cleared[run.dungeonId] = Math.max(s.cleared[run.dungeonId] ?? -1, run.difficulty);
        questProgress(s, 'clear', run.dungeonId);
        run.bossDefeated = true;
      }
      store.persist(true);
      audio.music('victory');
      await this.ui.fade(finish);
      (this.world as DungeonScene).removeSymbol(key);
      (this.world as DungeonScene).setGrace(2);
      if (res.levels.length) audio.sfx('levelup');
      await this.lootPanel(boss ? `${def.name} CLEARED!` : 'Victory!', items, credits, exp, res.levels, { reactions: st.stats.reactions, breaks: st.stats.breaks, chain: st.stats.maxChain, rounds: st.round });
      if (boss) {
        const next = DUNGEONS.find((d) => d.unlock === run.dungeonId);
        if (next && run.difficulty === 0) this.ui.toast(`New region unlocked: ${next.name}!`, 'gold');
        await this.endRun(true);
      }
    } else if (st.result === 'fled') {
      await this.ui.fade(finish);
      (this.world as DungeonScene).setGrace(3);
      this.ui.toast('Escaped!', '');
    } else {
      const lost = Math.round(s.credits * 0.1);
      s.credits -= lost;
      store.run = null;
      store.persist(true);
      await this.ui.fade(async () => {
        this.battle?.dispose();
        this.battle = null;
      });
      const p = this.ui.panel('Defeated…', { narrow: true });
      p.body.append(h('p', null, `Your party was overwhelmed. A guild drone carried you back to Hunter City. Lost ${lost} credits for repairs.`), h('p', { class: 'mu' }, 'Tips: Scan enemies to find weaknesses, Defend against ⚠ telegraphed attacks, break armor to interrupt charges, and upgrade weapons at the Weapon Shop.'),
        h('button', { class: 'btn pri', style: 'width:100%', on: { click: () => this.ui.closePanel() } }, 'Return to city'));
      await new Promise<void>((r) => (this.ui.onPanelClose = () => { this.ui.onPanelClose = undefined; r(); }));
      store.advanceDay();
      await this.enterCity();
    }
  }

  private lootPanel(title: string, items: ItemInstance[], credits: number, exp: number, levels: { name: string; level: number }[], stats?: { reactions: number; breaks: number; chain: number; rounds: number }): Promise<void> {
    return new Promise((res) => {
      const p = this.ui.panel(title, { narrow: true, className: 'result', onClose: () => res() });
      p.body.append(h('div', { class: 'row', style: 'font-size:16px;margin-bottom:8px' }, credits ? h('b', { class: 'hud-money' }, `+${fmt(credits)} credits`) : null, exp ? h('b', { style: 'color:#4fd8ff' }, `+${fmt(exp)} EXP`) : null));
      if (stats) p.body.append(h('div', { class: 'mu', style: 'margin-bottom:8px' }, `Rounds ${stats.rounds} · Reactions ${stats.reactions} · Breaks ${stats.breaks} · Best chain ×${stats.chain}`));
      for (const l of levels) p.body.append(h('div', { class: 'toast good', style: 'animation:none;margin-bottom:6px' }, `⬆ ${l.name} reached Lv ${l.level}! (+1 skill point)`));
      const grid = h('div', { class: 'loot' });
      for (const it of items) grid.append(itemRow(it));
      if (!items.length) grid.append(h('div', { class: 'mu' }, 'No items'));
      p.body.append(grid, h('button', { class: 'btn pri', style: 'width:100%;margin-top:10px', id: 'loot-ok', on: { click: () => this.ui.closePanel() } }, 'Continue'));
    });
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private buildHud() {
    this.ui.clearHud();
    const s = store.s;
    const m = store.main();
    const top = h('div', { class: 'hud-top' });
    const isDungeon = this.world instanceof DungeonScene;
    const who = h('div', { class: 'hud-card hud-who' }, h('b', null, s.name), ` Lv${m.level} `, h('span', { class: 'hud-money' }, `💰 ${fmt(s.credits)}`), h('div', { class: 'hud-area' }, `${this.world?.name ?? ''}${isDungeon ? ` · ${DIFFICULTIES[store.run?.difficulty ?? 0]}` : ` · Day ${s.day}`}${api.session && api.online ? ' · ☁' : ''}`));
    top.append(who);
    if (isDungeon && store.run) {
      const party = h('div', { class: 'hud-card', style: 'min-width:120px' });
      for (const id of s.party.slice(0, 4)) {
        const hu = store.hunter(id);
        const max = hunterStats(hu, s.inventory).stats.hp;
        const hp = store.run.hp[id] ?? max;
        party.append(h('div', { style: 'font-size:11px' }, `${hu.name} ${hp}/${max}`), bar(`hp ${hp / max < 0.3 ? 'low' : ''}`, hp / max));
      }
      top.append(party);
    }
    const menu = h('div', { class: 'hud-menu' },
      h('button', { class: 'btn', title: 'Inventory (I)', on: { click: () => Menus.openInventory(this, 'items') } }, '🎒', h('span', { class: 'lbl' }, ' Bag')),
      h('button', { class: 'btn', title: 'Hunters & Skills (K)', on: { click: () => Menus.openInventory(this, 'hunters') } }, '🧑‍🚀', h('span', { class: 'lbl' }, ' Hunters')),
      h('button', { class: 'btn', title: 'Quests (J)', on: { click: () => Menus.openQuests(this) } }, '📜', h('span', { class: 'lbl' }, ' Quests')),
      h('button', { class: 'btn', title: 'Settings (M)', on: { click: () => Menus.openSettings(this) } }, '⚙'));
    top.append(menu);
    this.ui.hudLayer.append(top);
    this.minimap = h('canvas', { class: 'minimap', width: 150, height: 150 }) as HTMLCanvasElement;
    this.ui.hudLayer.append(this.minimap);
    this.promptEl = h('div', { class: 'prompt', style: 'display:none' });
    this.ui.hudLayer.append(this.promptEl);
    if (this.input.touch) {
      this.input.mountJoystick(this.ui.hudLayer);
      this.ui.hudLayer.append(h('div', { class: 'mob-actions' }, h('button', { class: 'btn round-btn big pri', id: 'mob-interact', 'aria-label': 'Interact', on: { click: () => this.interact() } }, '✋')));
    } else {
      this.ui.hudLayer.append(h('div', { class: 'hint' }, 'WASD move · Shift run · drag to look · E interact · I bag · K hunters · J quests'));
    }
  }

  refreshHud() {
    if (this.mode === 'world') this.buildHud();
  }

  private updatePrompt() {
    if (!this.world || !this.controller || !this.promptEl) return;
    const p = this.controller.pos;
    let best: Interactable | null = null;
    let bd = Infinity;
    for (const it of this.world.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z);
      if (d < it.radius && d < bd) {
        bd = d;
        best = it;
      }
    }
    if (best !== this.near) {
      this.near = best;
      clear(this.promptEl);
      if (best && !this.ui.panelOpen) {
        this.promptEl.style.display = '';
        this.promptEl.append(h('span', null, best.icon), h('span', null, best.label), h('button', { class: 'btn sm pri', id: 'prompt-go', on: { click: () => this.interact() } }, this.input.touch ? 'Tap' : 'E'));
      } else this.promptEl.style.display = 'none';
    }
    if (this.ui.panelOpen && this.promptEl.style.display !== 'none') {
      this.promptEl.style.display = 'none';
      this.near = null;
    }
  }

  private interact() {
    if (!this.near || this.ui.panelOpen || this.interactCooldown > 0) return;
    this.interactCooldown = 0.4;
    audio.sfx('click');
    const n = this.near;
    this.near = null;
    n.action();
  }

  private hotkey(e: KeyboardEvent) {
    if (this.mode !== 'world') return;
    if (this.ui.panelOpen) return;
    switch (e.code) {
      case 'KeyE':
      case 'Enter':
        this.interact();
        break;
      case 'KeyI':
        Menus.openInventory(this, 'items');
        break;
      case 'KeyK':
        Menus.openInventory(this, 'skills');
        break;
      case 'KeyC':
        if (e.shiftKey) Menus.openInventory(this, 'hunters');
        break;
      case 'KeyJ':
        Menus.openQuests(this);
        break;
      case 'KeyM':
        Menus.openSettings(this);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // co-op
  // ---------------------------------------------------------------------------

  openLobby() {
    const ui = this.ui;
    if (!api.online) {
      ui.toast('Co-op needs the game server (offline mode)', 'bad');
      return;
    }
    const p = ui.panel('Co-op Raid Lobby', { narrow: true, onClose: () => { this.lobbyRender = null; this.refreshHud(); } });
    let config = { dungeonId: 'data_center', difficulty: 0 };
    const render = () => {
      clear(p.body);
      const room = this.coopRoom;
      if (!coop.code || !room) {
        const code = h('input', { type: 'text', placeholder: 'ROOM CODE', maxlength: '5', id: 'room-code', style: 'text-transform:uppercase;letter-spacing:.3em;text-align:center' }) as HTMLInputElement;
        p.body.append(h('p', { class: 'mu' }, 'Team up with 2–4 hunters. Each player controls their own main hunter; the server resolves every round so everyone sees the same result. Raids are 3 waves ending with the region boss.'),
          h('button', { class: 'btn pri', style: 'width:100%', id: 'room-create', on: { click: async () => { try { await this.prepCoop(); const r = await api.createRoom(); coop.connect(r.code); ui.toast(`Room ${r.code} created`, 'good'); } catch (e) { ui.toast((e as Error).message, 'bad'); } } } }, '✦ Create room'),
          h('div', { class: 'field', style: 'margin-top:12px' }, h('label', null, 'Join with a code'), code),
          h('button', { class: 'btn', style: 'width:100%', id: 'room-join', on: { click: async () => { const c = code.value.trim().toUpperCase(); if (!/^[A-Z0-9]{5}$/.test(c)) { ui.toast('Enter a 5-character code', 'bad'); return; } await this.prepCoop(); coop.connect(c); } } }, 'Join room'),
          h('div', { class: 'mu', style: 'margin-top:8px' }, `Status: ${coop.status}`));
        return;
      }
      const me = room.you;
      const host = room.hostId === me;
      p.body.append(h('div', { style: 'text-align:center;margin-bottom:10px' }, h('div', { class: 'mu' }, 'ROOM CODE'), h('div', { id: 'room-code-show', style: 'font-size:36px;font-weight:900;letter-spacing:.3em;color:#4fd8ff' }, room.code)));
      const list = h('div', { class: 'list' });
      for (const m of room.members) list.append(h('div', { class: `item ${m.ready ? 'sel' : ''}` }, h('span', { class: 'ic' }, m.connected ? (m.ready ? '✔' : '…') : '⚠'), h('div', { style: 'flex:1' }, h('div', { class: 'nm' }, `${m.name}${m.id === room.hostId ? ' 👑' : ''}${m.id === me ? ' (you)' : ''}`), h('div', { class: 'sub' }, `Lv${m.level} · ${WEAPON_MAP[m.weapon]?.name ?? m.weapon}${m.connected ? '' : ' · disconnected (AI controls)'}`))));
      p.body.append(list);
      config = room.config;
      const cfg = h('div', { class: 'card', style: 'margin-top:10px' }, h('h3', null, `Raid: ${DUNGEON_MAP[config.dungeonId]?.name} · ${DIFFICULTIES[config.difficulty]}`));
      if (host) {
        const sel = h('select', { id: 'raid-dungeon' }, ...DUNGEONS.map((d) => h('option', { value: d.id, selected: d.id === config.dungeonId }, d.name))) as HTMLSelectElement;
        const dif = h('select', { id: 'raid-diff' }, ...DIFFICULTIES.map((d, i) => h('option', { value: String(i), selected: i === config.difficulty }, d))) as HTMLSelectElement;
        const send = () => coop.send({ t: 'config', dungeonId: sel.value, difficulty: Number(dif.value) });
        sel.onchange = send;
        dif.onchange = send;
        cfg.append(h('div', { class: 'field' }, sel), h('div', { class: 'field' }, dif));
      }
      p.body.append(cfg);
      const mine = room.members.find((m) => m.id === me);
      p.body.append(h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: `btn grow ${mine?.ready ? 'on' : 'pri'}`, id: 'room-ready', on: { click: () => coop.send({ t: 'ready', ready: !mine?.ready }) } }, mine?.ready ? '✔ Ready (tap to cancel)' : 'Ready'),
        host ? h('button', { class: 'btn gold grow', id: 'room-start', disabled: !room.members.every((m) => m.ready || !m.connected) || room.members.filter((m) => m.connected).length < 1, on: { click: () => coop.send({ t: 'start' }) } }, '▶ Start raid') : null,
        h('button', { class: 'btn ghost', on: { click: () => { coop.leave(); this.coopRoom = null; render(); } } }, 'Leave')));
      p.body.append(h('div', { class: 'mu', style: 'margin-top:6px' }, host ? 'You are the host. Start when everyone is ready (solo start allowed for testing).' : 'Waiting for the host to start…'));
    };
    this.lobbyRender = render;
    render();
  }

  private async prepCoop() {
    if (!api.session) await api.ensureGuest(store.s.name);
    if (!api.session) throw new Error('Could not create a session');
    await api.putSave(store.s);
  }

  private onCoop(m: ServerMsg) {
    switch (m.t) {
      case 'room':
        this.coopRoom = m;
        this.lobbyRender?.();
        return;
      case 'error':
        this.ui.toast(m.msg, 'bad');
        return;
      case 'member':
        if (this.inCoopBattle) this.ui.toast(`${m.name} ${m.connected ? 'reconnected' : 'disconnected — AI takes over'}`, m.connected ? 'good' : 'bad');
        return;
      case 'chat':
        this.ui.toast(`${m.from}: ${m.text}`);
        return;
      case 'pong':
        return;
    }
    this.coopChain = this.coopChain.then(() => this.coopBattleMsg(m)).catch((e) => console.error(e));
  }

  private async coopBattleMsg(m: ServerMsg) {
    switch (m.t) {
      case 'battle_start': {
        if (this.battle && this.battle.state.id === m.state.id) {
          this.battle.serverRoundOpen(m.state, m.deadline, m.peers);
          return;
        }
        if (this.battle) {
          await this.battle.finished;
          await this.ui.fade(() => {
            this.battle?.dispose();
            this.battle = null;
          });
        }
        this.inCoopBattle = true;
        this.ui.closePanel(true);
        this.lobbyRender = null;
        const def = DUNGEON_MAP[this.coopRoom?.config.dungeonId ?? 'data_center'];
        this.mode = 'battle';
        this.input.unmountJoystick();
        await this.ui.fade(() => {
          this.ui.clearHud();
          this.battle = new Battle(m.state, this.renderer.camera, def.theme, this.renderer.profile, {
            mode: 'coop', owner: this.coopRoom?.you,
            sendPlan: (unitId, action, locked) => coop.send({ t: 'plan', round: this.battle?.state.round ?? 0, unitId, action, locked }),
          }, this.input, this.ui);
        });
        this.ui.banner(`WAVE ${m.wave + 1}/${m.waves}`, def.theme.accent, def.name);
        this.battle!.serverRoundOpen(m.state, m.deadline, m.peers);
        return;
      }
      case 'round_open':
        this.battle?.serverRoundOpen(m.state, m.deadline, m.peers);
        for (const [unitId, p] of Object.entries(m.plans)) this.battle?.serverPeerPlan(p.owner, unitId, p.action, p.locked);
        return;
      case 'plan':
        this.battle?.serverPeerPlan(m.owner, m.unitId, m.action, m.locked);
        return;
      case 'round_result':
        this.battle?.serverResult(m.events, m.state);
        return;
      case 'wave_clear':
        if (this.battle) await this.battle.finished;
        this.ui.banner('WAVE CLEAR', '#5fe08a', `${m.wave + 1}/${m.waves}`);
        await new Promise((r) => setTimeout(r, 900));
        return;
      case 'raid_end': {
        if (this.battle) await this.battle.finished;
        await this.ui.fade(() => {
          this.battle?.dispose();
          this.battle = null;
        });
        this.inCoopBattle = false;
        const grants = await store.claimGrants();
        const p = this.ui.panel(m.result === 'victory' ? 'RAID CLEARED!' : 'Raid failed', { narrow: true });
        p.body.append(h('p', null, m.result === 'victory' ? 'The server verified the result and granted shared rewards to every member:' : 'The party fell. Everyone returns to Hunter City.'));
        if (m.rewards) p.body.append(h('div', { class: 'row' }, h('b', { class: 'hud-money' }, `+${m.rewards.credits} credits`), h('b', { style: 'color:#4fd8ff' }, `+${m.rewards.exp} EXP`), h('span', null, `${m.rewards.items} items`)));
        for (const g of grants) p.body.append(h('div', { class: 'mu' }, '✔ ' + g));
        p.body.append(h('button', { class: 'btn pri', style: 'width:100%;margin-top:10px', on: { click: () => this.ui.closePanel() } }, 'Return to Hunter City'));
        await new Promise<void>((r) => (this.ui.onPanelClose = () => { this.ui.onPanelClose = undefined; r(); }));
        coop.leave();
        this.coopRoom = null;
        await this.enterCity();
        return;
      }
    }
  }
}

export { RARITIES };
