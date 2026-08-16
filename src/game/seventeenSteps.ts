import { evaluateWin, calculatePoints, type ScoreResult } from './scoreCalculator';
import { createScoringWinContext } from './score/scoringAdapter';
import { defaultRuleConfig } from './score/rules/RuleConfig';
import type { GameState, PlayerId, PlayerState, Tile, TileId, Wind, RoundResult } from './types';
import { ALL_TILE_IDS, createTile, sortTiles } from './tileUtils';
import { buildWall, doraIndicatorSlots, shuffleWall } from './wall';

export type SeventeenStepsPlayerId = 0 | 1;
export type SeventeenStepsPhase = 'build' | 'active' | 'ron-window' | 'round-ended' | 'match-ended';

export type SeventeenStepsCycleCount = 1 | 2 | 3 | 4;

export interface SeventeenStepsMatchConfig {
  startingPoints: number;
  cycleCount: SeventeenStepsCycleCount;
  aiDifficulty: string;
  aiPersonality: string;
  hanRestriction: 0 | 2 | 3 | 4 | 5;
  countDoraForHanRestriction: boolean;
  bankruptcyEndsMatch: boolean;
  roundRuleConfig: Partial<typeof defaultRuleConfig>;
  displayOptions: {
    doraGlowEnabled: boolean;
    sameTileHoverEnabled: boolean;
  };
}

// TODO: apply difficulty/personality to SeventeenStepsAI when mode-specific AI behavior is designed.

export interface SeventeenStepsMatchProgress {
  scores: [number, number];
  cycleIndex: number;
  handInCycle: 0 | 1;
  prevailingWind: Wind;
  completedHands: number;
  dealerId: SeventeenStepsPlayerId;
}

export const DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG: SeventeenStepsMatchConfig = {
  startingPoints: 50000,
  cycleCount: 1,
  aiDifficulty: 'shintentai',
  aiPersonality: 'balanced',
  hanRestriction: 0,
  countDoraForHanRestriction: true,
  bankruptcyEndsMatch: true,
  roundRuleConfig: {
    ...defaultRuleConfig,
    allowOpenTanyao: false,
    ippatsu: false,
    allowKyuushuKyuuhai: false,
    abortOnFourWinds: false,
    abortOnFourRiichi: false,
    abortOnFourKans: false,
    allowKokushiChankanAnkan: false,
    allowDoubleYakuman: false,
    multipleYakuman: false,
  },
  displayOptions: {
    doraGlowEnabled: true,
    sameTileHoverEnabled: true,
  },
};

export interface SeventeenStepsPlayerState {
  id: SeventeenStepsPlayerId;
  name: string;
  seatWind: 'east' | 'west';
  sourceTiles: Tile[];
  fixedHand: Tile[];
  discardCandidates: Tile[];
  discardedTiles: Tile[];
  discardCount: number;
  buildConfirmed: boolean;
  forcedRiichi: true;
  permanentFuriten: boolean;
}

export interface SeventeenStepsWinResult {
  type: 'ron';
  winnerId: SeventeenStepsPlayerId;
  discarderId: SeventeenStepsPlayerId;
  winningTile: Tile;
  score: ScoreResult;
  pointDeltas: [number, number];
  scoresBefore: [number, number];
  scoresAfter: [number, number];
}

export interface SeventeenStepsDrawResult {
  type: 'draw';
  validTenpai: [boolean, boolean];
  pointDeltas: [number, number];
  scoresBefore: [number, number];
  scoresAfter: [number, number];
}

export interface SeventeenStepsWaitAnalysis {
  id: TileId;
  remaining: number;
  score: ScoreResult;
  /** Construction-stage equivalent han: 13 per counted yakuman. */
  effectiveHan: number;
  doraCount: number;
  restrictionHan: number;
  meetsHanRestriction: boolean;
  /** Only a red winning tile can make this wait satisfy the han restriction. */
  redDoraOnly: boolean;
}

