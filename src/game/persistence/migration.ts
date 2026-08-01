import type { GameState, PlayerState } from '../types';
import type { MatchState } from '../match/types';
import type { MatchLog } from '../replay/types';
import { createFullRuleConfig, type MatchRuleConfigInput } from '../match/matchRules';
import type { SavedMatch } from './storageTypes';
import { CURRENT_SAVE_VERSION } from './storageTypes';
import { assertCurrentFormatVersion } from '../versionPolicy';

export const SAVED_MATCH_V1_DEFAULTS = Object.freeze({
  matchState: Object.freeze({
    currentMatchIndex: 0,
    matchResults: Object.freeze([]),
    aggregateScores: Object.freeze([0, 0, 0, 0]),
    appliedRoundIds: Object.freeze([]),
    scoreHistory: Object.freeze([]),
  }),
  gameState: Object.freeze({
    pendingCall: null,
    pendingRon: null,
    pendingKakan: null,
    kanState: null,
    callsOccurred: false,
    firstTurnInterrupted: false,
    playerDrawCounts: Object.freeze([0, 0, 0, 0]),
    playerDiscardCounts: Object.freeze([0, 0, 0, 0]),
    lastDrawSource: 'live-wall',
    lastWinSource: null,
    lastLiveWallDiscarder: null,
    pendingAbortiveDrawAfterFourthKan: false,
    kuikaeForbiddenTileIds: Object.freeze({}),
  }),
  playerState: Object.freeze({
    furitenState: Object.freeze({ temporaryFuriten: false, riichiPermanentFuriten: false }),
    pendingRiichiSidewaysDiscard: false,
  }),
});

export class SavedMatchCompatibilityError extends Error {
  constructor(message: string) {
    super(`SavedMatch v1 不兼容：${message}`);
    this.name = 'SavedMatchCompatibilityError';
  }
}

export function migrateSavedMatch(input: unknown): SavedMatch {
  if (!isRecord(input)) throw new SavedMatchCompatibilityError('存档根节点不是对象');
  assertCurrentFormatVersion('SavedMatch', input.version);

  const matchStateInput = requireRecord(input.matchState, 'matchState');
  const matchLogInput = requireRecord(input.matchLog, 'matchLog');
  requireArray(matchStateInput.scores, 'matchState.scores');
  requireArray(matchLogInput.rounds, 'matchLog.rounds');
  (matchLogInput.rounds as unknown[]).forEach((round, index) => {
    const roundRecord = requireRecord(round, `matchLog.rounds[${index}]`);
    requireArray(roundRecord.events, `matchLog.rounds[${index}].events`);
  });

  const topRules = optionalRecord(input.ruleConfig, 'ruleConfig');
  const topRound = optionalRecord(topRules?.round, 'ruleConfig.round');
  const topMatch = optionalRecord(topRules?.match, 'ruleConfig.match');
  const matchStateRules = optionalRecord(matchStateInput.ruleConfig, 'matchState.ruleConfig');
  const logRules = optionalRecord(matchLogInput.ruleConfig, 'matchLog.ruleConfig');
  const logRound = optionalRecord(logRules?.round, 'matchLog.ruleConfig.round');
  const logMatch = optionalRecord(logRules?.match, 'matchLog.ruleConfig.match');
  const topGameInput = input.gameState === undefined ? undefined : requireRecord(input.gameState, 'gameState');
  const currentGameInput = matchStateInput.currentGame === undefined ? undefined : requireRecord(matchStateInput.currentGame, 'matchState.currentGame');
  const gameRules = optionalRecord(topGameInput?.ruleConfig ?? currentGameInput?.ruleConfig, 'gameState.ruleConfig');
  const gameMatchRules = optionalRecord(topGameInput?.matchRuleConfig ?? currentGameInput?.matchRuleConfig, 'gameState.matchRuleConfig');
  const ruleConfig = createFullRuleConfig(
    (topRound ?? gameRules ?? logRound ?? {}),
    (topMatch ?? matchStateRules ?? gameMatchRules ?? logMatch ?? {}) as MatchRuleConfigInput,
  );

  const normalizeGame = (value: Record<string, unknown>, path: string): GameState => normalizeV1GameState(value, path, ruleConfig);
  const currentGame = currentGameInput ? normalizeGame(currentGameInput, 'matchState.currentGame') : undefined;
  const gameState = topGameInput ? normalizeGame(topGameInput, 'gameState') : undefined;
  const defaults = SAVED_MATCH_V1_DEFAULTS.matchState;
  const matchState: MatchState = {
    ...(matchStateInput as unknown as MatchState),
    ruleConfig: ruleConfig.match,
    currentMatchIndex: numberOrDefault(matchStateInput.currentMatchIndex, defaults.currentMatchIndex, 'matchState.currentMatchIndex'),
    matchResults: arrayOrDefault(matchStateInput.matchResults, defaults.matchResults, 'matchState.matchResults') as MatchState['matchResults'],
    aggregateScores: fourNumberTupleOrDefault(matchStateInput.aggregateScores, defaults.aggregateScores, 'matchState.aggregateScores'),
    appliedRoundIds: stringArrayOrDefault(matchStateInput.appliedRoundIds, defaults.appliedRoundIds, 'matchState.appliedRoundIds'),
    scoreHistory: arrayOrDefault(matchStateInput.scoreHistory, defaults.scoreHistory, 'matchState.scoreHistory') as MatchState['scoreHistory'],
    currentGame,
  };

  const matchLog: MatchLog = {
    ...(matchLogInput as unknown as MatchLog),
    ruleConfig,
  };
  return {
    ...(input as unknown as SavedMatch),
    version: CURRENT_SAVE_VERSION,
    ruleConfig,
    matchState,
    gameState,
    matchLog,
  };
}

