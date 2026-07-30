import { describe, expect, it } from 'vitest';
import { evaluateWin, type WinContext } from '../scoreCalculator';
import { createTile } from '../tileUtils';
import type { Tile, TileId } from '../types';
import { GUIDE_YAKU } from '../rulesGuide/yakuCatalog';
import { ANCIENT_YAKU, ANCIENT_YAKU_IDS } from './yaku/ancient';
import type { ScoringMeld } from './scoringTypes';

const ANCIENT_NAMES = [
  '燕返',
  '杠振',
  '十二落抬',
  '五门齐',
  '三连刻',
  '一色三同顺',
  '一筒摸月',
  '九筒捞鱼',
  '人和',
  '大车轮',
  '大竹林',
  '大数邻',
  '四连刻',
  '石上三年',
  '大七星',
];

function tiles(ids: TileId[], redIds: TileId[] = []): Tile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = seen.get(id) ?? 0;
    seen.set(id, copy + 1);
    const tile = createTile(id, copy);
    tile.red = redIds.includes(id) && copy === 0;
    return tile;
  });
}

function ctx(winTileId: TileId, overrides: Partial<WinContext> = {}): WinContext {
  return {
    winTile: createTile(winTileId, 0),
    winningTile: createTile(winTileId, 99),
    winType: 'ron',
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
    ruleConfig: { allowAncientYaku: true, multipleYakuman: true },
    ...overrides,
  };
}

function yakuFor(ids: TileId[], winTileId: TileId, overrides: Partial<WinContext> = {}, redIds: TileId[] = []) {
  return evaluateWin(tiles(ids, redIds), ctx(winTileId, overrides)).yaku;
}

function namesFor(ids: TileId[], winTileId: TileId, overrides: Partial<WinContext> = {}, redIds: TileId[] = []) {
  return yakuFor(ids, winTileId, overrides, redIds).map((yaku) => yaku.name);
}

function expectHas(ids: TileId[], winTileId: TileId, name: string, overrides: Partial<WinContext> = {}, redIds: TileId[] = []) {
  expect(namesFor(ids, winTileId, overrides, redIds)).toContain(name);
}

function expectNotHas(ids: TileId[], winTileId: TileId, name: string, overrides: Partial<WinContext> = {}, redIds: TileId[] = []) {
  expect(namesFor(ids, winTileId, overrides, redIds)).not.toContain(name);
}

function meld(type: ScoringMeld['type'], ids: TileId[], open = true, kanType?: ScoringMeld['kanType']): ScoringMeld {
  return { type, ids, tiles: tiles(ids), open, kanType };
}