export type SeventeenStepsResult = SeventeenStepsWinResult | SeventeenStepsDrawResult;

export interface SeventeenStepsState {
  phase: SeventeenStepsPhase;
  dealerId: SeventeenStepsPlayerId;
  matchConfig: SeventeenStepsMatchConfig;
  scores: [number, number];
  cycleIndex: number;
  handInCycle: 0 | 1;
  prevailingWind: Wind;
  completedHands: number;
  totalHands: number;
  deadWall: Tile[];
  currentPlayerId: SeventeenStepsPlayerId;
  turnIndex: number;
  players: [SeventeenStepsPlayerState, SeventeenStepsPlayerState];
  doraIndicators: Tile[];
  pendingRon: {
    winnerId: SeventeenStepsPlayerId;
    discarderId: SeventeenStepsPlayerId;
    tile: Tile;
    score: ScoreResult;
  } | null;
  result: SeventeenStepsResult | null;
}

function clonePlayer(player: SeventeenStepsPlayerState): SeventeenStepsPlayerState {
  return {
    ...player,
    sourceTiles: [...player.sourceTiles],
    fixedHand: [...player.fixedHand],
    discardCandidates: [...player.discardCandidates],
    discardedTiles: [...player.discardedTiles],
  };
}

function makePlayer(id: SeventeenStepsPlayerId, sourceTiles: Tile[], dealerId: SeventeenStepsPlayerId, buildConfirmed = false): SeventeenStepsPlayerState {
  const source = [...sourceTiles].sort(sortTiles);
  const fixedHand = buildConfirmed ? source.slice(0, 13) : [];
  return {
    id,
    name: id === 0 ? '玩家' : '对手',
    seatWind: id === dealerId ? 'east' : 'west',
    sourceTiles: source,
    fixedHand,
    discardCandidates: buildConfirmed ? source.slice(13) : [],
    discardedTiles: [],
    discardCount: 0,
    buildConfirmed,
    forcedRiichi: true,
    permanentFuriten: false,
  };
}

export function normalizeSeventeenStepsMatchConfig(config: Partial<SeventeenStepsMatchConfig> = {}): SeventeenStepsMatchConfig {
  const { countDoraForManganRestriction: legacyDoraRestriction, manganRestriction: _legacyManganRestriction, ...currentConfig } = config as Partial<SeventeenStepsMatchConfig> & SeventeenStepsMatchConfigLegacy;
  const merged = {
    ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG,
    ...currentConfig,
    countDoraForHanRestriction: config.countDoraForHanRestriction ?? legacyDoraRestriction ?? DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG.countDoraForHanRestriction,
    roundRuleConfig: { ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG.roundRuleConfig, ...(config.roundRuleConfig ?? {}) },
    displayOptions: { ...DEFAULT_SEVENTEEN_STEPS_MATCH_CONFIG.displayOptions, ...(config.displayOptions ?? {}) },
  };
  return {
    ...merged,
    startingPoints: Number.isFinite(merged.startingPoints) && merged.startingPoints > 0 ? Math.round(merged.startingPoints) : 50000,
    cycleCount: Math.min(4, Math.max(1, Math.round(merged.cycleCount))) as SeventeenStepsCycleCount,
    hanRestriction: [0, 2, 3, 4, 5].includes(merged.hanRestriction) ? merged.hanRestriction : 0,
  };
}

interface SeventeenStepsMatchConfigLegacy {
  countDoraForManganRestriction?: boolean;
  manganRestriction?: boolean;
}