function normalizeV1GameState(input: Record<string, unknown>, path: string, ruleConfig: SavedMatch['ruleConfig']): GameState {
  requireArray(input.players, `${path}.players`);
  requireArray(input.wall, `${path}.wall`);
  requireArray(input.deadWall, `${path}.deadWall`);
  requireArray(input.doraIndicators, `${path}.doraIndicators`);
  const players = (input.players as unknown[]).map((player, index) => normalizeV1PlayerState(requireRecord(player, `${path}.players[${index}]`), `${path}.players[${index}]`));
  const defaults = SAVED_MATCH_V1_DEFAULTS.gameState;
  const drawCounts = fourNumberTupleOrDefault(input.playerDrawCounts, defaults.playerDrawCounts, `${path}.playerDrawCounts`);
  const defaultDrawSource = Number(input.turn) <= 1 && drawCounts.every((count) => count === 0) ? 'initial-hand' : 'live-wall';
  return {
    ...(input as unknown as GameState),
    players,
    pendingCall: nullableOrDefault(input.pendingCall, defaults.pendingCall),
    pendingRon: nullableOrDefault(input.pendingRon, defaults.pendingRon),
    pendingKakan: nullableOrDefault(input.pendingKakan, defaults.pendingKakan),
    kanState: nullableOrDefault(input.kanState, defaults.kanState),
    callsOccurred: booleanOrDefault(input.callsOccurred, defaults.callsOccurred, `${path}.callsOccurred`),
    firstTurnInterrupted: booleanOrDefault(input.firstTurnInterrupted, defaults.firstTurnInterrupted, `${path}.firstTurnInterrupted`),
    playerDrawCounts: drawCounts,
    playerDiscardCounts: fourNumberTupleOrDefault(input.playerDiscardCounts, defaults.playerDiscardCounts, `${path}.playerDiscardCounts`),
    lastDrawSource: input.lastDrawSource === undefined ? defaultDrawSource : input.lastDrawSource as GameState['lastDrawSource'],
    lastWinSource: nullableOrDefault(input.lastWinSource, defaults.lastWinSource),
    lastLiveWallDiscarder: nullableOrDefault(input.lastLiveWallDiscarder, defaults.lastLiveWallDiscarder),
    pendingAbortiveDrawAfterFourthKan: booleanOrDefault(input.pendingAbortiveDrawAfterFourthKan, defaults.pendingAbortiveDrawAfterFourthKan, `${path}.pendingAbortiveDrawAfterFourthKan`),
    kuikaeForbiddenTileIds: recordOrDefault(input.kuikaeForbiddenTileIds, defaults.kuikaeForbiddenTileIds, `${path}.kuikaeForbiddenTileIds`) as GameState['kuikaeForbiddenTileIds'],
    ruleConfig: ruleConfig.round,
    matchRuleConfig: ruleConfig.match,
  };
}

function normalizeV1PlayerState(input: Record<string, unknown>, path: string): PlayerState {
  requireArray(input.hand, `${path}.hand`);
  requireArray(input.river, `${path}.river`);
  requireArray(input.calls, `${path}.calls`);
  const defaults = SAVED_MATCH_V1_DEFAULTS.playerState;
  const furiten = recordOrDefault(input.furitenState, defaults.furitenState, `${path}.furitenState`);
  return {
    ...(input as unknown as PlayerState),
    furitenState: {
      temporaryFuriten: booleanOrDefault(furiten.temporaryFuriten, false, `${path}.furitenState.temporaryFuriten`),
      riichiPermanentFuriten: booleanOrDefault(furiten.riichiPermanentFuriten, false, `${path}.furitenState.riichiPermanentFuriten`),
    },
    pendingRiichiSidewaysDiscard: booleanOrDefault(input.pendingRiichiSidewaysDiscard, defaults.pendingRiichiSidewaysDiscard, `${path}.pendingRiichiSidewaysDiscard`),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new SavedMatchCompatibilityError(`${path} 缺失或不是对象`);
  return value;
}

function optionalRecord(value: unknown, path: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  return requireRecord(value, path);
}

function requireArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new SavedMatchCompatibilityError(`${path} 缺失或不是数组`);
}

function arrayOrDefault(value: unknown, defaults: readonly unknown[], path: string): unknown[] {
  if (value === undefined) return [...defaults];
  requireArray(value, path);
  return [...value];
}

function stringArrayOrDefault(value: unknown, defaults: readonly string[], path: string): string[] {
  const result = arrayOrDefault(value, defaults, path);
  if (result.some((entry) => typeof entry !== 'string')) throw new SavedMatchCompatibilityError(`${path} 必须只包含字符串`);
  return result as string[];
}

function fourNumberTupleOrDefault(value: unknown, defaults: readonly number[], path: string): [number, number, number, number] {
  const result = arrayOrDefault(value, defaults, path);
  if (result.length !== 4 || result.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
    throw new SavedMatchCompatibilityError(`${path} 必须包含四个有效数字`);
  }
  return result as [number, number, number, number];
}

function numberOrDefault(value: unknown, defaultValue: number, path: string): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new SavedMatchCompatibilityError(`${path} 必须是有效数字`);
  return value;
}

function booleanOrDefault(value: unknown, defaultValue: boolean, path: string): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'boolean') throw new SavedMatchCompatibilityError(`${path} 必须是布尔值`);
  return value;
}

function nullableOrDefault<T>(value: unknown, defaultValue: T): T {
  return (value === undefined ? defaultValue : value) as T;
}

function recordOrDefault(value: unknown, defaults: Readonly<Record<string, unknown>>, path: string): Record<string, unknown> {
  if (value === undefined) return { ...defaults };
  return requireRecord(value, path);
}
