import type { Tile, TileId } from '../types';
import { tilesToCounts } from '../tileCounts';
import type { HandShape } from './yakuChecker';
import type { ScoringMeld, WaitType } from './scoringTypes';

export function classifyWaitFromTenpaiState(
  preWinHand: Tile[],
  winningTile: Tile,
  _fixedMelds: ScoringMeld[],
  finalShape: HandShape,
): WaitType {
  if (finalShape.pair === winningTile.id) return 'tanki';

  const counts = tilesToCounts(preWinHand);
  const winningTriplet = finalShape.melds.find((meld) => meld.type !== 'sequence' && meld.ids[0] === winningTile.id);
  if (winningTriplet && counts[winningTile.id] === 2) return 'shanpon';

  const sequence = finalShape.melds.find((meld) => meld.type === 'sequence' && meld.ids.includes(winningTile.id));
  if (!sequence) return 'ryanmen';
  return classifySequenceWait(sequence.ids as [TileId, TileId, TileId], winningTile.id);
}

function classifySequenceWait(ids: [TileId, TileId, TileId], winningId: TileId): WaitType {
  const [first, , third] = ids;
  if (winningId === first + 1) return 'kanchan';
  if ((first % 9 === 0 && winningId === third) || (first % 9 === 6 && winningId === first)) return 'penchan';
  return 'ryanmen';
}