export function createSeventeenStepsGame(configOrDealer: Partial<SeventeenStepsMatchConfig> | SeventeenStepsPlayerId = 0, progress?: Partial<SeventeenStepsMatchProgress>): SeventeenStepsState {
  const config = normalizeSeventeenStepsMatchConfig(typeof configOrDealer === 'number' ? {} : configOrDealer);
  const defaultDealer = typeof configOrDealer === 'number' ? configOrDealer : 0;
  const dealerId = progress?.dealerId ?? defaultDealer;
  const wall = shuffleWall(buildWall());
  const deadWall = wall.slice(-14);
  const player0Tiles = wall.slice(0, 34);
  const player1Tiles = wall.slice(34, 68);

  return {
    phase: 'build',
    dealerId,
    matchConfig: config,
    scores: progress?.scores ?? [config.startingPoints, config.startingPoints],
    cycleIndex: progress?.cycleIndex ?? 0,
    handInCycle: progress?.handInCycle ?? 0,
    prevailingWind: progress?.prevailingWind ?? 'east',
    completedHands: progress?.completedHands ?? 0,
    totalHands: config.cycleCount * 2,
    deadWall: [...deadWall],
    currentPlayerId: 0,
    turnIndex: 0,
    players: [makePlayer(0, player0Tiles, dealerId), makePlayer(1, player1Tiles, dealerId, true)],
    doraIndicators: doraIndicatorSlots(deadWall).slice(0, 1),
    pendingRon: null,
    result: null,
  };
}

/** 将17步状态投影为正式牌桌组件所需的 GameState；隐藏信息不会进入投影。 */
export function toSeventeenStepsGameState(state: SeventeenStepsState): GameState {
  const scoringState = createScoringState(state);
  const pointDeltas = state.result?.pointDeltas ?? [0, 0];
  const players = [0, 1].map((playerId) => {
    const source = state.players[playerId];
    const projected = scoringState.players[playerId];
    const firstDiscard = source.discardedTiles[0];
    return {
      ...projected,
      score: state.scores[playerId] ?? 0,
      hand: [...source.fixedHand],
      river: [...source.discardedTiles],
      riichiState: {
        ...projected.riichiState!,
        riichiDiscardInstanceId: firstDiscard?.instanceId,
      },
    };
  });
  const inactivePlayers: PlayerState[] = [2, 3].map((id) => ({
    id: id as PlayerId,
    name: '未使用座位',
    seatWind: id === 2 ? 'west' : 'north',
    score: 0,
    hand: [],
    river: [],
    calls: [],
    drawnTile: null,
    riichi: false,
    riichiState: null,
    furitenState: { temporaryFuriten: false, riichiPermanentFuriten: false },
  }));
  return {
    ...scoringState,
    players: [...players, ...inactivePlayers],
    currentPlayer: state.currentPlayerId,
    phase: state.phase === 'ron-window' ? 'ron-window' : state.phase === 'round-ended' || state.phase === 'match-ended' ? 'round-ended' : 'discard',
    turn: state.turnIndex + 1,
    doraIndicators: [...state.doraIndicators],
    result: projectRoundResult(state),
    playerDiscardCounts: state.players.map((player) => player.discardCount).concat([0, 0]),
  };
}

export function selectFixedTile(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId, instanceId: string): SeventeenStepsState {
  if (state.phase !== 'build') return state;
  const player = state.players[playerId];
  if (player.buildConfirmed || !player.sourceTiles.some((tile) => tile.instanceId === instanceId)) return state;

  const fixedIndex = player.fixedHand.findIndex((tile) => tile.instanceId === instanceId);
  const fixedHand = fixedIndex === -1
    ? player.fixedHand.length >= 13 ? player.fixedHand : [...player.fixedHand, player.sourceTiles.find((tile) => tile.instanceId === instanceId)!]
    : player.fixedHand.filter((_, index) => index !== fixedIndex);

  return {
    ...state,
    players: state.players.map((item, index) => index === playerId ? { ...clonePlayer(item), fixedHand: fixedHand.sort(sortTiles) } : clonePlayer(item)) as [SeventeenStepsPlayerState, SeventeenStepsPlayerState],
  };
}

