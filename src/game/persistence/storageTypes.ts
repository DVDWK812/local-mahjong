import type { GameState } from '../types';
import type { FullRuleConfig, MatchState } from '../match/types';
import type { MatchLog } from '../replay/types';

export const CURRENT_SAVE_VERSION = 1;
export const CURRENT_MATCH_SAVE_KEY = 'local-mahjong.current-match.v1';
export const REPLAY_LIBRARY_KEY = 'local-mahjong.replays.v1';

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
  matchId: string;
  createdAt: string;
  playerNames: [string, string, string, string];
  finalScoreSummary?: string;
}

export interface StorageAdapter {
  saveCurrentMatch(save: SavedMatch): Promise<void>;
  loadCurrentMatch(): Promise<SavedMatch | null>;
  deleteCurrentMatch(): Promise<void>;
  saveReplay(log: MatchLog): Promise<void>;
  listReplays(): Promise<ReplayMetadata[]>;
  loadReplay(id: string): Promise<MatchLog | null>;
  deleteReplay(id: string): Promise<void>;
}
