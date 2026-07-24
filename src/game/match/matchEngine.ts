import { createInitialGameState } from '../engine';
import { sortTiles } from '../tileUtils';
import type { GameState, PlayerId, RoundResult } from '../types';
import { calculateFinalScores } from './finalRanking';
import { defaultMatchRuleConfig, normalizeMatchRuleConfig } from './matchRules';
import {
  advanceRoundPosition,
  dealerContinuesFromResult,
  hasReachedTarget,
  isExtraRound,
  isScheduledFinalRound,
  reachedMaxExtraRound,
  roundLabel,
  seatWindForPlayer,
} from './roundTransition';
import type { MatchLength, MatchResult, MatchRuleConfig, MatchState, RoundApplicationResult } from './types';

export function createMatch(options: Partial<MatchRuleConfig> & { initialDealer?: PlayerId } = {}): MatchState {
  const ruleConfig = normalizeMatchRuleConfig(options);
  const initialDealer = options.initialDealer ?? 0;
  return {
    matchLength: ruleConfig.matchLength,
    phase: 'not-started',
    scores: [ruleConfig.startingPoints, ruleConfig.startingPoints, ruleConfig.startingPoints, ruleConfig.startingPoints],
    dealer: initialDealer,
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    riichiSticks: 0,
    initialDealer,
    completedHands: 0,
    ruleConfig,
    appliedRoundIds: [],
    scoreHistory: [],
  };
}

export function startMatch(options: Partial<MatchRuleConfig> & { initialDealer?: PlayerId } = {}): MatchState {
  return startNextRound(createMatch(options));
}

export function startNextRound(state: MatchState): MatchState {
  if (state.phase === 'match-ended') return state;
  const currentGame = createGameStateFromMatch(state);
  return {
    ...state,
    phase: 'round-active',
    currentGame,
  };
}

export function createGameStateFromMatch(state: MatchState): GameState {
  const game = createInitialGameState();
  const players: GameState['players'] = game.players.map((player) => ({
    ...player,
    score: state.scores[player.id],
    seatWind: seatWindForPlayer(state.dealer, player.id),
    hand: [...player.hand],
    river: [],
    calls: [],
    drawnTile: player.drawnTile ? { ...player.drawnTile } : null,
    riichi: false,
    riichiState: null,
  }));

  let wall = [...game.wall];
  const eastPlayer = players[0];
  if (state.dealer !== 0 && eastPlayer.drawnTile) {
    const extra = eastPlayer.drawnTile;
    eastPlayer.hand = eastPlayer.hand.filter((tile) => tile.instanceId !== extra.instanceId);
    wall = [extra, ...wall];
  }
  const dealer = players[state.dealer];
  if (!dealer.drawnTile && dealer.hand.length === 13) {
    const drawn = wall.shift();
    if (drawn) {
      dealer.hand.push(drawn);
      dealer.drawnTile = drawn;
    }
  }

  return {
    ...game,
    roundWind: state.roundWind,
    dealer: state.dealer,
    honba: state.honba,
    riichiSticks: state.riichiSticks,
    players,
    wall,
    currentPlayer: state.dealer,
    phase: 'discard',
    turn: 1,
    result: null,
    pendingCall: null,
    pendingRon: null,
    pendingKakan: null,
    kanState: null,
    callsOccurred: false,
    firstTurnInterrupted: false,
    playerDrawCounts: [0, 0, 0, 0],
    playerDiscardCounts: [0, 0, 0, 0],
    lastDrawSource: 'initial-hand',
    lastWinSource: null,
    lastLiveWallDiscarder: null,
    pendingAbortiveDrawAfterFourthKan: false,
    matchRuleConfig: state.ruleConfig,
  };
}

