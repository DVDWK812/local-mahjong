import type { CallSet, GameState, PlayerId, PlayerState, Tile } from '../types';
import type { ScoringMeld, WinningTileSource } from './scoringTypes';
import type { WinContext } from './yakuChecker';

export function callToScoringMeld(call: CallSet): ScoringMeld {
  const ids = call.type === 'chi' && call.sequence
    ? call.sequence
    : call.tiles.map((tile) => tile.id);
  return {
    type: call.type === 'chi' ? 'sequence' : call.type === 'pon' ? 'triplet' : 'kan',
    tiles: [...call.tiles],
    ids,
    open: call.type === 'kan' ? call.kanType !== 'ankan' : call.opened,
    kanType: call.kanType,
    calledTile: call.calledTile,
    calledFrom: call.from,
  };
}

export function callsToScoringMelds(calls: CallSet[]): ScoringMeld[] {
  return calls.map(callToScoringMeld);
}

export function isMenzenFromCalls(calls: CallSet[]): boolean {
  return calls.every((call) => call.type === 'kan' && call.kanType === 'ankan');
}

export function createScoringWinContext(params: {
  state: GameState;
  playerId: PlayerId;
  winningTile: Tile;
  winType: 'ron' | 'tsumo';
  preWinHand: Tile[];
  riichiSticks?: number;
  winningTileSource?: WinningTileSource;
}): WinContext {
  const { state, playerId, winningTile, winType, preWinHand } = params;
  const player: PlayerState = state.players[playerId];
  const callsOccurred = state.players.some((item) => item.calls.some((call) => call.type !== 'kan' || call.kanType !== 'ankan'));
  const winningTileSource = params.winningTileSource ?? inferWinningTileSource(state, playerId, winType, winningTile);
  return {
    winTile: winningTile,
    winningTile,
    winType,
    winningTileSource,
    isTsumo: winType === 'tsumo',
    isRiichi: player.riichi,
    isDoubleRiichi: player.riichiState?.kind === 'double-riichi',
    isIppatsu: player.riichiState?.ippatsuAvailable ?? false,
    isFirstTurn: (state.playerDiscardCounts[playerId] ?? 0) === 0,
    callsOccurred,
    isLastTile: state.wall.length === 0,
    isHaitei: winType === 'tsumo' && winningTileSource === 'normal-draw' && state.wall.length === 0,
    isHoutei: winType === 'ron' && state.lastLiveWallDiscarder === state.lastDiscard?.player,
    isRinshan: winType === 'tsumo' && winningTileSource === 'rinshan',
    isChankan: winningTileSource === 'kakan',
    isTenhou: winType === 'tsumo' && winningTileSource === 'initial-hand' && player.seatWind === 'east' && !callsOccurred,
    isChiihou: winType === 'tsumo' && winningTileSource === 'normal-draw' && player.seatWind !== 'east' && !callsOccurred && (state.playerDrawCounts[playerId] ?? 0) === 1 && (state.playerDiscardCounts[playerId] ?? 0) === 0,
    isRenhou: winType === 'ron' && player.seatWind !== 'east' && !state.firstTurnInterrupted && (state.playerDrawCounts[playerId] ?? 0) === 0,
    isRiichiDeclarationDiscardRon: winType === 'ron' && state.lastDiscard?.tile.instanceId === winningTile.instanceId && state.lastDiscard.tile.isRiichiDiscard === true,
    isAfterKanFirstDiscardRon: winType === 'ron' && state.kanState?.player === state.lastDiscard?.player && state.lastDrawSource === 'rinshan',
    isMenzen: isMenzenFromCalls(player.calls),
    roundWind: state.roundWind,
    seatWind: player.seatWind,
    doraIndicators: state.doraIndicators,
    uraDoraIndicators: player.riichi ? activeUraDoraIndicators(state) : [],
    honba: state.honba,
    riichiSticks: params.riichiSticks ?? state.riichiSticks,
    melds: callsToScoringMelds(player.calls),
    preWinHand,
    ruleConfig: state.ruleConfig,
  };
}

function activeUraDoraIndicators(state: GameState): Tile[] {
  return state.doraIndicators
    .map((_, index) => state.deadWall[9 + index])
    .filter((tile): tile is Tile => Boolean(tile));
}

function inferWinningTileSource(state: GameState, playerId: PlayerId, winType: 'ron' | 'tsumo', winningTile: Tile): WinningTileSource {
  if (winType === 'ron') return 'discard';
  const drawnTile = state.players[playerId]?.drawnTile;
  if (
    state.lastDrawSource === 'rinshan'
    && state.kanState?.player === playerId
    && drawnTile?.instanceId === winningTile.instanceId
  ) {
    return 'rinshan';
  }
  return 'normal-draw';
}
