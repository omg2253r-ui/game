import type { Appearance, Element, Stats } from '../types';

export type Side = 'ally' | 'enemy';

export type StatusId =
  | 'shock'
  | 'burn'
  | 'chill'
  | 'frozen'
  | 'ionized'
  | 'crushed'
  | 'entangled'
  | 'superconduct'
  | 'broken'
  | 'weakpoint'
  | 'atk_up'
  | 'def_up'
  | 'spd_up'
  | 'spd_down'
  | 'atk_down'
  | 'haste'
  | 'delay'
  | 'shield'
  | 'regen'
  | 'barrier'
  | 'charging'
  | 'hacked'
  | 'meltdown'
  | 'countdown'
  | 'evasion'
  | 'guard';

export interface StatusInst {
  id: StatusId;
  turns: number; // rounds remaining; -1 = permanent until removed
  stacks: number;
  value?: number; // e.g. shield amount, burn damage
  source?: string; // unit id that applied it
  data?: string; // e.g. charging skill id
}

export interface ElementProfile {
  weak: Element[];
  resist: Element[];
  immune: Element[];
}

export interface Unit {
  id: string;
  side: Side;
  name: string;
  /** hunter id or enemy template id */
  templateId: string;
  /** player id that controls this unit (multiplayer); undefined = local / AI */
  ownerId?: string;
  level: number;
  stats: Stats; // max / base stats after equipment
  hp: number;
  energy: number;
  ult: number; // 0..100
  armor: number;
  maxArmor: number;
  element: Element; // basic attack element
  profile: ElementProfile;
  statuses: StatusInst[];
  skills: string[]; // active skill ids
  ultimate?: string;
  passives: string[];
  onField: boolean;
  alive: boolean;
  isBoss?: boolean;
  isElite?: boolean;
  phase: number;
  cooldowns: Record<string, number>;
  scanned: boolean;
  weaponId?: string;
  /** client presentation data for hunters */
  look?: Appearance;
  /** per-round flags */
  flags: Record<string, number>;
  /** extra per-unit counters (meltdown stacks etc.) */
  counters: Record<string, number>;
  slot: number; // formation slot index
  /** turns until AI controls a disconnected player's unit (multiplayer) */
  autoControl?: boolean;
}

export type Action =
  | { type: 'attack'; target: string }
  | { type: 'skill'; skillId: string; target?: string }
  | { type: 'ultimate'; target?: string }
  | { type: 'defend' }
  | { type: 'dodge' }
  | { type: 'item'; itemId: string; target?: string }
  | { type: 'switch'; reserveId: string }
  | { type: 'scan'; target: string }
  | { type: 'combo'; partner: string; target: string }
  | { type: 'team_ultimate' }
  | { type: 'flee' }
  | { type: 'enemy'; skillId: string; target?: string }
  | { type: 'pass' };

export type ActionType = Action['type'];

export interface BattleEvent {
  t: string; // event type
  src?: string;
  dst?: string;
  [k: string]: unknown;
}

export interface BattleConfig {
  seed: number;
  allies: Unit[];
  enemies: Unit[];
  difficulty: number;
  mode: 'single' | 'coop';
  canFlee: boolean;
  /** consumables available per owner id ('local' for single player) */
  bags: Record<string, Record<string, number>>;
  label?: string;
  arena?: string;
}

export interface BattleState {
  id: string;
  round: number;
  phase: 'planning' | 'ended';
  result?: 'victory' | 'defeat' | 'fled';
  units: Unit[];
  teamGauge: number;
  rng: number;
  intents: Record<string, Action>;
  difficulty: number;
  mode: 'single' | 'coop';
  canFlee: boolean;
  bags: Record<string, Record<string, number>>;
  /** tally of consumables used per owner (for save reconciliation) */
  used: Record<string, Record<string, number>>;
  /** enemy kills by template id */
  kills: Record<string, number>;
  /** enemy ids summoned counter for unique ids */
  spawnCounter: number;
  label?: string;
  arena?: string;
  /** chain counters per target this round */
  chain: Record<string, number>;
  stats: { reactions: number; breaks: number; maxChain: number; combos: number; teamUlts: number };
}

export interface RoundResult {
  state: BattleState;
  events: BattleEvent[];
}
