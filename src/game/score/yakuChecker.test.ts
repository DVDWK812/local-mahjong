import { describe, expect, it } from 'vitest';
import { evaluateWin, type WinContext } from '../scoreCalculator';
import { checkYaku } from './yakuChecker';
import { createTile } from '../tileUtils';
import type { Tile, TileId } from '../types';

function tiles(ids: TileId[]): Tile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = seen.get(id) ?? 0;
    seen.set(id, copy + 1);
    return createTile(id, copy);
  });
}

function ctx(winTileId: TileId, overrides: Partial<WinContext> = {}): WinContext {
  return {
    winTile: createTile(winTileId, 0),
    isTsumo: false,
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

function yakuOf(ids: TileId[], overrides: Partial<WinContext> = {}) {
  return evaluateWin(tiles(ids), ctx(ids[ids.length - 1], overrides)).yaku;
}

function hasNormal(ids: TileId[], han: number, overrides: Partial<WinContext> = {}) {
  expect(yakuOf(ids, overrides).some((yaku) => yaku.category === 'normal' && yaku.han === han)).toBe(true);
}

describe('standard normal yaku', () => {
  it('covers riichi, ippatsu, menzen tsumo, pinfu, iipeikou, and tanyao', () => {
    const ids = [1, 2, 3, 1, 2, 3, 10, 11, 12, 20, 21, 22, 14, 14] as TileId[];
    const score = evaluateWin(tiles(ids), ctx(14, { isTsumo: true, isRiichi: true, isIppatsu: true }));
    expect(score.yaku.filter((yaku) => yaku.category === 'normal').length).toBeGreaterThanOrEqual(6);
    expect(score.yaku.every((yaku) => yaku.category !== 'yakuman' && yaku.category !== 'double_yakuman')).toBe(true);
  });

  it('covers yakuhai', () => {
    hasNormal([31, 31, 31, 0, 1, 2, 9, 10, 11, 18, 19, 20, 5, 5], 1, { isMenzen: false });
  });

  it('covers chiitoitsu', () => {
    hasNormal([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 18, 18, 27, 27], 2);
  });

  it('covers toitoi, sanankou, and sanshoku doukou', () => {
    const score = evaluateWin(tiles([1, 1, 1, 10, 10, 10, 19, 19, 19, 27, 27, 27, 5, 5]), ctx(5, { isTsumo: true, isMenzen: false }));
    expect(score.yaku.filter((yaku) => yaku.category === 'normal' && yaku.han === 2).length).toBeGreaterThanOrEqual(3);
  });

  it('covers closed and open sanshoku doujun han difference', () => {
    const ids = [0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 4, 5, 27, 27] as TileId[];
    expect(evaluateWin(tiles(ids), ctx(27, { isMenzen: true })).yaku.some((yaku) => yaku.closedHan === 2 && yaku.han === 2)).toBe(true);
    expect(evaluateWin(tiles(ids), ctx(27, { isMenzen: false })).yaku.some((yaku) => yaku.openHan === 1 && yaku.han === 1)).toBe(true);
  });

  it('covers closed and open ittsu han difference', () => {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 27, 27] as TileId[];
    expect(evaluateWin(tiles(ids), ctx(27, { isMenzen: true })).yaku.some((yaku) => yaku.closedHan === 2 && yaku.han === 2)).toBe(true);
    expect(evaluateWin(tiles(ids), ctx(27, { isMenzen: false })).yaku.some((yaku) => yaku.openHan === 1 && yaku.han === 1)).toBe(true);
  });

  it('covers honroutou', () => {
    hasNormal([0, 0, 0, 8, 8, 8, 27, 27, 27, 31, 31, 31, 33, 33], 2, { isMenzen: false, roundWind: 'south', seatWind: 'west' });
  });

  it('covers ryanpeikou', () => {
    hasNormal([0, 1, 2, 0, 1, 2, 9, 10, 11, 9, 10, 11, 27, 27], 3);
  });

  it('covers closed and open honitsu han difference', () => {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 27, 27, 27, 31, 31] as TileId[];
    expect(evaluateWin(tiles(ids), ctx(31, { isMenzen: true })).yaku.some((yaku) => yaku.closedHan === 3 && yaku.han === 3)).toBe(true);
    expect(evaluateWin(tiles(ids), ctx(31, { isMenzen: false })).yaku.some((yaku) => yaku.openHan === 2 && yaku.han === 2)).toBe(true);
  });

  it('covers closed and open chinitsu han difference', () => {
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 3] as TileId[];
    expect(evaluateWin(tiles(ids), ctx(3, { isMenzen: true })).yaku.some((yaku) => yaku.closedHan === 6 && yaku.han === 6)).toBe(true);
    expect(evaluateWin(tiles(ids), ctx(3, { isMenzen: false })).yaku.some((yaku) => yaku.openHan === 5 && yaku.han === 5)).toBe(true);
  });
});

