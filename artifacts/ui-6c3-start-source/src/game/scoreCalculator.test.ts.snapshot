import { describe, expect, it } from 'vitest';
import { calculatePoints, evaluateWin, type WinContext } from './scoreCalculator';
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

function context(winTileId: TileId, overrides: Partial<WinContext> = {}): WinContext {
  return {
    winTile: createTile(winTileId, 0),
    isTsumo: true,
    isRiichi: false,
    isIppatsu: false,
    isMenzen: true,
    roundWind: 'east',
    seatWind: 'south',
    doraIndicators: [],
    uraDoraIndicators: [],
    honba: 0,
    riichiSticks: 0,
    ...overrides,
  };
}

function han(handIds: TileId[], overrides: Partial<WinContext> = {}): number {
  return evaluateWin(tiles(handIds), context(handIds[handIds.length - 1], overrides)).han;
}

describe('scoreCalculator - yaku detection', () => {
  it('adds 1 han for riichi', () => {
    const hand = [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14, 14] as TileId[];
    expect(han(hand, { isRiichi: true })).toBe(han(hand, { isRiichi: false }) + 1);
  });

  it('adds 1 han for menzen tsumo compared with a non-tsumo context', () => {
    const hand = [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14, 14] as TileId[];
    expect(han(hand, { isTsumo: true, isMenzen: true })).toBe(han(hand, { isTsumo: false, isMenzen: true }) + 1);
  });

  it('detects tanyao on an all-simples hand', () => {
    const allSimples = [1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14, 14] as TileId[];
    const withTerminal = [0, 1, 2, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14, 14] as TileId[];
    expect(han(allSimples, { isTsumo: false, isMenzen: false })).toBeGreaterThan(han(withTerminal, { isTsumo: false, isMenzen: false }));
  });

  it('calculates pinfu tsumo as fixed 20 fu on a ryanmen wait', () => {
    const score = evaluateWin(tiles([1, 2, 3, 2, 3, 4, 10, 11, 12, 20, 21, 22, 14, 14]), context(4));
    expect(score.isWinning).toBe(true);
    expect(score.fu).toBe(20);
  });

  it('detects seven pairs and assigns 25 fu', () => {
    const score = evaluateWin(tiles([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 18, 18, 27, 27]), context(27));
    expect(score.isWinning).toBe(true);
    expect(score.shape?.type).toBe('seven-pairs');
    expect(score.fu).toBe(25);
  });

  it('detects yakuhai from a dragon triplet', () => {
    const score = evaluateWin(tiles([31, 31, 31, 0, 1, 2, 9, 10, 11, 18, 19, 20, 5, 5]), context(5, {
      isTsumo: false,
      isMenzen: false,
      roundWind: 'south',
      seatWind: 'west',
    }));
    expect(score.isWinning).toBe(true);
    expect(score.han).toBeGreaterThanOrEqual(1);
  });

  it('detects toitoi on an all-triplet hand', () => {
    const score = evaluateWin(tiles([1, 1, 1, 10, 10, 10, 19, 19, 19, 27, 27, 27, 5, 5]), context(5, {
      isTsumo: false,
      isMenzen: false,
      roundWind: 'south',
      seatWind: 'west',
    }));
    expect(score.isWinning).toBe(true);
    expect(score.shape?.melds.every((meld) => meld.type === 'triplet')).toBe(true);
    expect(score.han).toBeGreaterThanOrEqual(2);
  });

  it('detects honitsu on a one-suit hand with honors', () => {
    const score = evaluateWin(tiles([0, 1, 2, 3, 4, 5, 6, 7, 8, 27, 27, 27, 31, 31]), context(31, {
      isTsumo: false,
      isMenzen: false,
      roundWind: 'south',
      seatWind: 'west',
    }));
    expect(score.isWinning).toBe(true);
    expect(score.han).toBeGreaterThanOrEqual(2);
  });

  it('detects chinitsu on a pure one-suit hand', () => {
    const score = evaluateWin(tiles([0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 3]), context(3, {
      isTsumo: false,
      isMenzen: false,
    }));
    expect(score.isWinning).toBe(true);
    expect(score.han).toBeGreaterThanOrEqual(5);
  });
});

