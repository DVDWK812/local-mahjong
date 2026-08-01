import type { GameState, RoundResult } from './types';

export function settleRoundState(state: GameState, result: RoundResult): GameState {
  const isWin = result.type === 'ron' || result.type === 'tsumo';
  const settledResult: RoundResult = result.settlementRiichiSticks === undefined
    ? { ...result, settlementRiichiSticks: state.riichiSticks }
    : result;

  return {
    ...state,
    phase: 'round-ended',
    result: settledResult,
    riichiSticks: isWin ? 0 : state.riichiSticks,
    honba: result.type === 'abortive-draw' || result.type === 'exhaustive-draw'
      ? state.honba + result.honbaIncrement
      : state.honba,
    players: state.players.map((player, index) => ({
      ...player,
      score: player.score + (result.pointDeltas[index] ?? 0),
      pendingRiichiSidewaysDiscard: false,
    })),
    kuikaeForbiddenTileIds: {},
  };
}