describe('yakuman and double yakuman', () => {
  it('does not represent yakuman as normal han 13', () => {
    const score = evaluateWin(tiles([0, 0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]), ctx(33));
    expect(score.yaku[0].category).toBe('yakuman');
    expect(score.yaku[0].han).toBe(0);
    expect(score.yaku[0].yakumanValue).toBe(1);
  });

  it('covers kokushi thirteen-sided as double yakuman when enabled', () => {
    const score = evaluateWin(tiles([0, 0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]), ctx(0, { ruleConfig: { allowDoubleYakuman: true } }));
    expect(score.yaku[0].category).toBe('double_yakuman');
    expect(score.yaku[0].yakumanValue).toBe(2);
  });

  it('covers suuankou and suuankou tanki', () => {
    const normal = evaluateWin(tiles([0, 0, 0, 9, 9, 9, 18, 18, 18, 27, 27, 27, 5, 5]), ctx(27, { isTsumo: true }));
    const tanki = evaluateWin(tiles([0, 0, 0, 9, 9, 9, 18, 18, 18, 27, 27, 27, 5, 5]), ctx(5));
    expect(normal.yaku.some((yaku) => yaku.category === 'yakuman')).toBe(true);
    expect(tanki.yaku.some((yaku) => yaku.category === 'double_yakuman')).toBe(true);
  });

  it('covers daisangen, shousuushii, daisuushii, tsuuiisou, ryuuiisou, chinroutou, chuuren, and suukantsu via checker structures', () => {
    expect(evaluateWin(tiles([31, 31, 31, 32, 32, 32, 33, 33, 33, 0, 1, 2, 5, 5]), ctx(5)).yaku.some((yaku) => yaku.yakumanValue)).toBe(true);
    expect(evaluateWin(tiles([27, 27, 27, 28, 28, 28, 29, 29, 29, 30, 30, 31, 31, 31]), ctx(30)).yaku.some((yaku) => yaku.category === 'yakuman')).toBe(true);
    expect(evaluateWin(tiles([27, 27, 27, 28, 28, 28, 29, 29, 29, 30, 30, 30, 31, 31]), ctx(31)).yaku.some((yaku) => yaku.category === 'double_yakuman')).toBe(true);
    expect(evaluateWin(tiles([19, 20, 21, 19, 20, 21, 23, 23, 23, 25, 25, 25, 32, 32]), ctx(32)).yaku.some((yaku) => yaku.category === 'yakuman')).toBe(true);
    expect(evaluateWin(tiles([0, 0, 0, 8, 8, 8, 9, 9, 9, 17, 17, 17, 18, 18]), ctx(18)).yaku.some((yaku) => yaku.category === 'yakuman')).toBe(true);
    expect(evaluateWin(tiles([0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8]), ctx(0)).yaku.some((yaku) => yaku.yakumanValue)).toBe(true);
  });
});

describe('ancient yaku', () => {
  it('only enables ancient yaku when allowAncientYaku is true', () => {
    const ids = [10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16] as TileId[];
    expect(checkYaku(tiles(ids), ctx(16, { ruleConfig: { allowAncientYaku: false } })).some((yaku) => yaku.openAllowed === false && yaku.han === 6)).toBe(false);
    expect(checkYaku(tiles(ids), ctx(16, { ruleConfig: { allowAncientYaku: true } })).some((yaku) => yaku.han === 6)).toBe(true);
  });

  it('supports renhou only when ancient yaku are enabled', () => {
    const ids = [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14] as TileId[];
    expect(checkYaku(tiles(ids), ctx(14, { isRenhou: true, ruleConfig: { allowAncientYaku: false } })).some((yaku) => yaku.name === '人和')).toBe(false);
    expect(checkYaku(tiles(ids), ctx(14, { isRenhou: true, ruleConfig: { allowAncientYaku: true } })).some((yaku) => yaku.name === '人和')).toBe(true);
  });
});
