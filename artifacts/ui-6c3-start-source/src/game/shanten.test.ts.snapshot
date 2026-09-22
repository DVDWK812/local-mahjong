import { describe, expect, it } from 'vitest';
import { idsToCounts, type TileCounts } from './tileCounts';
import { recommendDiscards, shanten, ukeire } from './shanten';
import { createTile } from './tileUtils';
import type { Tile, TileId } from './types';

function tiles(ids: TileId[]): Tile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copyIndex = seen.get(id) ?? 0;
    seen.set(id, copyIndex + 1);
    return createTile(id, copyIndex);
  });
}

function visibleCounts(ids: TileId[]): TileCounts {
  return idsToCounts(ids);
}

function idsOfWaits(handIds: TileId[], visibleIds: TileId[] = handIds): TileId[] {
  return ukeire(tiles(handIds), visibleCounts(visibleIds)).map((wait) => wait.id).sort((a, b) => a - b);
}

describe('shanten - standard hands', () => {
  it('returns 0 shanten for a 13-tile standard tenpai hand', () => {
    const hand = idsToCounts([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27]);
    expect(shanten(hand).standard).toBe(0);
  });

  it('returns 0 shanten for a 14-tile hand after discarding one isolated tile', () => {
    const hand = tiles([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27, 31]);
    const recommendations = recommendDiscards(hand, visibleCounts(hand.map((tile) => tile.id)));
    expect(recommendations[0].shanten).toBe(0);
  });

  it('returns 1 shanten for a standard hand with three melds and two loose tiles', () => {
    const hand = idsToCounts([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 20, 27, 31]);
    expect(shanten(hand).standard).toBe(1);
  });

  it('returns 2 shanten for a weaker standard hand', () => {
    const hand = idsToCounts([0, 1, 2, 3, 4, 12, 13, 24, 25, 27, 27, 31, 33]);
    expect(shanten(hand).standard).toBe(2);
  });
});

describe('shanten - special hands', () => {
  it('returns 0 shanten for seven pairs tenpai with 13 tiles', () => {
    const hand = idsToCounts([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 18, 18, 27]);
    expect(shanten(hand).sevenPairs).toBe(0);
  });

  it('returns 1 shanten for seven pairs with five pairs and three singletons', () => {
    const hand = idsToCounts([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 18, 19, 27]);
    expect(shanten(hand).sevenPairs).toBe(1);
  });

  it('returns 0 shanten for thirteen orphans tenpai with 13 unique terminals and honors', () => {
    const hand = idsToCounts([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
    expect(shanten(hand).thirteenOrphans).toBe(0);
  });

  it('returns 1 shanten for thirteen orphans missing two required tiles', () => {
    const hand = idsToCounts([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 5]);
    expect(shanten(hand).thirteenOrphans).toBe(1);
  });

  it('returns the minimum of standard, seven pairs, and thirteen orphans', () => {
    const hand = idsToCounts([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 18, 18, 27]);
    const result = shanten(hand);
    expect(result.best).toBe(Math.min(result.standard, result.sevenPairs, result.thirteenOrphans));
    expect(result.best).toBe(0);
  });
});

describe('ukeire', () => {
  it('returns the correct pair wait for a tenpai hand', () => {
    expect(idsOfWaits([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27])).toEqual([27]);
  });

  it('does not count a winning tile when all four copies are already visible', () => {
    const hand = [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27] as TileId[];
    const visible = [...hand, 27, 27, 27] as TileId[];
    expect(idsOfWaits(hand, visible)).not.toContain(27);
  });

  it('uses visibleTiles to reduce remaining tile count', () => {
    const hand = tiles([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27]);
    const visible = visibleCounts([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 27]);
    const wait = ukeire(hand, visible).find((tile) => tile.id === 27);
    expect(wait?.remaining).toBe(2);
  });

  it('detects a two-sided wait', () => {
    const waits = idsOfWaits([3, 4, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 27]);
    expect(waits).toEqual([2, 5]);
  });

  it('detects an edge wait', () => {
    const waits = idsOfWaits([0, 1, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 27]);
    expect(waits).toEqual([2]);
  });

  it('detects a closed wait', () => {
    const waits = idsOfWaits([0, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 27]);
    expect(waits).toEqual([1]);
  });

  it('detects a single-tile pair wait', () => {
    const waits = idsOfWaits([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 31]);
    expect(waits).toEqual([31]);
  });
});

describe('recommendDiscards', () => {
  it('returns Top 3 recommendations', () => {
    const hand = tiles([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27, 31]);
    const recommendations = recommendDiscards(hand, visibleCounts(hand.map((tile) => tile.id)));
    expect(recommendations).toHaveLength(3);
  });

  it('sorts recommendations by lower shanten first', () => {
    const hand = tiles([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27, 31]);
    const recommendations = recommendDiscards(hand, visibleCounts(hand.map((tile) => tile.id)));
    for (let i = 1; i < recommendations.length; i += 1) {
      expect(recommendations[i - 1].shanten).toBeLessThanOrEqual(recommendations[i].shanten);
    }
  });

  it('sorts equal-shanten recommendations by higher ukeire count first', () => {
    const hand = tiles([0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 18, 19, 27, 31]);
    const recommendations = recommendDiscards(hand, visibleCounts(hand.map((tile) => tile.id)));
    for (let i = 1; i < recommendations.length; i += 1) {
      if (recommendations[i - 1].shanten === recommendations[i].shanten) {
        expect(recommendations[i - 1].ukeireCount).toBeGreaterThanOrEqual(recommendations[i].ukeireCount);
      }
    }
  });

  it('does not recommend a tile that is not in the hand', () => {
    const hand = tiles([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27, 31]);
    const recommendationIds = recommendDiscards(hand, visibleCounts(hand.map((tile) => tile.id))).map((item) => item.tileId);
    expect(recommendationIds.every((id) => hand.some((tile) => tile.id === id))).toBe(true);
  });

  it('handles duplicate tiles as one discard candidate per tile kind', () => {
    const hand = tiles([0, 0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27]);
    const recommendationIds = recommendDiscards(hand, visibleCounts(hand.map((tile) => tile.id))).map((item) => item.tileId);
    expect(new Set(recommendationIds).size).toBe(recommendationIds.length);
  });
});
