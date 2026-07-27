import { ANCIENT_YAKU } from '../score/yaku/ancient';
import { NORMAL_YAKU } from '../score/yaku/normal';
import { YAKUMAN_YAKU } from '../score/yaku/yakuman';
import type { YakuResult } from '../score/yaku/types';
import type { CallSet, TileId } from '../types';
import { getTileRank, getTileSuit } from '../tileUtils';

export type GuideYakuSource = 'normal' | 'yakuman' | 'ancient';
export type GuideYakuGroup = '状况役' | '1番役' | '2番役' | '3番役' | '6番役' | '役满' | '古役';

export interface GuideTile {
  id: TileId;
  red?: boolean;
}

export interface GuideYakuExample {
  hand: GuideTile[];
  winningTile: GuideTile;
  melds?: CallSet[];
  note?: string;
}

export interface GuideYaku {
  id: string;
  source: GuideYakuSource;
  group: GuideYakuGroup;
  closedResult: YakuResult;
  openResult: YakuResult | null;
  condition: string;
  tags?: string[];
  example: GuideYakuExample;
}

function tile(id: TileId, copyIndex: number, red = false) {
  return {
    id,
    suit: getTileSuit(id),
    rank: getTileRank(id),
    red,
    instanceId: `guide-${id}-${copyIndex}-${red ? 'red' : 'plain'}`,
  };
}

function guideTiles(ids: TileId[], redIds: TileId[] = []): GuideTile[] {
  const seen = new Map<TileId, number>();
  return ids.map((id) => {
    const copy = seen.get(id) ?? 0;
    seen.set(id, copy + 1);
    return { id, red: redIds.includes(id) && copy === 0 };
  });
}

function call(type: CallSet['type'], ids: TileId[], from = 3, opened = true, kanType?: CallSet['kanType']): CallSet {
  const tiles = ids.map((id, index) => tile(id, index));
  return {
    type,
    tiles,
    from: from as CallSet['from'],
    opened,
    kanType,
    calledTile: opened ? tiles[0] : undefined,
    sequence: type === 'chi' ? ids as [TileId, TileId, TileId] : undefined,
    usedTileIds: type === 'chi' ? ids.slice(1) : undefined,
  };
}

function ex(ids: TileId[], win: TileId, options: { redIds?: TileId[]; melds?: CallSet[]; note?: string } = {}): GuideYakuExample {
  return {
    hand: guideTiles(ids, options.redIds),
    winningTile: guideTiles([win], options.redIds)[0],
    melds: options.melds,
    note: options.note,
  };
}

const closedPinfu = ex([1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 14], 14, { redIds: [4] });
const openShape = ex([4, 5, 6, 14], 14, { melds: [call('chi', [1, 2, 3]), call('chi', [10, 11, 12]), call('chi', [19, 20, 21])] });

