import { evaluateWin } from './scoreCalculator';
import { createScoringWinContext } from './score/scoringAdapter';
import type { FuritenState, GameState, PlayerId, Tile, TileId } from './types';

export type FullFuritenState = FuritenState & {
  discardFuriten: boolean;
};

export function baseFuritenState(): FuritenState {
  return {
    temporaryFuriten: false,
    riichiPermanentFuriten: false,
  };
}

export function normalizeFuritenState(state?: FuritenState): FuritenState {
  return {
    temporaryFuriten: state?.temporaryFuriten ?? false,
    riichiPermanentFuriten: state?.riichiPermanentFuriten ?? false,
  };
}

export function getRonWinningTileIds(state: GameState, playerId: PlayerId): TileId[] {
  const player = state.players[playerId];
  if (!player) return [];

  const waits = new Set<TileId>();
  for (let id = 0; id < 34; id += 1) {
    const winningTile = testTile(id as TileId);
    const score = evaluateWin([...player.hand, winningTile], createScoringWinContext({
      state,
      playerId,
      winningTile,
      winType: 'ron',
      preWinHand: player.hand,
      winningTileSource: 'discard',
    }));
    if (score.isWinning && hasRealYaku(score.yaku)) waits.add(id as TileId);
  }
  return [...waits];
}

export function getFuritenState(state: GameState, playerId: PlayerId): FullFuritenState {
  const player = state.players[playerId];
  const stored = normalizeFuritenState(player?.furitenState);
  const waits = getRonWinningTileIds(state, playerId);
  const waitSet = new Set(waits);
  const discardFuriten = !!player && player.river.some((tile) => waitSet.has(tile.id));
  return {
    discardFuriten,
    ...stored,
  };
}

export function canRonWithFuritenCheck(state: GameState, playerId: PlayerId): boolean {
  const furiten = getFuritenState(state, playerId);
  return !furiten.discardFuriten && !furiten.temporaryFuriten && !furiten.riichiPermanentFuriten;
}

function hasRealYaku(yaku: { han: number; yakuman?: boolean }[]): boolean {
  return yaku.some((item) => item.han > 0 || item.yakuman);
}

function testTile(id: TileId): Tile {
  return {
    id,
    suit: id < 9 ? 'man' : id < 18 ? 'pin' : id < 27 ? 'sou' : 'honor',
    rank: id < 27 ? (id % 9) + 1 : id - 26,
    red: false,
    instanceId: `furiten-test-${id}`,
  };
}