export function applyRoundResultToMatch(state: MatchState, result: RoundResult): RoundApplicationResult {
  const roundId = roundResultId(state, result);
  if (state.appliedRoundIds.includes(roundId)) {
    return { match: state, continueMatch: state.phase !== 'match-ended', nextGameState: state.currentGame };
  }

  const scores = state.scores.map((score, index) => score + (result.pointDeltas[index] ?? 0)) as MatchState['scores'];
  const dealerContinues = dealerContinuesFromResult(state, result);
  const won = result.type === 'ron' || result.type === 'tsumo';
  const honba = dealerContinues || result.type === 'exhaustive-draw' || result.type === 'abortive-draw' ? state.honba + 1 : 0;
  const riichiSticks = won ? 0 : state.riichiSticks;
  const positioned = dealerContinues
    ? { dealer: state.dealer, roundWind: state.roundWind, handNumber: state.handNumber }
    : advanceRoundPosition(state);

  const provisional: MatchState = {
    ...state,
    scores,
    honba,
    riichiSticks,
    ...positioned,
    phase: 'round-result',
    lastRoundResult: result,
    completedHands: state.completedHands + 1,
    appliedRoundIds: [...state.appliedRoundIds, roundId],
    currentGame: undefined,
    scoreHistory: [
      ...state.scoreHistory,
      {
        roundLabel: roundLabel(state),
        scores,
        honba,
        riichiSticks,
      },
    ],
  };

  const pendingChoice = createPendingEndChoice(state, provisional, result, dealerContinues, roundId);
  if (pendingChoice) {
    return {
      match: {
        ...provisional,
        phase: 'match-end-choice',
        pendingEndChoice: pendingChoice,
      },
      continueMatch: true,
    };
  }

  const final = evaluateEndOfMatch(state, provisional, result, dealerContinues);
  if (final) {
    const ended: MatchState = {
      ...provisional,
      phase: 'match-ended',
      finalResult: final,
      pendingEndChoice: undefined,
      scores: final.finalScores,
      riichiSticks: final.leftoverRiichiStickPoints > 0 && state.ruleConfig.leftoverRiichiStickMode !== 'discard' ? 0 : provisional.riichiSticks,
    };
    return { match: ended, continueMatch: false };
  }

  const next = startNextRound(provisional);
  return { match: next, continueMatch: true, nextGameState: next.currentGame };
}

export function chooseMatchEnd(state: MatchState, end: boolean): RoundApplicationResult {
  if (state.phase !== 'match-end-choice' || !state.pendingEndChoice) {
    return { match: state, continueMatch: state.phase !== 'match-ended', nextGameState: state.currentGame };
  }
  if (end) {
    const final = calculateFinalScores({
      scores: state.scores,
      riichiSticks: state.riichiSticks,
      initialDealer: state.initialDealer,
      ruleConfig: state.ruleConfig,
      endedBy: state.pendingEndChoice.type,
    });
    return {
      match: {
        ...state,
        phase: 'match-ended',
        finalResult: final,
        scores: final.finalScores,
        riichiSticks: final.leftoverRiichiStickPoints > 0 && state.ruleConfig.leftoverRiichiStickMode !== 'discard' ? 0 : state.riichiSticks,
        pendingEndChoice: undefined,
      },
      continueMatch: false,
    };
  }
  const next = startNextRound({ ...state, phase: 'round-result', pendingEndChoice: undefined });
  return { match: next, continueMatch: true, nextGameState: next.currentGame };
}

export function chooseAgariYame(state: MatchState): boolean {
  if (!state.pendingEndChoice) return false;
  const sorted = [...state.scores].sort((a, b) => b - a);
  return state.scores[state.pendingEndChoice.dealer] === sorted[0] && sorted[0] - sorted[1] >= 1000;
}

function createPendingEndChoice(previous: MatchState, current: MatchState, result: RoundResult, dealerContinues: boolean, roundId: string) {
  const config = current.ruleConfig;
  const scheduledOrExtra = isScheduledFinalRound(previous) || isExtraRound(previous);
  if (!dealerContinues || !scheduledOrExtra) return null;
  const dealerFirst = highestRankedPlayer(current) === current.dealer;
  const dealerAtTarget = current.scores[current.dealer] >= config.targetPoints;
  if (!dealerFirst || !dealerAtTarget) return null;
  if ((result.type === 'ron' || result.type === 'tsumo') && config.agariYame && config.agariYameMode === 'player-choice') {
    return {
      type: 'agari-yame' as const,
      dealer: current.dealer,
      canEnd: true,
      canContinue: true,
      projectedNextRound: {
        roundWind: current.roundWind,
        handNumber: current.handNumber,
        honba: current.honba,
      },
      sourceRoundId: roundId,
    };
  }
  if (result.type === 'exhaustive-draw' && config.tenpaiYame && config.tenpaiYameMode === 'player-choice') {
    return {
      type: 'tenpai-yame' as const,
      dealer: current.dealer,
      canEnd: true,
      canContinue: true,
      projectedNextRound: {
        roundWind: current.roundWind,
        handNumber: current.handNumber,
        honba: current.honba,
      },
      sourceRoundId: roundId,
    };
  }
  return null;
}

export function applyFinishedGameToMatch(state: MatchState, gameState: GameState): RoundApplicationResult {
  if (!gameState.result) return { match: state, continueMatch: state.phase !== 'match-ended', nextGameState: state.currentGame };
  const finalScores = gameState.players.map((player) => player.score) as MatchState['scores'];
  const pointDeltas = finalScores.map((score, index) => score - state.scores[index]);
  const result = {
    ...gameState.result,
    pointDeltas,
    scoreDeltas: 'scoreDeltas' in gameState.result ? pointDeltas : undefined,
  } as RoundResult;
  return applyRoundResultToMatch({ ...state, riichiSticks: gameState.riichiSticks }, result);
}