export const GUIDE_YAKU: GuideYaku[] = [
  { id: 'riichi', source: 'normal', group: '状况役', closedResult: NORMAL_YAKU.riichi(), openResult: null, condition: '门前听牌后宣告立直并支付1000点供托。', tags: ['立直后'], example: closedPinfu },
  { id: 'doubleRiichi', source: 'normal', group: '状况役', closedResult: NORMAL_YAKU.doubleRiichi(), openResult: null, condition: '第一次摸牌前无人鸣牌且门前听牌时宣告立直。', tags: ['第一巡', '立直后'], example: closedPinfu },
  { id: 'ippatsu', source: 'normal', group: '状况役', closedResult: NORMAL_YAKU.ippatsu(), openResult: null, condition: '立直后一巡内和牌，且中途没有吃、碰、杠。', tags: ['立直后'], example: closedPinfu },
  { id: 'menzenTsumo', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.menzenTsumo(), openResult: null, condition: '门前清状态下自摸和牌。', example: closedPinfu },
  { id: 'pinfu', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.pinfu(), openResult: null, condition: '四组顺子、无役牌雀头，且两面等待。', example: closedPinfu },
  { id: 'iipeikou', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.iipeikou(), openResult: null, condition: '门前同色同数的两组顺子。', example: ex([0, 1, 2, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27], 27) },
  { id: 'tanyao', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.tanyao(), openResult: NORMAL_YAKU.tanyao(), condition: '全部使用2到8的数牌，不含幺九牌和字牌。', example: ex([1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 13], 13, { redIds: [13] }) },
  { id: 'yakuhai', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.yakuhai(), openResult: NORMAL_YAKU.yakuhai(), condition: '三元牌、场风或自风刻子/杠子。', example: ex([31, 31, 31, 1, 2, 3, 10, 11, 12, 19, 20, 21, 27], 27) },
  { id: 'haitei', source: 'normal', group: '状况役', closedResult: NORMAL_YAKU.haitei(), openResult: NORMAL_YAKU.haitei(), condition: '牌山最后一张自摸和牌。', tags: ['最后一张牌'], example: openShape },
  { id: 'houtei', source: 'normal', group: '状况役', closedResult: NORMAL_YAKU.houtei(), openResult: NORMAL_YAKU.houtei(), condition: '荣和他家打出的最后一张牌。', tags: ['最后一张牌'], example: openShape },
  { id: 'rinshan', source: 'normal', group: '状况役', closedResult: NORMAL_YAKU.rinshan(), openResult: NORMAL_YAKU.rinshan(), condition: '开杠后从岭上牌自摸和牌。', tags: ['岭上牌'], example: ex([1, 2, 3, 10], 10, { melds: [call('kan', [31, 31, 31, 31], 0, false, 'ankan'), call('chi', [19, 20, 21]), call('chi', [4, 5, 6])] }) },
  { id: 'chankan', source: 'normal', group: '状况役', closedResult: NORMAL_YAKU.chankan(), openResult: NORMAL_YAKU.chankan(), condition: '他家加杠时，用被加杠的牌荣和。', tags: ['抢杠'], example: openShape },
  { id: 'chiitoitsu', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.chiitoitsu(), openResult: null, condition: '七组不同对子组成的特殊和牌形。', example: ex([0, 0, 1, 1, 2, 2, 9, 9, 10, 10, 11, 11, 27], 27) },
  { id: 'toitoi', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.toitoi(), openResult: NORMAL_YAKU.toitoi(), condition: '四组刻子或杠子加一组雀头。', example: ex([0, 0, 0, 9, 9, 9, 18, 18, 18, 31, 31, 31, 27], 27) },
  { id: 'sanankou', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.sanankou(), openResult: NORMAL_YAKU.sanankou(), condition: '三组暗刻或暗杠，荣和双碰时和到的刻子不算暗刻。', example: ex([0, 0, 0, 9, 9, 9, 18, 18, 18, 3, 4, 5, 27], 27) },
  { id: 'sanshokuDoujun', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.sanshokuDoujun(true), openResult: NORMAL_YAKU.sanshokuDoujun(false), condition: '万、筒、索三色各有同数字顺子。', example: ex([0, 1, 2, 9, 10, 11, 18, 19, 20, 4, 5, 6, 27], 27) },
  { id: 'sanshokuDoukou', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.sanshokuDoukou(), openResult: NORMAL_YAKU.sanshokuDoukou(), condition: '万、筒、索三色各有同数字刻子。', example: ex([1, 1, 1, 10, 10, 10, 19, 19, 19, 3, 4, 5, 27], 27) },
  { id: 'sankantsu', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.sankantsu(), openResult: NORMAL_YAKU.sankantsu(), condition: '一副牌中完成三组杠子。', example: ex([1, 2, 3, 31], 31, { melds: [call('kan', [0, 0, 0, 0], 0, false, 'ankan'), call('kan', [9, 9, 9, 9], 2, true, 'minkan'), call('kan', [18, 18, 18, 18], 1, true, 'kakan')] }) },
  { id: 'shousangen', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.shousangen(), openResult: NORMAL_YAKU.shousangen(), condition: '两组三元牌刻子，另一种三元牌作雀头。', example: ex([31, 31, 31, 32, 32, 32, 0, 1, 2, 9, 10, 11, 33], 33) },
  { id: 'ittsu', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.ittsu(true), openResult: NORMAL_YAKU.ittsu(false), condition: '同一花色的123、456、789三组顺子。', example: ex([0, 1, 2, 3, 4, 5, 6, 7, 8, 18, 19, 20, 27], 27) },
  { id: 'chanta', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.chanta(true), openResult: NORMAL_YAKU.chanta(false), condition: '每组面子和雀头都含幺九牌或字牌，且至少有一组顺子。', example: ex([0, 1, 2, 6, 7, 8, 17, 17, 17, 31, 31, 31, 27], 27) },
  { id: 'honroutou', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.honroutou(), openResult: NORMAL_YAKU.honroutou(), condition: '全部由幺九牌和字牌组成。', example: ex([0, 0, 0, 8, 8, 8, 27, 27, 27, 31, 31, 31, 33], 33) },
  { id: 'ryanpeikou', source: 'normal', group: '3番役', closedResult: NORMAL_YAKU.ryanpeikou(), openResult: null, condition: '门前拥有两组不同的一杯口。', example: ex([0, 1, 2, 0, 1, 2, 9, 10, 11, 9, 10, 11, 27], 27) },
  { id: 'junchan', source: 'normal', group: '3番役', closedResult: NORMAL_YAKU.junchan(true), openResult: NORMAL_YAKU.junchan(false), condition: '每组面子和雀头都含老头牌，且不含字牌。', example: ex([0, 1, 2, 6, 7, 8, 9, 10, 11, 24, 25, 26, 17], 17) },
  { id: 'honitsu', source: 'normal', group: '3番役', closedResult: NORMAL_YAKU.honitsu(true), openResult: NORMAL_YAKU.honitsu(false), condition: '一种数牌花色加字牌组成。', example: ex([0, 1, 2, 3, 4, 5, 6, 7, 8, 27, 27, 27, 31], 31) },
  { id: 'chinitsu', source: 'normal', group: '6番役', closedResult: NORMAL_YAKU.chinitsu(true), openResult: NORMAL_YAKU.chinitsu(false), condition: '全部由同一种数牌花色组成。', example: ex([0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 1, 1, 4], 4, { redIds: [4] }) },
  { id: 'tenhou', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.tenhou(), openResult: null, condition: '庄家起手第一张即自摸和牌。', tags: ['第一巡'], example: closedPinfu },
  { id: 'chiihou', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.chiihou(), openResult: null, condition: '闲家第一次摸牌自摸，且此前无人鸣牌。', tags: ['第一巡'], example: closedPinfu },
  { id: 'kokushi', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.kokushi(), openResult: null, condition: '十三种幺九牌各一张，其中任意一种成对子。', example: ex([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33], 0) },
  { id: 'kokushi13', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.kokushi13(true), openResult: null, condition: '国士无双十三面等待；是否双倍役满由当前规则决定。', example: ex([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33], 33) },
  { id: 'suuankou', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.suuankou(), openResult: null, condition: '门前四组暗刻或暗杠。', example: ex([0, 0, 0, 9, 9, 9, 18, 18, 18, 27, 27, 27, 31], 31) },
  { id: 'suuankouTanki', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.suuankouTanki(true), openResult: null, condition: '四暗刻单骑等待；是否双倍役满由当前规则决定。', example: ex([0, 0, 0, 9, 9, 9, 18, 18, 18, 27, 27, 27, 31], 31) },
  { id: 'daisangen', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.daisangen(), openResult: YAKUMAN_YAKU.daisangen(), condition: '白、发、中三组三元牌刻子或杠子。', example: ex([31, 31, 31, 32, 32, 32, 33, 33, 33, 0, 1, 2, 27], 27) },
  { id: 'shousuushii', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.shousuushii(), openResult: YAKUMAN_YAKU.shousuushii(), condition: '三组风牌刻子，第四种风牌作雀头。', example: ex([27, 27, 27, 28, 28, 28, 29, 29, 29, 0, 1, 2, 30], 30) },
  { id: 'daisuushii', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.daisuushii(true), openResult: YAKUMAN_YAKU.daisuushii(true), condition: '东、南、西、北四组风牌刻子；是否双倍役满由当前规则决定。', example: ex([27, 27, 27, 28, 28, 28, 29, 29, 29, 30, 30, 30, 31], 31) },
  { id: 'tsuuiisou', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.tsuuiisou(), openResult: YAKUMAN_YAKU.tsuuiisou(), condition: '全部由字牌组成。', example: ex([27, 27, 27, 28, 28, 28, 29, 29, 29, 31, 31, 31, 33], 33) },
  { id: 'ryuuiisou', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.ryuuiisou(), openResult: YAKUMAN_YAKU.ryuuiisou(), condition: '全部由绿色牌组成。', example: ex([19, 19, 19, 20, 20, 20, 21, 21, 21, 23, 23, 23, 32], 32) },
  { id: 'chinroutou', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.chinroutou(), openResult: YAKUMAN_YAKU.chinroutou(), condition: '全部由老头牌组成。', example: ex([0, 0, 0, 8, 8, 8, 9, 9, 9, 17, 17, 17, 18], 18) },
  { id: 'chuuren', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.chuuren(), openResult: null, condition: '门前同一花色1112345678999加任意同色牌。', example: ex([0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8], 4, { redIds: [4] }) },
  { id: 'chuuren9', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.chuuren9(true), openResult: null, condition: '纯正九莲宝灯九面等待；是否双倍役满由当前规则决定。', example: ex([0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8], 4, { redIds: [4] }) },
  { id: 'suukantsu', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.suukantsu(), openResult: YAKUMAN_YAKU.suukantsu(), condition: '一副牌中完成四组杠子。', example: ex([31], 31, { melds: [call('kan', [0, 0, 0, 0], 0, false, 'ankan'), call('kan', [9, 9, 9, 9], 2, true, 'minkan'), call('kan', [18, 18, 18, 18], 1, true, 'kakan'), call('kan', [27, 27, 27, 27], 3, true, 'minkan')] }) },
  { id: 'renhou', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.renhou(), openResult: null, condition: '役满，闲家第一巡未摸牌前荣和。', tags: ['古役', '第一巡'], example: closedPinfu },
  { id: 'daisharin', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.daisharin(), openResult: null, condition: '役满，筒子2到8各两张。', example: ex([10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16], 16) },
  { id: 'daichikurin', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.daichikurin(), openResult: null, condition: '役满，索子2到8各两张。', example: ex([19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25], 25, { redIds: [22] }) },
  { id: 'daisuurin', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.daisuurin(), openResult: null, condition: '役满，万子2到8各两张。', example: ex([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7], 7, { redIds: [4] }) },
  { id: 'sanrenkou', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.sanrenkou(), openResult: ANCIENT_YAKU.sanrenkou(), condition: '两番，同色连续三组刻子。', example: ex([0, 0, 0, 1, 1, 1, 2, 2, 2, 9, 10, 11, 27], 27) },
  { id: 'suurenkou', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.suurenkou(), openResult: ANCIENT_YAKU.suurenkou(), condition: '役满，同色连续四组刻子。', example: ex([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 27], 27) },
  { id: 'isshokuSanjun', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.isshokuSanjun(), openResult: ANCIENT_YAKU.isshokuSanjun(), condition: '三番，同色同数字顺子三组。', example: ex([0, 1, 2, 0, 1, 2, 0, 1, 2, 9, 10, 11, 27], 27) },
  { id: 'chiiseiPuutao', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.chiiseiPuutao(), openResult: null, condition: '七种字牌加多种幺九牌组成的不靠形。', example: ex([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33], 0) },
  { id: 'shiisanPuuta', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.shiisanPuuta(), openResult: null, condition: '十三不塔形，十二种孤张加一组对子。', example: ex([0, 2, 5, 8, 9, 11, 14, 17, 18, 21, 24, 27, 31], 31) },
];

export const REGISTERED_GUIDE_YAKU_IDS = GUIDE_YAKU.map((yaku) => yaku.id);
