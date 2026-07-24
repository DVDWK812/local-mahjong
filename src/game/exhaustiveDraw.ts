import { shanten } from './shanten';
import { defaultRuleConfig } from './score/rules/RuleConfig';
import { findWinningShapes } from './score/yakuChecker';
import { ALL_TILE_IDS } from './tileUtils';
import type { ExhaustiveDrawResult, GameState, PlayerId } from './types';
import { createTile } from './tileUtils';

const PLAYER_IDS: PlayerId[] = [0, 1, 2, 3];

export function getTenpaiPlayersAtExhaustiveDraw(state: GameState): PlayerId[] {
  return PLAYER_IDS.filter((playerId) => isPlayerTenpaiAtDraw(state, playerId));
}

export function isPlayerTenpaiAtDraw(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  if (!player) return false;
  const openMeldCount = player.calls.length;
  if (openMeldCount === 0) return shanten(player.hand).best === 0;

  const neededConcealedMelds = 4 - openMeldCount;
  return ALL_TILE_IDS.some((tileId) => {
    const testHand = [...player.hand, createTile(tileId, 99)];
    return findWinningShapes(testHand).some((shape) => (
      shape.type === 'standard'
      && shape.melds.length === neededConcealedMelds
      && shape.melds.length + openMeldCount === 4
    ));
  });
}

export function calculateNotenPenaltyDeltas(tenpaiPlayers: PlayerId[]): number[] {
  const deltas = [0, 0, 0, 0];
  const tenpai = new Set(tenpaiPlayers);
  const tenpaiCount = tenpai.size;
  if (tenpaiCount === 0 || tenpaiCount === 4) return deltas;
  const tenpaiGain = 3000 / tenpaiCount;
  const notenLoss = 3000 / (4 - tenpaiCount);
  PLAYER_IDS.forEach((playerId) => {
    deltas[playerId] = tenpai.has(playerId) ? tenpaiGain : -notenLoss;
  });
  return deltas;
}

export function buildExhaustiveDrawResult(state: GameState): ExhaustiveDrawResult {
  const config = { ...defaultRuleConfig, ...(state.ruleConfig ?? {}) };
  const tenpaiPlayers = getTenpaiPlayersAtExhaustiveDraw(state);
  const notenPlayers = PLAYER_IDS.filter((playerId) => !tenpaiPlayers.includes(playerId));
  const pointDeltas = calculateNotenPenaltyDeltas(tenpaiPlayers);
  const dealerTenpai = tenpaiPlayers.includes(state.dealer);
  const dealerContinues = config.dealerContinuesOnTenpaiDraw ? dealerTenpai : dealerTenpai;
  return {
    type: 'exhaustive-draw',
    tenpaiPlayers,
    notenPlayers,
    scoreDeltas: pointDeltas,
    pointDeltas,
    dealerContinues,
    honbaIncrement: 1,
    riichiSticksCarryOver: true,
    revealHands: config.revealTenpaiHandsOnDraw ? tenpaiPlayers : [],
  };
}

export function settleExhaustiveDraw(state: GameState): GameState {
  const result = buildExhaustiveDrawResult(state);
  return {
    ...state,
    phase: 'round-ended',
    result,
    honba: state.honba + result.honbaIncrement,
    players: state.players.map((player, index) => ({
      ...player,
      score: player.score + (result.pointDeltas[index] ?? 0),
    })),
  };
}
