import { describe, expect, it } from 'vitest';
import { evaluateWin, type WinContext } from '../../scoreCalculator';
import { createTile } from '../../tileUtils';
import type { Tile, TileId } from '../../types';

function tiles(ids: TileId[]): Tile[] {
  return ids.map((id, index) => createTile(id, index % 4));
}

function ctx(winTile: TileId, overrides: Partial<WinContext> = {}): WinContext {
  return {
    winTile: createTile(winTile, 0),
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

function names(ids: TileId[], context: Partial<WinContext> = {}) {
  const score = evaluateWin(tiles(ids), ctx(ids[ids.length - 1], context));
  return score.yaku.map((yaku) => yaku.name);
}

describe('remaining modern yaku', () => {
  it('detects haitei, houtei, rinshan, and chankan from WinContext', () => {
    const hand = [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14] as TileId[];
    expect(names(hand, { isTsumo: true, isHaitei: true })).toContain('海底摸月');
    expect(names(hand, { isTsumo: false, isHoutei: true })).toContain('河底捞鱼');
    expect(names(hand, { isTsumo: true, isRinshan: true, isHaitei: true })).toContain('岭上开花');
    expect(names(hand, { isTsumo: false, isChankan: true })).toContain('抢杠');
    expect(names(hand, { isTsumo: true, isRinshan: true, isHaitei: true })).not.toContain('海底摸月');
  });

  it('detects double riichi without also counting riichi', () => {
    const result = evaluateWin(tiles([1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14]), ctx(14, { isRiichi: true, isDoubleRiichi: true }));
    expect(result.yaku.map((yaku) => yaku.name)).toContain('双立直');
    expect(result.yaku.map((yaku) => yaku.name)).not.toContain('立直');
  });

  it('detects sankantsu from three real kan melds', () => {
    const score = evaluateWin(tiles([1, 2, 3, 14, 14]), ctx(14, {
      isMenzen: false,
      melds: [
        { type: 'kan', tiles: tiles([0, 0, 0, 0]), ids: [0, 0, 0, 0], open: false, kanType: 'ankan' },
        { type: 'kan', tiles: tiles([9, 9, 9, 9]), ids: [9, 9, 9, 9], open: true, kanType: 'minkan' },
        { type: 'kan', tiles: tiles([18, 18, 18, 18]), ids: [18, 18, 18, 18], open: true, kanType: 'kakan' },
      ],
    }));
    expect(score.yaku.map((yaku) => yaku.name)).toContain('三杠子');
  });

  it('detects shousangen and keeps the two yakuhai dragon yaku', () => {
    const score = evaluateWin(tiles([31, 31, 31, 32, 32, 32, 0, 1, 2, 9, 10, 11, 33, 33]), ctx(33, { isMenzen: false }));
    expect(score.yaku.map((yaku) => yaku.name)).toContain('小三元');
    expect(score.yaku.filter((yaku) => yaku.name.startsWith('役牌')).length).toBe(2);
  });

  it('does not count shousangen when daisangen is yakuman', () => {
    const score = evaluateWin(tiles([31, 31, 31, 32, 32, 32, 33, 33, 33, 0, 1, 2, 5, 5]), ctx(5));
    expect(score.yaku.map((yaku) => yaku.name)).toContain('大三元');
    expect(score.yaku.map((yaku) => yaku.name)).not.toContain('小三元');
  });

  it('detects closed and open chanta', () => {
    const hand = [0, 1, 2, 6, 7, 8, 17, 17, 17, 31, 31, 31, 27, 27] as TileId[];
    expect(evaluateWin(tiles(hand), ctx(27, { isMenzen: true })).yaku.some((yaku) => yaku.name === '混全带幺九' && yaku.han === 2)).toBe(true);
    expect(evaluateWin(tiles(hand), ctx(27, { isMenzen: false })).yaku.some((yaku) => yaku.name === '混全带幺九' && yaku.han === 1)).toBe(true);
  });

  it('requires at least one sequence for chanta', () => {
    const hand = [0, 0, 0, 8, 8, 8, 27, 27, 27, 31, 31, 31, 33, 33] as TileId[];
    expect(evaluateWin(tiles(hand), ctx(33, { isMenzen: false })).yaku.map((yaku) => yaku.name)).not.toContain('混全带幺九');
  });

  it('detects closed and open junchan without also counting chanta', () => {
    const hand = [0, 1, 2, 6, 7, 8, 9, 10, 11, 24, 25, 26, 17, 17] as TileId[];
    expect(evaluateWin(tiles(hand), ctx(17, { isMenzen: true })).yaku.some((yaku) => yaku.name === '纯全带幺九' && yaku.han === 3)).toBe(true);
    const open = evaluateWin(tiles(hand), ctx(17, { isMenzen: false }));
    expect(open.yaku.some((yaku) => yaku.name === '纯全带幺九' && yaku.han === 2)).toBe(true);
    expect(open.yaku.map((yaku) => yaku.name)).not.toContain('混全带幺九');
  });

  it('does not detect junchan when honors are present', () => {
    const hand = [0, 1, 2, 6, 7, 8, 9, 10, 11, 24, 25, 26, 27, 27] as TileId[];
    expect(evaluateWin(tiles(hand), ctx(27)).yaku.map((yaku) => yaku.name)).not.toContain('纯全带幺九');
  });

  it('detects tenhou and chiihou as yakuman', () => {
    const hand = [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14] as TileId[];
    expect(evaluateWin(tiles(hand), ctx(14, { isTsumo: true, isTenhou: true, seatWind: 'east' })).yaku[0].name).toBe('天和');
    expect(evaluateWin(tiles(hand), ctx(14, { isTsumo: true, isChiihou: true, seatWind: 'south' })).yaku[0].name).toBe('地和');
  });
});