export function moveFixedTile(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId, instanceId: string, toFixedHand: boolean): SeventeenStepsState {
  if (state.phase !== 'build') return state;
  const player = state.players[playerId];
  const isFixed = player.fixedHand.some((tile) => tile.instanceId === instanceId);
  if (!player.sourceTiles.some((tile) => tile.instanceId === instanceId) || isFixed === toFixedHand) return state;
  if (toFixedHand && player.fixedHand.length >= 13) return state;
  return selectFixedTile(state, playerId, instanceId);
}

export function confirmBuild(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId): SeventeenStepsState {
  if (state.phase !== 'build') return state;
  const player = state.players[playerId];
  if (player.buildConfirmed || player.fixedHand.length !== 13) return state;

  const players = state.players.map((item, index) => {
    if (index !== playerId) return clonePlayer(item);
    const fixedIds = new Set(player.fixedHand.map((tile) => tile.instanceId));
    return {
      ...clonePlayer(item),
      fixedHand: [...player.fixedHand].sort(sortTiles),
      discardCandidates: item.sourceTiles.filter((tile) => !fixedIds.has(tile.instanceId)).sort(sortTiles),
      buildConfirmed: true,
    };
  }) as [SeventeenStepsPlayerState, SeventeenStepsPlayerState];

  const bothConfirmed = players.every((item) => item.buildConfirmed);
  return {
    ...state,
    phase: bothConfirmed ? 'active' : 'build',
    currentPlayerId: bothConfirmed ? 0 : state.currentPlayerId,
    turnIndex: bothConfirmed ? 0 : state.turnIndex,
    players,
  };
}

export function canSeventeenStepsRon(state: SeventeenStepsState, winnerId: SeventeenStepsPlayerId, tile: Tile): ScoreResult | null {
  const player = state.players[winnerId];
  if (player.permanentFuriten) return null;
  const hand = [...player.fixedHand, tile];
  const score = evaluateWin(hand, createSeventeenStepsWinContext(state, winnerId, tile, player.fixedHand));
  if (!score.isWinning || score.points.total <= 0) return null;
  const restrictionHan = getSeventeenStepsHanRestriction(state, score);
  if (state.matchConfig.hanRestriction > 0 && score.yakumanValue === 0 && restrictionHan < state.matchConfig.hanRestriction) return null;
  return score;
}

export function analyzeSeventeenStepsTenpai(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId): SeventeenStepsWaitAnalysis[] {
  const player = state.players[playerId];
  if (player.fixedHand.length !== 13) return [];
  return ALL_TILE_IDS.flatMap((tileId) => {
    const winningTile = createTile(tileId, 1);
    const ordinaryScore = evaluateWin(
      [...player.fixedHand, winningTile],
      createSeventeenStepsWinContext(state, playerId, winningTile, player.fixedHand),
    );
    if (!ordinaryScore.isWinning) return [];
    const ordinaryRestrictionHan = getSeventeenStepsHanRestriction(state, ordinaryScore);
    const ordinaryMeetsHanRestriction = ordinaryScore.yakumanValue > 0 || state.matchConfig.hanRestriction === 0 || ordinaryRestrictionHan >= state.matchConfig.hanRestriction;
    const canUseRedWinningTile = state.matchConfig.roundRuleConfig.akaDora !== false
      && (tileId === 4 || tileId === 13 || tileId === 22);
    const redWinningTile = canUseRedWinningTile ? createTile(tileId, 0) : null;
    const redScore = !ordinaryMeetsHanRestriction && redWinningTile
      ? evaluateWin(
        [...player.fixedHand, redWinningTile],
        createSeventeenStepsWinContext(state, playerId, redWinningTile, player.fixedHand),
      )
      : null;
    const redRestrictionHan = redScore?.isWinning ? getSeventeenStepsHanRestriction(state, redScore) : ordinaryRestrictionHan;
    const redMeetsHanRestriction = Boolean(redScore?.isWinning) && (redScore?.yakumanValue ?? 0) > 0
      || Boolean(redScore?.isWinning) && (state.matchConfig.hanRestriction === 0 || redRestrictionHan >= state.matchConfig.hanRestriction);
    const redDoraOnly = !ordinaryMeetsHanRestriction && redMeetsHanRestriction;
    const score = redDoraOnly && redScore ? redScore : ordinaryScore;
    const restrictionHan = redDoraOnly ? redRestrictionHan : ordinaryRestrictionHan;
    return [{
      id: tileId,
      remaining: countSeventeenStepsVisibleRemainingTiles(state, playerId, tileId),
      score,
      effectiveHan: restrictionHan,
      doraCount: getSeventeenStepsRestrictionDora(state, score),
      restrictionHan,
      meetsHanRestriction: ordinaryMeetsHanRestriction || redDoraOnly,
      redDoraOnly,
    }];
  });
}