describe('scoreCalculator - dora and points', () => {
  it('counts dora and red dora', () => {
    const hand = tiles([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 6, 6]);
    hand[4].red = true;
    const score = evaluateWin(hand, context(6, { doraIndicators: [createTile(5, 0)] }));
    expect(score.dora).toBe(2);
    expect(score.redDora).toBe(1);
  });

  it('counts dora, ura dora, and red dora separately', () => {
    const hand = tiles([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 6, 6]);
    hand[4].red = true;
    const score = evaluateWin(hand, context(6, {
      doraIndicators: [createTile(5, 0)],
      uraDoraIndicators: [createTile(3, 0)],
    }));
    expect(score.dora).toBe(2);
    expect(score.uraDora).toBe(1);
    expect(score.redDora).toBe(1);
    expect(score.han).toBeGreaterThanOrEqual(4);
  });

  it('calculates dealer ron points', () => {
    const points = calculatePoints(1, 30, context(0, { isTsumo: false, seatWind: 'east' }));
    expect(points.ron).toBe(1500);
    expect(points.total).toBe(1500);
  });

  it('calculates dealer tsumo points', () => {
    const points = calculatePoints(1, 30, context(0, { isTsumo: true, seatWind: 'east' }));
    expect(points.tsumoChild).toBe(500);
    expect(points.total).toBe(1500);
  });

  it('calculates child ron points', () => {
    const points = calculatePoints(1, 30, context(0, { isTsumo: false, seatWind: 'south' }));
    expect(points.ron).toBe(1000);
    expect(points.total).toBe(1000);
  });

  it('calculates child tsumo points', () => {
    const points = calculatePoints(1, 30, context(0, { isTsumo: true, seatWind: 'south' }));
    expect(points.tsumoDealer).toBe(500);
    expect(points.tsumoChild).toBe(300);
    expect(points.total).toBe(1100);
  });

  it('adds honba and riichi stick bonuses to ron total', () => {
    const points = calculatePoints(1, 30, context(0, {
      isTsumo: false,
      seatWind: 'south',
      honba: 2,
      riichiSticks: 1,
    }));
    expect(points.ron).toBe(2600);
    expect(points.total).toBe(2600);
  });
});

describe('scoreCalculator - call-aware scoring', () => {
  it('distinguishes open kan and closed kan fu from scoring meld state', () => {
    const concealed = tiles([1, 2, 3, 10, 11, 12, 19, 20, 21, 14, 14]);
    const openKanScore = evaluateWin(concealed, context(14, {
      isTsumo: false,
      isMenzen: false,
      melds: [{
        type: 'kan',
        tiles: tiles([0, 0, 0, 0]),
        ids: [0, 0, 0, 0],
        open: true,
        kanType: 'minkan',
      }],
    }));
    const closedKanScore = evaluateWin(concealed, context(14, {
      isTsumo: false,
      isMenzen: true,
      melds: [{
        type: 'kan',
        tiles: tiles([0, 0, 0, 0]),
        ids: [0, 0, 0, 0],
        open: false,
        kanType: 'ankan',
      }],
    }));
    expect(openKanScore.fu).toBe(40);
    expect(closedKanScore.fu).toBe(70);
  });

  it('classifies wait shape from the tenpai hand before adding the winning tile', () => {
    const score = evaluateWin(tiles([0, 2, 9, 10, 11, 18, 19, 20, 3, 4, 5, 14, 14, 1]), context(1, {
      isTsumo: false,
      preWinHand: tiles([0, 2, 9, 10, 11, 18, 19, 20, 3, 4, 5, 14, 14]),
    }));
    expect(score.fu).toBe(40);
  });
});
