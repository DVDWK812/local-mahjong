import type { GameState } from '../types';
import type { FullRuleConfig, MatchState } from '../match/types';
import type { MatchLog } from '../replay/types';
import { CURRENT_FORMAT_VERSION } from '../versionPolicy';

export const CURRENT_SAVE_VERSION = CURRENT_FORMAT_VERSION;
export const CURRENT_REPLAY_RECORD_VERSION = CURRENT_FORMAT_VERSION;
export const CURRENT_MATCH_SAVE_KEY = 'local-mahjong.current-match.v1';
export const REPLAY_LIBRARY_KEY = 'local-mahjong.replays.v1';
export const REPLAY_INDEX_KEY = 'local-mahjong.replay-index.v1';
export const REPLAY_RECORD_KEY_PREFIX = 'local-mahjong.replay.v1.';

export type ReplaySource = 'local-match' | 'test-mode';

export type SerializableMatchState = MatchState;
export type SerializableGameState = GameState;

export interface SavedMatch {
  version: number;
  saveId: string;
  savedAt: string;
  matchState: SerializableMatchState;
  gameState?: SerializableGameState;
  matchLog: MatchLog;
  ruleConfig: FullRuleConfig;
}

export interface ReplayMetadata {
  id: string;
  matchId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  playerNames: [string, string, string, string];
  scores: [number, number, number, number];
  matchType: 'four-east' | 'four-south' | 'single';
  roundCount: number;
  source: ReplaySource;
  status: 'completed' | 'incomplete' | 'corrupted';
  error?: string;
}

export interface ReplayRecord extends Omit<ReplayMetadata, 'status' | 'error'> {
  version: number;
  status: 'completed' | 'incomplete';
  log: MatchLog;
}

export interface StorageAdapter {
  saveCurrentMatch(save: SavedMatch): Promise<void>;
  loadCurrentMatch(): Promise<SavedMatch | null>;
  deleteCurrentMatch(): Promise<void>;
  saveReplay(record: ReplayRecord | MatchLog): Promise<void>;
  listReplays(): Promise<ReplayMetadata[]>;
  getReplay(id: string): Promise<ReplayRecord | null>;
  loadReplay(id: string): Promise<MatchLog | null>;
  renameReplay(id: string, title: string): Promise<void>;
  deleteReplay(id: string): Promise<void>;
  exportReplay(id: string): Promise<string>;
}
