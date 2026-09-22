import { describe, expect, it } from 'vitest';
import { createTile } from '../tileUtils';
import { checkYaku, countConcealedTripletLikeSets, type HandShape, type WinContext } from './yakuChecker';
import { NORMAL_YAKU } from './yaku/normal';
import { YAKUMAN_YAKU } from './yaku/yakuman';
import type { Tile, TileId } from '../types';

function tiles(ids: TileId[]): Tile[] {
  return ids.map((id, index) => createTile(id, index % 4));
}

function ctx(overrides: Partial<WinContext> = {}): WinContext {
  const winTile = createTile(6, 0);
  return {
    winTile,
    winningTile: winTile,
    winType: 'tsumo',
    isTsumo: true,
    isRiichi: false,
    isIppatsu: false,
    isMenzen: true,
    roundWind: 'east',
    seatWind: 'east',
    doraIndicators: [],
    uraDoraIndicators: [],
    honba: 0,
    riichiSticks: 0,
    ...overrides,
  };
}

function shape(melds: HandShape['melds']): HandShape {
  return { type: 'standard', pair: 27, melds };
}

describe('sanankou provenance-aware detection', () => {
  it('counts three concealed hand triplets as sanankou', () => {
    const handShape = shape([
      { type: 'triplet', ids: [0, 0, 0] },
      { type: 'triplet', ids: [9, 9, 9] },
      { type: 'triplet', ids: [18, 18, 18] },
      { type: 'sequence', ids: [3, 4, 5] },
    ]);
    const context = ctx();
    expect(countConcealedTripletLikeSets(handShape, context)).toBe(3);
    expect(checkYaku(tiles([0, 0, 0, 9, 9, 9, 18, 18, 18, 3, 4, 5, 27, 27]), context, handShape).map((yaku) => yaku.name)).toContain(NORMAL_YAKU.sanankou().name);
  });

  it('counts two concealed triplets plus an ankan', () => {
    const handShape = shape([
      { type: 'triplet', ids: [0, 0, 0] },
      { type: 'triplet', ids: [9, 9, 9] },
      { type: 'kan', ids: [18, 18, 18, 18], source: 'call', open: false, kanType: 'ankan' },
      { type: 'sequence', ids: [3, 4, 5] },
    ]);
    expect(countConcealedTripletLikeSets(handShape, ctx())).toBe(3);
  });

  it('does not count pon, minkan, or kakan as concealed triplet-like sets', () => {
    const base = [
      { type: 'triplet' as const, ids: [0, 0, 0] as TileId[] },
      { type: 'triplet' as const, ids: [9, 9, 9] as TileId[] },
      { type: 'sequence' as const, ids: [3, 4, 5] as TileId[] },
    ];
    expect(countConcealedTripletLikeSets(shape([...base, { type: 'triplet', ids: [18, 18, 18], source: 'call', open: true }]), ctx())).toBe(2);
    expect(countConcealedTripletLikeSets(shape([...base, { type: 'kan', ids: [18, 18, 18, 18], source: 'call', open: true, kanType: 'minkan' }]), ctx())).toBe(2);
    expect(countConcealedTripletLikeSets(shape([...base, { type: 'kan', ids: [18, 18, 18, 18], source: 'call', open: true, kanType: 'kakan' }]), ctx())).toBe(2);
  });

  it('treats a shanpon ron completed triplet as open and shanpon tsumo as concealed', () => {
    const handShape = shape([
      { type: 'triplet', ids: [0, 0, 0] },
      { type: 'triplet', ids: [9, 9, 9] },
      { type: 'triplet', ids: [18, 18, 18] },
      { type: 'sequence', ids: [3, 4, 5] },
    ]);
    const ronContext = ctx({ winType: 'ron', isTsumo: false, waitType: 'shanpon', winTile: createTile(18, 0), winningTile: createTile(18, 0) });
    const tsumoContext = ctx({ winType: 'tsumo', isTsumo: true, waitType: 'shanpon', winTile: createTile(18, 0), winningTile: createTile(18, 0) });
    expect(countConcealedTripletLikeSets(handShape, ronContext)).toBe(2);
    expect(countConcealedTripletLikeSets(handShape, tsumoContext)).toBe(3);
  });

  it('does not add sanankou when suuankou yakuman is present', () => {
    const handShape = shape([
      { type: 'triplet', ids: [0, 0, 0] },
      { type: 'triplet', ids: [9, 9, 9] },
      { type: 'triplet', ids: [18, 18, 18] },
      { type: 'triplet', ids: [1, 1, 1] },
    ]);
    const yaku = checkYaku(tiles([0, 0, 0, 9, 9, 9, 18, 18, 18, 1, 1, 1, 27, 27]), ctx(), handShape).map((item) => item.name);
    expect(yaku).toContain(YAKUMAN_YAKU.suuankou().name);
    expect(yaku).not.toContain(NORMAL_YAKU.sanankou().name);
  });
});
