import type { GameState, PlayerId, RoundResult, Wind } from '../types';
import type { RuleConfig } from '../score/rules/RuleConfig';

export type MatchLength = 'east-only' | 'hanchan';
export type RoundWind = Wind;
export type MatchPhase = 'not-started' | 'round-active' | 'round-result' | 'match-end-choice' | 'match-ended';
export type LeftoverRiichiStickMode = 'first-place' | 'initial-dealer' | 'discard';
export type MaxExtraRoundWind = 'south' | 'west' | 'north' | 'none';
export type EndChoiceMode = 'automatic' | 'player-choice';

export interface MatchRuleConfig {
  matchLength: MatchLength;
  roundCount: 1 | 2 | 3 | 4;
  startingPoints: number;
  targetPoints: number;
  returnPoints: number;
  bankruptcyEndsMatch: boolean;
  bankruptcyThreshold: number;
  dealerContinuationOnWin: boolean;
  dealerContinuationOnTenpaiDraw: boolean;
  agariYame: boolean;
  tenpaiYame: boolean;
  agariYameMode: EndChoiceMode;
  tenpaiYameMode: EndChoiceMode;
  allowWestRound: boolean;
  maxExtraRoundWind: MaxExtraRoundWind;
  suddenDeathTarget: number;
  carryRiichiSticksToNextRound: boolean;
  leftoverRiichiStickMode: LeftoverRiichiStickMode;
  useUma: boolean;
  uma: [number, number, number, number];
  useOka: boolean;
}

export interface FullRuleConfig {
  round: RuleConfig;
  match: MatchRuleConfig;
}

export interface PendingMatchEndChoice {
  type: 'agari-yame' | 'tenpai-yame';
  dealer: PlayerId;
  canEnd: boolean;
  canContinue: boolean;
  projectedNextRound?: {
    roundWind: RoundWind;
    handNumber: 1 | 2 | 3 | 4;
    honba: number;
  };
  sourceRoundId: string;
}

export interface MatchState {
  matchLength: MatchLength;
  phase: MatchPhase;
  scores: [number, number, number, number];
  dealer: PlayerId;
  roundWind: RoundWind;
  handNumber: 1 | 2 | 3 | 4;
  honba: number;
  riichiSticks: number;
  initialDealer: PlayerId;
  completedHands: number;
  ruleConfig: MatchRuleConfig;
  currentGame?: GameState;
  lastRoundResult?: RoundResult;
  finalResult?: MatchResult;
  pendingEndChoice?: PendingMatchEndChoice;
  appliedRoundIds: string[];
  scoreHistory: ScoreHistoryEntry[];
}

export interface ScoreHistoryEntry {
  roundLabel: string;
  scores: [number, number, number, number];
  honba: number;
  riichiSticks: number;
}

export interface FinalPlayerResult {
  player: PlayerId;
  rawScore: number;
  rank: 1 | 2 | 3 | 4;
  rankTieBreakOrder: number;
  convertedScore?: number;
  umaAdjustment?: number;
  okaAdjustment?: number;
  finalMatchScore?: number;
}

export interface MatchResult {
  players: FinalPlayerResult[];
  leftoverRiichiSticksAwardedTo?: PlayerId;
  leftoverRiichiStickPoints: number;
  finalScores: [number, number, number, number];
  endedBy: 'bankruptcy' | 'scheduled-end' | 'agari-yame' | 'tenpai-yame' | 'sudden-death' | 'max-extra-round' | 'manual';
}

export interface RoundApplicationResult {
  match: MatchState;
  continueMatch: boolean;
  nextGameState?: GameState;
}