export function evaluateEndOfMatch(previous: MatchState, current: MatchState, result: RoundResult, dealerContinues: boolean): MatchResult | null {
  const config = current.ruleConfig;
  if (config.bankruptcyEndsMatch && current.scores.some((score) => score < config.bankruptcyThreshold)) {
    return calculateFinalScores({ scores: current.scores, riichiSticks: current.riichiSticks, initialDealer: current.initialDealer, ruleConfig: config, endedBy: 'bankruptcy' });
  }

  const scheduledFinal = isScheduledFinalRound(previous);
  const extra = isExtraRound(previous);
  const dealerFirst = highestRankedPlayer(current) === current.dealer;
  const dealerAtTarget = current.scores[current.dealer] >= config.targetPoints;

  if (dealerContinues && (scheduledFinal || extra)) {
    if ((result.type === 'ron' || result.type === 'tsumo') && config.agariYame && config.agariYameMode === 'automatic' && dealerFirst && dealerAtTarget) {
      return calculateFinalScores({ scores: current.scores, riichiSticks: current.riichiSticks, initialDealer: current.initialDealer, ruleConfig: config, endedBy: 'agari-yame' });
    }
    if (result.type === 'exhaustive-draw' && config.tenpaiYame && config.tenpaiYameMode === 'automatic' && dealerFirst && dealerAtTarget) {
      return calculateFinalScores({ scores: current.scores, riichiSticks: current.riichiSticks, initialDealer: current.initialDealer, ruleConfig: config, endedBy: 'tenpai-yame' });
    }
    return null;
  }

  if (extra && hasReachedTarget(current.scores, config.suddenDeathTarget)) {
    return calculateFinalScores({ scores: current.scores, riichiSticks: current.riichiSticks, initialDealer: current.initialDealer, ruleConfig: config, endedBy: 'sudden-death' });
  }

  if ((scheduledFinal || extra) && !dealerContinues && hasReachedTarget(current.scores, config.targetPoints)) {
    return calculateFinalScores({ scores: current.scores, riichiSticks: current.riichiSticks, initialDealer: current.initialDealer, ruleConfig: config, endedBy: 'scheduled-end' });
  }

  if ((scheduledFinal || extra) && !dealerContinues && !config.allowWestRound) {
    return calculateFinalScores({ scores: current.scores, riichiSticks: current.riichiSticks, initialDealer: current.initialDealer, ruleConfig: config, endedBy: 'scheduled-end' });
  }

  if (reachedMaxExtraRound(previous) && !dealerContinues) {
    return calculateFinalScores({ scores: current.scores, riichiSticks: current.riichiSticks, initialDealer: current.initialDealer, ruleConfig: config, endedBy: 'max-extra-round' });
  }

  return null;
}

export function validateMatchState(state: MatchState): string[] {
  const issues: string[] = [];
  if (state.scores.length !== 4) issues.push('scores must contain four players');
  if (state.dealer < 0 || state.dealer > 3) issues.push('dealer must be 0-3');
  if (state.handNumber < 1 || state.handNumber > 4) issues.push('handNumber must be 1-4');
  if (state.honba < 0) issues.push('honba must not be negative');
  if (state.riichiSticks < 0) issues.push('riichiSticks must not be negative');
  if (state.phase === 'round-active' && !state.currentGame) issues.push('round-active requires currentGame');
  if (state.phase === 'match-ended' && !state.finalResult) issues.push('match-ended requires finalResult');
  if (new Set(state.appliedRoundIds).size !== state.appliedRoundIds.length) issues.push('appliedRoundIds must be unique');
  const total = state.scores.reduce((sum, score) => sum + score, 0) + state.riichiSticks * 1000;
  const expected = state.ruleConfig.startingPoints * 4;
  if (Math.abs(total - expected) > 20000) issues.push('score conservation drift is unexpectedly large');
  return issues;
}

function highestRankedPlayer(state: MatchState): PlayerId {
  return ([0, 1, 2, 3] as PlayerId[])
    .map((player) => ({ player, score: state.scores[player], tie: (player - state.initialDealer + 4) % 4 }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie)[0].player;
}

function roundResultId(state: MatchState, result: RoundResult): string {
  const explicit = (result as RoundResult & { roundId?: string }).roundId;
  return explicit ?? `${state.completedHands}:${state.roundWind}:${state.handNumber}:${result.type}:${JSON.stringify(result.pointDeltas)}`;
}

export { defaultMatchRuleConfig };
export type { MatchLength, MatchRuleConfig };