describe('ancient yaku whitelist', () => {
  it('only registers the requested ancient yaku ids', () => {
    expect(ANCIENT_YAKU_IDS.sort()).toEqual([
      'chuupinraoyui',
      'daichikurin',
      'daichisei',
      'daisharin',
      'daisuurin',
      'iipinmooyue',
      'ishinoUenoSannen',
      'isshokuSanjun',
      'kanfuri',
      'renhou',
      'sanrenkou',
      'shiieruota',
      'suurenkou',
      'tsubamegaeshi',
      'uumensai',
    ].sort());
    expect(Object.keys(ANCIENT_YAKU).sort()).toEqual([...ANCIENT_YAKU_IDS].sort());
  });

  it('rules guide ancient list matches the scoring registry and removed ancient yaku are absent', () => {
    const guideAncientIds = GUIDE_YAKU.filter((yaku) => yaku.source === 'ancient').map((yaku) => yaku.id).sort();
    expect(guideAncientIds).toEqual(ANCIENT_YAKU_IDS.sort());
    expect(guideAncientIds).not.toContain('chiiseiPuutao');
    expect(guideAncientIds).not.toContain('shiisanPuuta');
  });

  it('燕返：只在荣和立直宣言牌时成立', () => {
    const hand = [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14] as TileId[];
    expectHas(hand, 14, '燕返', { isRiichiDeclarationDiscardRon: true });
    expectNotHas(hand, 14, '燕返', { isRiichiDeclarationDiscardRon: false });
  });

  it('杠振：只在荣和杠后第一张弃牌时成立', () => {
    const hand = [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14] as TileId[];
    expectHas(hand, 14, '杠振', { isAfterKanFirstDiscardRon: true });
    expectNotHas(hand, 14, '杠振', { isAfterKanFirstDiscardRon: false });
  });

  it('十二落抬：四副露单骑荣和固定1番', () => {
    const openFour = {
      isMenzen: false,
      waitType: 'tanki' as const,
      melds: [
        meld('sequence', [0, 1, 2]),
        meld('sequence', [9, 10, 11]),
        meld('triplet', [18, 18, 18]),
        meld('triplet', [27, 27, 27]),
      ],
    };
    expectHas([31, 31], 31, '十二落抬', openFour);
    expectNotHas([31, 31], 31, '十二落抬', { ...openFour, waitType: 'ryanmen' });
  });

  it('五门齐：门前与副露均为2番且副露不减番', () => {
    const hand = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31, 31] as TileId[];
    const closed = yakuFor(hand, 31).find((yaku) => yaku.name === '五门齐');
    const open = yakuFor(hand, 31, { isMenzen: false }).find((yaku) => yaku.name === '五门齐');
    expect(closed?.han).toBe(2);
    expect(open?.han).toBe(2);
    expect(open?.openHan).toBe(2);
    expectNotHas([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 1, 1], 1, '五门齐');
  });

  it('三连刻：同色连续三组刻子，副露不减番', () => {
    const hand = [1, 1, 1, 2, 2, 2, 3, 3, 3, 9, 10, 11, 27, 27] as TileId[];
    const open = yakuFor(hand, 27, { isMenzen: false }).find((yaku) => yaku.name === '三连刻');
    expectHas(hand, 27, '三连刻');
    expect(open?.han).toBe(2);
    expectNotHas([1, 1, 1, 2, 2, 2, 4, 4, 4, 9, 10, 11, 27, 27], 27, '三连刻');
  });

  it('一色三同顺：门前3番，副露2番，顺子必须完全相同', () => {
    const hand = [0, 1, 2, 0, 1, 2, 0, 1, 2, 9, 10, 11, 27, 27] as TileId[];
    const openHand = [0, 1, 2, 0, 1, 2, 9, 10, 11, 27, 27] as TileId[];
    expect(yakuFor(hand, 27).find((yaku) => yaku.name === '一色三同顺')?.han).toBe(3);
    expect(yakuFor(openHand, 27, { isMenzen: false, melds: [meld('sequence', [0, 1, 2])] }).find((yaku) => yaku.name === '一色三同顺')?.han).toBe(2);
    expectNotHas([0, 1, 2, 0, 1, 2, 1, 2, 3, 9, 10, 11, 27, 27], 27, '一色三同顺');
  });

  it('一筒摸月：海底自摸且最后牌为一筒时固定5番', () => {
    const hand = [10, 11, 1, 2, 3, 19, 20, 21, 4, 5, 6, 13, 13, 9] as TileId[];
    expect(yakuFor(hand, 9, { winType: 'tsumo', isTsumo: true, isHaitei: true }).find((yaku) => yaku.name === '一筒摸月')?.han).toBe(5);
    expectNotHas(hand, 10, '一筒摸月', { winType: 'tsumo', isTsumo: true, isHaitei: true });
  });

  it('九筒捞鱼：河底荣和且最后牌为九筒时固定5番', () => {
    const hand = [15, 16, 1, 2, 3, 19, 20, 21, 4, 5, 6, 13, 13, 17] as TileId[];
    expect(yakuFor(hand, 17, { isHoutei: true }).find((yaku) => yaku.name === '九筒捞鱼')?.han).toBe(5);
    expectNotHas(hand, 16, '九筒捞鱼', { isHoutei: true });
  });

  it('人和：第一巡摸牌前荣和时为役满', () => {
    const hand = [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14] as TileId[];
    expect(yakuFor(hand, 14, { isRenhou: true })[0]).toMatchObject({ name: '人和', yakumanValue: 1 });
    expectNotHas(hand, 14, '人和', { isRenhou: false });
  });

  it('大车轮、大竹林、大数邻严格区分花色且赤五按五处理', () => {
    expectHas([10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16], 16, '大车轮', {}, [13]);
    expectHas([19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25], 25, '大竹林', {}, [22]);
    expectHas([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7], 7, '大数邻', {}, [4]);
    expectNotHas([10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 17, 17], 17, '大车轮');
    expectNotHas([10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16], 16, '大竹林');
    expectNotHas([19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25], 25, '大数邻');
  });

  it('四连刻：同色连续四组刻子为役满', () => {
    const hand = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 27, 27] as TileId[];
    expect(yakuFor(hand, 27).find((yaku) => yaku.name === '四连刻')?.yakumanValue).toBe(1);
    expectNotHas([1, 1, 1, 2, 2, 2, 3, 3, 3, 5, 5, 5, 27, 27], 27, '四连刻');
  });

  it('石上三年：两立直并海底或河底时为单倍役满', () => {
    const hand = [1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14, 14] as TileId[];
    expect(yakuFor(hand, 14, { isRiichi: true, isDoubleRiichi: true, isHoutei: true }).find((yaku) => yaku.name === '石上三年')?.yakumanValue).toBe(1);
    expectNotHas(hand, 14, '石上三年', { isRiichi: true, isDoubleRiichi: false, isHoutei: true });
  });

  it('大七星固定双倍役满，并可与字一色复合为三倍役满', () => {
    const hand = [27, 27, 28, 28, 29, 29, 30, 30, 31, 31, 32, 32, 33, 33] as TileId[];
    const score = evaluateWin(tiles(hand), ctx(33));
    expect(score.yaku).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '大七星', yakumanValue: 2 }),
      expect.objectContaining({ name: '字一色', yakumanValue: 1 }),
    ]));
    expect(score.yakumanValue).toBe(3);
    expectNotHas([27, 27, 28, 28, 29, 29, 30, 30, 31, 31, 32, 32, 0, 0], 0, '大七星');
  });

  it('古役关闭时全部古役不参与计分', () => {
    const hand = [27, 27, 28, 28, 29, 29, 30, 30, 31, 31, 32, 32, 33, 33] as TileId[];
    const names = namesFor(hand, 33, { ruleConfig: { allowAncientYaku: false, multipleYakuman: true } });
    ANCIENT_NAMES.forEach((name) => expect(names).not.toContain(name));
    expect(names).toContain('字一色');
  });
});
