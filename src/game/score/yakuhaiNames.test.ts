import { describe, expect, it } from 'vitest';
import { evaluateWin, type WinContext } from '../scoreCalculator';
import { createTile } from '../tileUtils';
import type { Tile, TileId, Wind } from '../types';

function tiles(ids: TileId[]): Tile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = seen.get(id) ?? 0;
    seen.set(id, copy + 1);
    return createTile(id, copy);
  });
}

function context(winTileId: TileId, overrides: Partial<WinContext> = {}): WinContext {
  return {
    winTile: createTile(winTileId, 0),
    isTsumo: false,
    isRiichi: false,
    isIppatsu: false,
    isMenzen: false,
    roundWind: 'east',
    seatWind: 'south',
    doraIndicators: [],
    uraDoraIndicators: [],
    honba: 0,
    riichiSticks: 0,
    ...overrides,
  };
}

function namesForTriplet(id: TileId, roundWind: Wind = 'east', seatWind: Wind = 'south'): string[] {
  const score = evaluateWin(tiles([id, id, id, 1, 2, 3, 10, 11, 12, 19, 20, 21, 13, 13]), context(13, {
    roundWind,
    seatWind,
  }));
  return score.yaku.map((yaku) => yaku.name);
}

describe('yakuhai names', () => {
  it('红中、白板、发财显示具体三元牌役牌名称', () => {
    expect(namesForTriplet(33)).toContain('役牌·中');
    expect(namesForTriplet(31)).toContain('役牌·白');
    expect(namesForTriplet(32)).toContain('役牌·发');
  });

  it('场风和自风分别显示具体座风名称', () => {
    expect(namesForTriplet(27, 'east', 'south')).toContain('场风·东');
    expect(namesForTriplet(28, 'east', 'south')).toContain('自风·南');
  });

  it('连风牌显示场风和自风两条役种，共2番', () => {
    const score = evaluateWin(tiles([27, 27, 27, 1, 2, 3, 10, 11, 12, 19, 20, 21, 13, 13]), context(13, {
      roundWind: 'east',
      seatWind: 'east',
    }));
    const yakuhai = score.yaku.filter((yaku) => yaku.name === '场风·东' || yaku.name === '自风·东');
    expect(yakuhai.map((yaku) => yaku.name)).toEqual(['场风·东', '自风·东']);
    expect(yakuhai.reduce((sum, yaku) => sum + yaku.han, 0)).toBe(2);
    expect(score.han).toBeGreaterThanOrEqual(2);
  });
});
