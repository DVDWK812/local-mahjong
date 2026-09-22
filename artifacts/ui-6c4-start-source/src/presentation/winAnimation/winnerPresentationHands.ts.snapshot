import type { GameState, PlayerId, Tile } from '../../game/types';
import { buildResultViewModel } from '../result/resultViewModel';
import type { Table3DSeat } from '../../presentation3d/coordinates/seatTransforms';

export type WinnerPresentationHand = Readonly<{
  playerId: PlayerId; tiles: readonly Tile[]; winningTile: Tile;
  drawnTileInstanceId: string | null; seat: Table3DSeat;
}>;

/** The result view model owns the split between concealed tiles and the winning tile. */
export function winnerPresentationHands(state: GameState, seatFor: (id: PlayerId) => Table3DSeat): readonly WinnerPresentationHand[] {
  const result = buildResultViewModel(state);
  return result?.kind === 'win' ? result.winners.map(winner => ({
    playerId: winner.source.winner, tiles: [...winner.concealedTiles, winner.winningTile],
    winningTile: winner.winningTile, drawnTileInstanceId: winner.source.winType === 'tsumo' ? winner.winningTile.instanceId : null,
    seat: seatFor(winner.source.winner),
  })) : [];
}
