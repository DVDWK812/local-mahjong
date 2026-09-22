import { describe, expect, it } from 'vitest';
import { createTile } from '../../tileUtils';
import { evaluateWin, type WinContext } from '../../scoreCalculator';
import type { ScoringMeld } from '../scoringTypes';
import type { Tile, TileId, Wind } from '../../types';
import { calculateFu, calculateFuDetails, type FuContext, type FuMeld, type WaitType } from './fuCalculator';

function tile(id: TileId): Tile {
  return createTile(id, 0);
}

function tiles(ids: TileId[]): Tile[] {
  return ids.map((id, index) => createTile(id, index % 4));
}

function meld(type: FuMeld['type'], id: TileId, open = false): FuMeld {
  const length = type === 'kan' ? 4 : 3;
  if (type === 'sequence') return { type, ids: [id, (id + 1) as TileId, (id + 2) as TileId], open };
  return { type, ids: Array.from({ length }, () => id), open };
}

function ctx(overrides: Partial<FuContext> = {}): FuContext {
  const isTsumo = overrides.isTsumo ?? (overrides.winType === 'tsumo');
  const winType = overrides.winType ?? (isTsumo ? 'tsumo' : 'ron');
  return {
    hand: [],
    winningTile: tile(4),
    melds: [meld('sequence', 1), meld('sequence', 10), meld('sequence', 19), meld('sequence', 4)],
    pair: 14,
    waitType: 'ryanmen',
    winType,
    isMenzen: false,
    isTsumo,
    isRon: winType === 'ron',
    seatWind: 'south',
    roundWind: 'east',
    yakuList: [],
    ...overrides,
  };
}

