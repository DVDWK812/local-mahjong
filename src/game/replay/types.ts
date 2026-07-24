import type { MatchResult, RoundWind, FullRuleConfig } from '../match/types';
import type { PlayerId, RoundResult, TileId } from '../types';

export const MATCH_LOG_VERSION = 1;

export interface TileSnapshot {
  instanceId: string;
  tileId: TileId;
  red: boolean;
}

export interface BaseGameEvent {
  type: string;
  eventId: string;
  sequence: number;
  roundId: string;
  timestamp?: number;
  actor?: PlayerId;
}

export interface MatchStartedEvent extends BaseGameEvent {
  type: 'match-started';
}

export interface RoundStartedEvent extends BaseGameEvent {
  type: 'round-started';
  roundWind: RoundWind;
  handNumber: number;
  dealer: PlayerId;
  honba: number;
  riichiSticks: number;
}

export interface TilesDealtEvent extends BaseGameEvent {
  type: 'tiles-dealt';
  hands: TileSnapshot[][];
}

export interface TileDrawnEvent extends BaseGameEvent {
  type: 'tile-drawn';
  tile: TileSnapshot;
}

export interface TileDiscardedEvent extends BaseGameEvent {
  type: 'tile-discarded';
  tile: TileSnapshot;
}

export interface RiichiDeclaredEvent extends BaseGameEvent {
  type: 'riichi-declared';
  sticks: number;
}

export interface SimpleCallEvent extends BaseGameEvent {
  type: 'call-window-opened' | 'call-passed' | 'chi-declared' | 'pon-declared' | 'ankan-declared' | 'minkan-declared' | 'kakan-declared' | 'chankan-declared' | 'dora-revealed';
  tiles?: TileSnapshot[];
  from?: PlayerId;
}

export interface WinDeclaredEvent extends BaseGameEvent {
  type: 'tsumo-declared' | 'ron-declared';
  result: RoundResult;
}

export interface DrawEvent extends BaseGameEvent {
  type: 'abortive-draw' | 'exhaustive-draw';
  result: RoundResult;
}

export interface RoundEndedEvent extends BaseGameEvent {
  type: 'round-ended';
  result: RoundResult;
}

export interface MatchEndChoiceEvent extends BaseGameEvent {
  type: 'match-end-choice';
  choice: 'end' | 'continue';
}

export interface MatchEndedEvent extends BaseGameEvent {
  type: 'match-ended';
  result: MatchResult;
}

export type GameEvent =
  | MatchStartedEvent
  | RoundStartedEvent
  | TilesDealtEvent
  | TileDrawnEvent
  | TileDiscardedEvent
  | RiichiDeclaredEvent
  | SimpleCallEvent
  | WinDeclaredEvent
  | DrawEvent
  | RoundEndedEvent
  | MatchEndChoiceEvent
  | MatchEndedEvent;

export interface RoundLog {
  roundId: string;
  roundWind: RoundWind;
  handNumber: number;
  dealer: PlayerId;
  honba: number;
  riichiSticks: number;
  initialHands?: TileSnapshot[][];
  wallOrder?: TileSnapshot[];
  events: GameEvent[];
  result?: RoundResult;
}

export interface MatchLog {
  version: number;
  matchId: string;
  createdAt: string;
  seed?: string;
  playerNames: [string, string, string, string];
  playerTypes: ['human' | 'ai', 'human' | 'ai', 'human' | 'ai', 'human' | 'ai'];
  initialDealer: PlayerId;
  initialScores: [number, number, number, number];
  ruleConfig: FullRuleConfig;
  rounds: RoundLog[];
  finalResult?: MatchResult;
}

export interface ReplayPlayerState {
  score: number;
  hand: TileSnapshot[];
  river: TileSnapshot[];
  calls: TileSnapshot[][];
}

export interface ReplayState {
  matchId: string;
  roundId: string;
  roundWind: RoundWind;
  handNumber: number;
  dealer: PlayerId;
  honba: number;
  riichiSticks: number;
  players: ReplayPlayerState[];
  result?: RoundResult;
  finalResult?: MatchResult;
  appliedEventIds: string[];
  lastEvent?: GameEvent;
}

export interface ReplaySnapshot {
  eventIndex: number;
  state: ReplayState;
}

export interface ReplayController {
  status: 'paused' | 'playing' | 'ended';
  currentEventIndex: number;
  speed: 0.5 | 1 | 2 | 4;
}