export function getSeventeenStepsRestrictionDora(state: SeventeenStepsState, score: ScoreResult): number {
  const redDoraHan = state.matchConfig.roundRuleConfig.akaDora === false ? 0 : score.redDora;
  return score.dora + redDoraHan;
}

export function getSeventeenStepsHanRestriction(state: SeventeenStepsState, score: ScoreResult): number {
  if (score.yakumanValue > 0) return score.yakumanValue * 13;
  const yakuHan = score.yaku.reduce((sum, item) => sum + (item.han ?? 0), 0);
  return yakuHan + (state.matchConfig.countDoraForHanRestriction ? getSeventeenStepsRestrictionDora(state, score) : 0);
}

export function getSeventeenStepsEffectiveHan(score: ScoreResult): number {
  return score.yakumanValue > 0 ? score.yakumanValue * 13 : score.han;
}

export function discardCandidate(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId, instanceId: string): SeventeenStepsState {
  if (state.phase !== 'active' || state.currentPlayerId !== playerId) return state;
  const player = state.players[playerId];
  if (player.discardCount >= 17) return state;
  const candidateIndex = player.discardCandidates.findIndex((tile) => tile.instanceId === instanceId);
  if (candidateIndex === -1) return state;

  const discarded = { ...player.discardCandidates[candidateIndex], isRiichiDiscard: player.discardCount === 0 };
  const players = state.players.map((item, index) => {
    if (index !== playerId) return clonePlayer(item);
    const next = clonePlayer(item);
    next.discardCandidates.splice(candidateIndex, 1);
    next.discardedTiles.push(discarded);
    next.discardCount += 1;
    if (waitsForTile(state, playerId, discarded)) next.permanentFuriten = true;
    return next;
  }) as [SeventeenStepsPlayerState, SeventeenStepsPlayerState];
  const nextState: SeventeenStepsState = {
    ...state,
    players,
    turnIndex: state.turnIndex + 1,
    pendingRon: null,
  };
  const opponentId = otherPlayer(playerId);
  const score = canSeventeenStepsRon(nextState, opponentId, discarded);
  if (score) {
    return {
      ...nextState,
      phase: 'ron-window',
      pendingRon: { winnerId: opponentId, discarderId: playerId, tile: discarded, score },
    };
  }
  return continueAfterNoRon(nextState, playerId);
}

export function declareSeventeenStepsRon(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId): SeventeenStepsState {
  if (state.phase !== 'ron-window' || !state.pendingRon || state.pendingRon.winnerId !== playerId) return state;
  const { winnerId, discarderId, tile, score } = state.pendingRon;
  const pointDeltas: [number, number] = [0, 0];
  const points = score.points.ron ?? 0;
  pointDeltas[winnerId] += points;
  pointDeltas[discarderId] -= points;
  const scoresBefore = [...state.scores] as [number, number];
  const scoresAfter = [scoresBefore[0] + pointDeltas[0], scoresBefore[1] + pointDeltas[1]] as [number, number];
  return {
    ...state,
    scores: scoresAfter,
    phase: 'round-ended',
    pendingRon: null,
    result: { type: 'ron', winnerId, discarderId, winningTile: tile, score, pointDeltas, scoresBefore, scoresAfter },
  };
}