function winContext(winTileId: TileId, overrides: Partial<WinContext> = {}): WinContext {
  return {
    winTile: tile(winTileId),
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

describe('fuCalculator - basic fu', () => {
  it('starts ordinary hands from a 20 fu base', () => {
    const result = calculateFuDetails(ctx());
    expect(result.totalBeforeRounding).toBe(20);
    expect(result.baseFu).toBe(20);
  });

  it('scores open pinfu-shaped ron as the minimum 30 fu', () => {
    const result = calculateFuDetails(ctx({ isMenzen: false, isRon: true, isTsumo: false, winType: 'ron' }));
    expect(result.totalBeforeRounding).toBe(20);
    expect(result.total).toBe(30);
  });

  it('adds 10 fu for closed ron', () => {
    expect(calculateFu(ctx({ isMenzen: true, isRon: true, isTsumo: false, winType: 'ron' }))).toBe(30);
  });

  it('adds 2 fu for tsumo and rounds 22 fu to 30 fu', () => {
    const result = calculateFuDetails(ctx({ isTsumo: true, isRon: false, winType: 'tsumo', melds: [meld('triplet', 1, true)] }));
    expect(result.winFu).toBe(2);
    expect(result.totalBeforeRounding).toBe(24);
    expect(result.total).toBe(30);
  });
});

describe('fuCalculator - wait fu', () => {
  it('adds 0 fu for ryanmen wait', () => {
    expect(calculateFuDetails(ctx({ waitType: 'ryanmen' })).waitFu).toBe(0);
  });

  it('adds 0 fu for shanpon wait itself', () => {
    expect(calculateFuDetails(ctx({ waitType: 'shanpon', melds: [meld('triplet', 1, true)] })).waitFu).toBe(0);
  });

  it.each([
    ['tanki', 'single tile pair wait'],
    ['kanchan', 'closed wait'],
    ['penchan', 'edge wait'],
  ] as [WaitType, string][])('adds 2 fu for %s (%s)', (waitType) => {
    const result = calculateFuDetails(ctx({ waitType }));
    expect(result.waitFu).toBe(2);
    expect(result.total).toBe(30);
  });
});

describe('fuCalculator - pair fu', () => {
  it('adds 0 fu for an ordinary pair', () => {
    expect(calculateFuDetails(ctx({ pair: 14 })).pairFu).toBe(0);
  });

  it('adds 2 fu for a dragon pair', () => {
    expect(calculateFuDetails(ctx({ pair: 31 })).pairFu).toBe(2);
  });

  it('adds 2 fu for a round wind pair', () => {
    expect(calculateFuDetails(ctx({ pair: 27, roundWind: 'east' })).pairFu).toBe(2);
  });

  it('adds 2 fu for a seat wind pair', () => {
    expect(calculateFuDetails(ctx({ pair: 28, seatWind: 'south' })).pairFu).toBe(2);
  });

  it('uses RuleConfig.doubleWindPairFu for seat wind plus round wind pair', () => {
    const base = {
      pair: 27 as TileId,
      seatWind: 'east' as Wind,
      roundWind: 'east' as Wind,
      waitType: 'tanki' as WaitType,
      isTsumo: true,
      isRon: false,
      winType: 'tsumo' as const,
      melds: [meld('triplet', 0, true)],
    };
    expect(calculateFuDetails(ctx({ ...base, ruleConfig: { doubleWindPairFu: true } })).pairFu).toBe(4);
    expect(calculateFuDetails(ctx({ ...base, ruleConfig: { doubleWindPairFu: false } })).pairFu).toBe(2);
  });
});

describe('fuCalculator - triplet fu', () => {
  it('adds 2 fu for open simple triplet', () => {
    expect(calculateFuDetails(ctx({ melds: [meld('triplet', 1, true)] })).meldFu).toBe(2);
  });

  it('adds 4 fu for open terminal or honor triplet', () => {
    expect(calculateFuDetails(ctx({ melds: [meld('triplet', 0, true)] })).meldFu).toBe(4);
  });

  it('adds 4 fu for closed simple triplet', () => {
    expect(calculateFuDetails(ctx({ melds: [meld('triplet', 1, false)] })).meldFu).toBe(4);
  });

  it('adds 8 fu for closed terminal or honor triplet', () => {
    expect(calculateFuDetails(ctx({ melds: [meld('triplet', 27, false)] })).meldFu).toBe(8);
  });
});

describe('fuCalculator - kan fu', () => {
  it('adds 8 fu for open simple kan', () => {
    expect(calculateFuDetails(ctx({ melds: [meld('kan', 1, true)] })).meldFu).toBe(8);
  });

  it('adds 16 fu for open terminal or honor kan', () => {
    expect(calculateFuDetails(ctx({ melds: [meld('kan', 0, true)] })).meldFu).toBe(16);
  });

  it('adds 16 fu for closed simple kan', () => {
    expect(calculateFuDetails(ctx({ melds: [meld('kan', 1, false)] })).meldFu).toBe(16);
  });

  it('adds 32 fu for closed terminal or honor kan', () => {
    expect(calculateFuDetails(ctx({ melds: [meld('kan', 31, false)] })).meldFu).toBe(32);
  });
});

describe('fuCalculator - special hands', () => {
  it('returns fixed 25 fu for seven pairs', () => {
    const result = calculateFuDetails(ctx({ melds: [], pair: null, yakuList: [{ id: 'chiitoitsu', name: '七对子', category: 'normal', han: 2, openAllowed: false }] }));
    expect(result.fixedReason).toBe('seven-pairs');
    expect(result.total).toBe(25);
  });

  it('returns fixed 20 fu for pinfu tsumo', () => {
    const result = calculateFuDetails(ctx({ isMenzen: true, isTsumo: true, isRon: false, winType: 'tsumo' }));
    expect(result.fixedReason).toBe('pinfu-tsumo');
    expect(result.total).toBe(20);
  });
});

describe('fuCalculator - integrated examples', () => {
  it('scores closed ron pinfu plus tanyao as 30 fu', () => {
    const score = evaluateWin(tiles([1, 2, 3, 2, 3, 4, 12, 13, 14, 23, 24, 25, 13, 13]), winContext(25));
    expect(score.yaku.some((yaku) => yaku.name === '平和')).toBe(true);
    expect(score.yaku.some((yaku) => yaku.name === '断幺九')).toBe(true);
    expect(score.fu).toBe(30);
  });

  it('scores closed tsumo pinfu as a fixed 20 fu without tsumo fu', () => {
    const score = evaluateWin(
      tiles([1, 2, 3, 2, 3, 4, 12, 13, 14, 23, 24, 25, 13, 13]),
      winContext(25, { isTsumo: true, winType: 'tsumo' }),
    );
    expect(score.yaku.some((yaku) => yaku.name === '平和')).toBe(true);
    expect(score.fu).toBe(20);
  });

  it('keeps an open pinfu-shaped hand non-pinfu and at the 30 fu minimum', () => {
    const calledTiles = tiles([1, 2, 3]);
    const melds: ScoringMeld[] = [{
      type: 'sequence',
      ids: [1, 2, 3],
      tiles: calledTiles,
      open: true,
      calledTile: calledTiles[2],
    }];
    const score = evaluateWin(
      tiles([2, 3, 4, 12, 13, 14, 23, 24, 25, 13, 13]),
      winContext(25, { isMenzen: false, melds }),
    );
    expect(score.yaku.some((yaku) => yaku.name === '平和')).toBe(false);
    expect(score.fu).toBe(30);
  });

  it('scores open honitsu plus toitoi with triplet fu', () => {
    const result = calculateFuDetails(ctx({
      isMenzen: false,
      isRon: true,
      isTsumo: false,
      winType: 'ron',
      pair: 33,
      waitType: 'shanpon',
      melds: [meld('triplet', 0, true), meld('triplet', 1, true), meld('triplet', 8, true), meld('triplet', 27, true)],
      yakuList: [
        { id: 'honitsu', name: '混一色', category: 'normal', han: 2, openAllowed: true },
        { id: 'toitoi', name: '对对和', category: 'normal', han: 2, openAllowed: true },
      ],
    }));
    expect(result.totalBeforeRounding).toBe(36);
    expect(result.total).toBe(40);
  });

  it('scores a hand with closed triplet, open kan, and yakuhai pair', () => {
    const result = calculateFuDetails(ctx({
      isMenzen: false,
      pair: 31,
      waitType: 'ryanmen',
      melds: [meld('triplet', 1, false), meld('kan', 0, true), meld('sequence', 9, true), meld('sequence', 18, true)],
    }));
    expect(result.pairFu).toBe(2);
    expect(result.meldFu).toBe(20);
    expect(result.total).toBe(50);
  });

  it('treats a ron shanpon triplet as open through the compatibility path', () => {
    const score = evaluateWin(tiles([1, 1, 1, 9, 10, 11, 18, 19, 20, 3, 4, 5, 14, 14]), winContext(1, { isMenzen: false, isTsumo: false }));
    expect(score.fu).toBe(30);
  });

  it('treats a tsumo shanpon triplet as closed through the compatibility path', () => {
    const score = evaluateWin(tiles([1, 1, 1, 9, 10, 11, 18, 19, 20, 3, 4, 5, 14, 14]), winContext(1, { isMenzen: false, isTsumo: true }));
    expect(score.fu).toBe(30);
  });
});
