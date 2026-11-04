/** Co-op wire protocol shared by the client and the Durable Object. */
import type { Action, BattleEvent, BattleState } from '../combat/types';

export interface MemberInfo {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  level: number;
  weapon: string;
}

export interface RaidConfig {
  dungeonId: string;
  difficulty: number;
}

export interface RaidRewards {
  credits: number;
  exp: number;
  items: number;
  grantId: string;
}

export type ClientMsg =
  | { t: 'ready'; ready: boolean }
  | { t: 'config'; dungeonId: string; difficulty: number }
  | { t: 'start' }
  | { t: 'plan'; round: number; unitId: string; action: Action | null; locked: boolean }
  | { t: 'chat'; text: string }
  | { t: 'leave' }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'room'; code: string; hostId: string; you: string; members: MemberInfo[]; config: RaidConfig; phase: 'lobby' | 'battle' | 'done' }
  | { t: 'battle_start'; wave: number; waves: number; state: BattleState; deadline: number; peers: Record<string, { name: string }> }
  | { t: 'round_open'; state: BattleState; deadline: number; peers: Record<string, { name: string }>; plans: Record<string, { owner: string; action: Action | null; locked: boolean }> }
  | { t: 'plan'; owner: string; unitId: string; action: Action | null; locked: boolean }
  | { t: 'round_result'; round: number; events: BattleEvent[]; state: BattleState }
  | { t: 'wave_clear'; wave: number; waves: number }
  | { t: 'raid_end'; result: 'victory' | 'defeat'; rewards: RaidRewards | null }
  | { t: 'member'; id: string; connected: boolean; name: string }
  | { t: 'chat'; from: string; text: string }
  | { t: 'error'; msg: string }
  | { t: 'pong' };

export const TURN_TIMER_MS = 30_000;
export const MAX_PLAYERS = 4;
export const ROOM_CODE_RE = /^[A-Z0-9]{5}$/;