export function passSeventeenStepsRon(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId): SeventeenStepsState {
  if (state.phase !== 'ron-window' || !state.pendingRon || state.pendingRon.winnerId !== playerId) return state;
  const players = state.players.map((item) => clonePlayer(item)) as [SeventeenStepsPlayerState, SeventeenStepsPlayerState];
  players[playerId].permanentFuriten = true;
  return continueAfterNoRon({ ...state, players, phase: 'active', pendingRon: null }, state.pendingRon.discarderId);
}

export function isEffectiveTenpai(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId): boolean {
  const player = state.players[playerId];
  if (player.permanentFuriten) return false;
  return ALL_TILE_IDS.some((tileId) => {
    if (canSeventeenStepsRon(state, playerId, createTile(tileId, 1))) return true;
    return (tileId === 4 || tileId === 13 || tileId === 22) && canSeventeenStepsRon(state, playerId, createTile(tileId, 0)) !== null;
  });
}

function projectRoundResult(state: SeventeenStepsState): RoundResult | null {
  if (!state.result) return null;
  if (state.result.type === 'draw') {
    const draw = state.result;
    const tenpaiPlayers = draw.validTenpai.flatMap((valid, playerId) => valid ? [playerId as PlayerId] : []);
    return {
      type: 'exhaustive-draw',
      tenpaiPlayers,
      notenPlayers: [0, 1].filter((playerId) => !draw.validTenpai[playerId]) as PlayerId[],
      scoreDeltas: [...draw.pointDeltas, 0, 0],
      pointDeltas: [...draw.pointDeltas, 0, 0],
      dealerContinues: false,
      honbaIncrement: 0,
      riichiSticksCarryOver: false,
    };
  }
  const win = state.result;
  return {
    type: 'ron',
    winners: [{
      winner: win.winnerId,
      from: win.discarderId,
      winType: 'ron',
      winTile: win.winningTile,
      yaku: win.score.yaku.map((item) => ({ name: item.name, han: item.han, yakuman: Boolean(item.yakumanValue) })),
      dora: win.score.dora,
      uraDora: win.score.uraDora,
      redDora: win.score.redDora,
      han: win.score.han,
      fu: win.score.fu,
      points: win.score.points.ron ?? 0,
      pointDeltas: [...win.pointDeltas, 0, 0],
    }],
    pointDeltas: [...win.pointDeltas, 0, 0],
  };
}

function continueAfterNoRon(state: SeventeenStepsState, discarderId: SeventeenStepsPlayerId): SeventeenStepsState {
  if (state.players.every((player) => player.discardCount >= 17)) return settleDraw(state);
  return { ...state, phase: 'active', currentPlayerId: otherPlayer(discarderId) };
}

export function settleDraw(state: SeventeenStepsState): SeventeenStepsState {
  const validTenpai: [boolean, boolean] = [isEffectiveTenpai(state, 0), isEffectiveTenpai(state, 1)];
  const pointDeltas: [number, number] = [0, 0];
  if (validTenpai[0] !== validTenpai[1]) {
    const winnerId = validTenpai[0] ? 0 : 1;
    const loserId = otherPlayer(winnerId);
    const penalty = manganPenalty(state, winnerId);
    pointDeltas[winnerId] = penalty;
    pointDeltas[loserId] = -penalty;
  } else if (!validTenpai[0] && !validTenpai[1]) {
    pointDeltas[0] = -manganPenalty(state, 0);
    pointDeltas[1] = -manganPenalty(state, 1);
  }
  const scoresBefore = [...state.scores] as [number, number];
  const scoresAfter = [scoresBefore[0] + pointDeltas[0], scoresBefore[1] + pointDeltas[1]] as [number, number];
  return { ...state, phase: 'round-ended', scores: scoresAfter, currentPlayerId: state.currentPlayerId, result: { type: 'draw', validTenpai, pointDeltas, scoresBefore, scoresAfter }, pendingRon: null };
}

