import { ANCIENT_YAKU } from '../score/yaku/ancient';
import { NORMAL_YAKU } from '../score/yaku/normal';
import { YAKUMAN_YAKU } from '../score/yaku/yakuman';
import type { YakuResult } from '../score/yaku/types';
import type { CallSet, TileId } from '../types';
import { getTileRank, getTileSuit } from '../tileUtils';

export type GuideYakuSource = 'normal' | 'yakuman' | 'ancient';
export type GuideYakuGroup = '1番役' | '2番役' | '3番役' | '6番役' | '役满' | '古役';

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

const closedPinfu = ex([1, 2, 3, 2, 3, 4, 12, 13, 14, 23, 24, 13, 13], 25);
const openShape = ex([4, 5, 6, 14], 14, { melds: [call('chi', [1, 2, 3]), call('chi', [10, 11, 12]), call('chi', [19, 20, 21])] });

export const GUIDE_YAKU: GuideYaku[] = [
  { id: 'riichi', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.riichi(), openResult: null, condition: '门前听牌后宣告立直并支付1000点供托。', tags: ['立直后'], example: closedPinfu },
  { id: 'doubleRiichi', source: 'normal', group: '2番役', closedResult: NORMAL_YAKU.doubleRiichi(), openResult: null, condition: '第一次摸牌前无人鸣牌且门前听牌时宣告立直。', tags: ['第一巡', '立直后'], example: closedPinfu },
  { id: 'ippatsu', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.ippatsu(), openResult: null, condition: '立直后一巡内和牌，且中途没有吃、碰、杠。', tags: ['立直后'], example: closedPinfu },
  { id: 'menzenTsumo', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.menzenTsumo(), openResult: null, condition: '门前清状态下自摸和牌。', example: closedPinfu },
  { id: 'pinfu', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.pinfu(), openResult: null, condition: '门前清限定。四组面子均为顺子，雀头不是役牌，且以两面听和牌。', example: closedPinfu },
  { id: 'iipeikou', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.iipeikou(), openResult: null, condition: '门前同色同数的两组顺子。', example: ex([0, 1, 2, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27], 27) },
  { id: 'tanyao', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.tanyao(), openResult: NORMAL_YAKU.tanyao(), condition: '全部使用2到8的数牌，不含幺九牌和字牌。', example: ex([1, 2, 3, 10, 11, 12, 19, 20, 21, 4, 5, 6, 13], 13, { redIds: [13] }) },
  { id: 'yakuhai', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.yakuhai(), openResult: NORMAL_YAKU.yakuhai(), condition: '三元牌、场风或自风刻子/杠子。', example: ex([31, 31, 31, 1, 2, 3, 10, 11, 12, 19, 20, 21, 27], 27) },
  { id: 'haitei', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.haitei(), openResult: NORMAL_YAKU.haitei(), condition: '牌山最后一张自摸和牌。', tags: ['最后一张牌'], example: openShape },
  { id: 'houtei', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.houtei(), openResult: NORMAL_YAKU.houtei(), condition: '荣和他家打出的最后一张牌。', tags: ['最后一张牌'], example: openShape },
  { id: 'rinshan', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.rinshan(), openResult: NORMAL_YAKU.rinshan(), condition: '开杠后从岭上牌自摸和牌。', tags: ['岭上牌'], example: ex([1, 2, 3, 10], 10, { melds: [call('kan', [31, 31, 31, 31], 0, false, 'ankan'), call('chi', [19, 20, 21]), call('chi', [4, 5, 6])] }) },
  { id: 'chankan', source: 'normal', group: '1番役', closedResult: NORMAL_YAKU.chankan(), openResult: NORMAL_YAKU.chankan(), condition: '他家加杠时，用被加杠的牌荣和。', tags: ['抢杠'], example: openShape },
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
  { id: 'suukantsu', source: 'yakuman', group: '役满', closedResult: YAKUMAN_YAKU.suukantsu(), openResult: YAKUMAN_YAKU.suukantsu(), condition: '一副牌中完成四组杠子。', example: ex([31], 31, { melds: [call('kan', [0, 0, 0, 0], 0, false, 'ankan'), call('kan', [9, 9, 9, 9], 2, true, 'minkan'), call('kan', [18, 18, 18, 18], 1, true, 'ankan'), call('kan', [27, 27, 27, 27], 3, true, 'minkan')] }) },
  { id: 'tsubamegaeshi', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.tsubamegaeshi(), openResult: ANCIENT_YAKU.tsubamegaeshi(), condition: '一番；荣和其他玩家立直宣言时打出的第一张牌；后续弃牌不成立，仅荣和。', tags: ['立直宣言牌', '仅荣和'], example: closedPinfu },
  { id: 'kanfuri', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.kanfuri(), openResult: ANCIENT_YAKU.kanfuri(), condition: '一番；荣和其他玩家完成杠后打出的第一张弃牌；该玩家下一次弃牌后机会清除，仅荣和。', tags: ['杠后弃牌', '仅荣和'], example: closedPinfu },
  { id: 'shiieruota', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.shiieruota(), openResult: ANCIENT_YAKU.shiieruota(), condition: '一番；已有四组副露，最终以单骑等待荣和，固定1番。', tags: ['四副露', '单骑', '仅荣和'], example: ex([31], 31, { melds: [call('chi', [0, 1, 2]), call('chi', [9, 10, 11]), call('pon', [18, 18, 18]), call('pon', [27, 27, 27])] }) },
  { id: 'uumensai', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.uumensai(), openResult: ANCIENT_YAKU.uumensai(), condition: '二番；和牌结构同时包含万子、筒子、索子、风牌和三元牌。', example: ex([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31], 31) },
  { id: 'sanrenkou', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.sanrenkou(), openResult: ANCIENT_YAKU.sanrenkou(), condition: '二番；同一种数牌中包含三个数字连续的刻子或杠子。', example: ex([1, 1, 1, 2, 2, 2, 3, 3, 3, 9, 10, 11, 27], 27) },
  { id: 'isshokuSanjun', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.isshokuSanjun(true), openResult: ANCIENT_YAKU.isshokuSanjun(false), condition: '三番，副露减一番；同一种数牌中包含三组花色和起始数字完全一致的顺子。', example: ex([0, 1, 2, 0, 1, 2, 0, 1, 2, 9, 10, 11, 27], 27) },
  { id: 'iipinmooyue', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.iipinmooyue(), openResult: ANCIENT_YAKU.iipinmooyue(), condition: '五番；海底摸月成立，且最后一张自摸牌为一筒，仅自摸。', tags: ['海底摸月', '最后一张牌', '仅自摸'], example: ex([10, 11, 1, 2, 3, 19, 20, 21, 4, 5, 6, 13, 13], 9) },
  { id: 'chuupinraoyui', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.chuupinraoyui(), openResult: ANCIENT_YAKU.chuupinraoyui(), condition: '五番；河底捞鱼成立，且最后一张荣和牌为九筒，仅荣和。', tags: ['河底捞鱼', '最后一张牌', '仅荣和'], example: ex([15, 16, 1, 2, 3, 19, 20, 21, 4, 5, 6, 13, 13], 17) },
  { id: 'renhou', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.renhou(), openResult: null, condition: '役满；玩家在第一巡、轮到自己第一次摸牌前荣和。', tags: ['第一巡', '仅荣和'], example: closedPinfu },
  { id: 'daisharin', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.daisharin(), openResult: null, condition: '役满；仅筒子2到8每种数字各一对组成的清一色七对子。', example: ex([10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16], 16, { redIds: [13] }) },
  { id: 'daichikurin', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.daichikurin(), openResult: null, condition: '役满；仅索子2到8每种数字各一对组成的清一色七对子。', example: ex([19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25], 25, { redIds: [22] }) },
  { id: 'daisuurin', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.daisuurin(), openResult: null, condition: '役满；仅万子2到8每种数字各一对组成的清一色七对子。', example: ex([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7], 7, { redIds: [4] }) },
  { id: 'suurenkou', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.suurenkou(), openResult: ANCIENT_YAKU.suurenkou(), condition: '役满；同一种数牌中包含四个数字连续的刻子或杠子。', example: ex([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 27], 27) },
  { id: 'ishinoUenoSannen', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.ishinoUenoSannen(), openResult: null, condition: '役满；同时满足两立直，以及海底摸月或河底捞鱼。', tags: ['两立直', '海底/河底'], example: closedPinfu },
  { id: 'daichisei', source: 'ancient', group: '古役', closedResult: ANCIENT_YAKU.daichisei(), openResult: null, condition: '双倍役满；东、南、西、北、白、发、中各一对组成七对子。', example: ex([27, 27, 28, 28, 29, 29, 30, 30, 31, 31, 32, 32, 33], 33) },
];

export const REGISTERED_GUIDE_YAKU_IDS = GUIDE_YAKU.map((yaku) => yaku.id);