export function advanceSeventeenStepsMatch(state: SeventeenStepsState): SeventeenStepsState {
  if (state.phase !== 'round-ended' || !state.result) return state;
  const completedHands = state.completedHands + 1;
  if ((state.matchConfig.bankruptcyEndsMatch && state.scores.some((score) => score < 0)) || completedHands >= state.totalHands) return { ...state, phase: 'match-ended', completedHands };
  const cycleIndex = Math.floor(completedHands / 2);
  const handInCycle = (completedHands % 2) as 0 | 1;
  const winds: Wind[] = ['east', 'south', 'west', 'north'];
  return createSeventeenStepsGame(state.matchConfig, {
    scores: state.scores,
    cycleIndex,
    handInCycle,
    prevailingWind: winds[cycleIndex] ?? 'north',
    completedHands,
    dealerId: otherPlayer(state.dealerId),
  });
}

function manganPenalty(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId): number {
  const tile = createTile(0, 0);
  const context = createSeventeenStepsWinContext(state, playerId, tile, state.players[playerId].fixedHand);
  return calculatePoints(5, 30, context).ron ?? 0;
}

function waitsForTile(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId, tile: Tile): boolean {
  return canSeventeenStepsRon(state, playerId, tile) !== null;
}

function countSeventeenStepsVisibleRemainingTiles(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId, tileId: TileId): number {
  const visible = [
    ...state.players[playerId].sourceTiles,
    ...state.players.flatMap((player) => player.discardedTiles),
    ...state.doraIndicators,
  ];
  return Math.max(0, 4 - visible.filter((tile) => tile.id === tileId).length);
}

function createSeventeenStepsWinContext(state: SeventeenStepsState, playerId: SeventeenStepsPlayerId, winningTile: Tile, preWinHand: Tile[]) {
  return createScoringWinContext({
    state: createScoringState(state),
    playerId,
    winningTile,
    winType: 'ron',
    preWinHand,
    winningTileSource: 'discard',
  });
}

function createScoringState(state: SeventeenStepsState): GameState {
  const players = state.players.map((player): PlayerState => ({
    id: player.id,
    name: player.name,
    seatWind: player.seatWind,
    score: state.scores[player.id] ?? state.matchConfig.startingPoints,
    hand: [...player.fixedHand],
    river: [...player.discardedTiles],
    calls: [],
    drawnTile: null,
    riichi: true,
    riichiState: { declaredAtTurn: 1, ippatsuAvailable: false, kind: 'riichi' },
    furitenState: { temporaryFuriten: false, riichiPermanentFuriten: player.permanentFuriten },
  }));
  return {
    roundWind: state.prevailingWind,
    dealer: state.dealerId,
    honba: 0,
    riichiSticks: 0,
    wall: [],
    deadWall: [...state.deadWall],
    doraIndicators: state.doraIndicators,
    players: [...players, ...([] as PlayerState[])],
    currentPlayer: state.currentPlayerId,
    phase: 'discard',
    turn: state.turnIndex + 1,
    lastDiscard: null,
    result: null,
    pendingCall: null,
    pendingRon: null,
    pendingKakan: null,
    kanState: null,
    callsOccurred: false,
    firstTurnInterrupted: false,
    playerDrawCounts: [0, 0],
    playerDiscardCounts: state.players.map((player) => player.discardCount),
    lastDrawSource: 'initial-hand',
    lastWinSource: null,
    lastLiveWallDiscarder: null,
    pendingAbortiveDrawAfterFourthKan: false,
    kuikaeForbiddenTileIds: {},
    ruleConfig: { ...defaultRuleConfig, ...state.matchConfig.roundRuleConfig },
  } as GameState;
}

function otherPlayer(playerId: SeventeenStepsPlayerId): SeventeenStepsPlayerId {
  return playerId === 0 ? 1 : 0;
}
