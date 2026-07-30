import type { Tile, TileId, Wind } from '../types';
import { ALL_TILE_IDS } from '../tileUtils';
import { cloneCounts, normalizeCounts, tilesToCounts, type TileCounts } from '../tileCounts';
import { thirteenOrphansShanten, sevenPairsShanten } from '../shanten';
import { defaultRuleConfig, type RuleConfig } from './rules/RuleConfig';
import { ANCIENT_YAKU } from './yaku/ancient';
import { NORMAL_YAKU } from './yaku/normal';
import { YAKUMAN_YAKU } from './yaku/yakuman';
import type { YakuResult } from './yaku/types';
import type { ScoringMeld, WaitType, WinningTileSource, WinType } from './scoringTypes';

export interface WinContext {
  winTile: Tile;
  winningTile?: Tile;
  winType?: WinType;
  winningTileSource?: WinningTileSource;
  isTsumo: boolean;
  isRiichi: boolean;
  isDoubleRiichi?: boolean;
  isIppatsu: boolean;
  isFirstTurn?: boolean;
  callsOccurred?: boolean;
  isLastTile?: boolean;
  isHaitei?: boolean;
  isHoutei?: boolean;
  isRinshan?: boolean;
  isChankan?: boolean;
  isTenhou?: boolean;
  isChiihou?: boolean;
  isMenzen: boolean;
  roundWind: Wind;
  seatWind: Wind;
  doraIndicators: Tile[];
  uraDoraIndicators: Tile[];
  honba: number;
  riichiSticks: number;
  isRenhou?: boolean;
  isRiichiDeclarationDiscardRon?: boolean;
  isAfterKanFirstDiscardRon?: boolean;
  waitType?: WaitType;
  melds?: ScoringMeld[];
  preWinHand?: Tile[];
  ruleConfig?: Partial<RuleConfig>;
}

export interface MeldShape {
  type: 'sequence' | 'triplet' | 'kan';
  ids: TileId[];
  open?: boolean;
  kanType?: 'ankan' | 'minkan' | 'kakan';
  calledTile?: Tile;
  source?: 'concealed' | 'call';
}

export interface HandShape {
  pair: TileId | null;
  melds: MeldShape[];
  type: 'standard' | 'seven-pairs' | 'thirteen-orphans';
}

const DRAGONS = new Set<TileId>([31, 32, 33]);
const WINDS = new Set<TileId>([27, 28, 29, 30]);
const ORPHANS = new Set<TileId>([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]);
const TERMINALS = new Set<TileId>([0, 8, 9, 17, 18, 26]);
const GREENS = new Set<TileId>([19, 20, 21, 23, 25, 32]);

export function getRuleConfig(context?: WinContext): RuleConfig {
  return {
    ...defaultRuleConfig,
    ...(context?.ruleConfig ?? {}),
  };
}

export function findWinningShape(hand: Tile[]): HandShape | null {
  return findWinningShapes(hand)[0] ?? null;
}

export function findWinningShapes(hand: Tile[]): HandShape[] {
  const counts = tilesToCounts(hand);
  if (normalizeCounts(counts).reduce((sum, count) => sum + count, 0) % 3 !== 2) return [];
  const shapes: HandShape[] = [];
  if (thirteenOrphansShanten(counts) === -1) shapes.push({ type: 'thirteen-orphans', pair: orphanPair(counts), melds: [] });
  shapes.push(...findStandardShapes(counts));
  if (sevenPairsShanten(counts) === -1) shapes.push({ type: 'seven-pairs', pair: null, melds: [] });
  return uniqueShapes(shapes).sort((a, b) => shapePriority(a) - shapePriority(b));
}

export function checkYaku(hand: Tile[], context: WinContext, shape = findWinningShape(hand)): YakuResult[] {
  if (!shape) return [];
  const config = getRuleConfig(context);
  const counts = tilesToCounts(hand);
  const closed = context.isMenzen;
  const yakuman = checkYakuman(counts, context, shape, config);
  if (yakuman.length > 0) return config.multipleYakuman ? yakuman : [yakuman[0]];

  const yaku: YakuResult[] = [];
  if (context.isDoubleRiichi && closed) yaku.push(NORMAL_YAKU.doubleRiichi());
  else if (context.isRiichi && closed) yaku.push(NORMAL_YAKU.riichi());
  if (config.ippatsu && context.isIppatsu && context.isRiichi) yaku.push(NORMAL_YAKU.ippatsu());
  if (context.isTsumo && closed) yaku.push(NORMAL_YAKU.menzenTsumo());
  if (context.isHaitei && context.isTsumo && !context.isRinshan) yaku.push(NORMAL_YAKU.haitei());
  if (context.isHoutei && !context.isTsumo) yaku.push(NORMAL_YAKU.houtei());
  if (context.isRinshan && context.isTsumo) yaku.push(NORMAL_YAKU.rinshan());
  if (context.isChankan && !context.isTsumo) yaku.push(NORMAL_YAKU.chankan());
  if (isTanyao(counts) && (closed || config.allowOpenTanyao)) yaku.push(NORMAL_YAKU.tanyao());
  if (shape.type === 'seven-pairs') yaku.push(NORMAL_YAKU.chiitoitsu());

  if (shape.type === 'standard') {
    if (isPinfu(shape, context)) yaku.push(NORMAL_YAKU.pinfu());
    const peikou = iipeikouCount(shape);
    if (closed && peikou >= 2) yaku.push(NORMAL_YAKU.ryanpeikou());
    else if (closed && peikou === 1) yaku.push(NORMAL_YAKU.iipeikou());
    yaku.push(...yakuhai(shape, context));
    if (isToitoi(shape)) yaku.push(NORMAL_YAKU.toitoi());
    if (!(context.isMenzen && isSuuankou(shape, context)) && countConcealedTripletLikeSets(shape, context) >= 3) yaku.push(NORMAL_YAKU.sanankou());
    if (isSanshokuDoujun(shape)) yaku.push(NORMAL_YAKU.sanshokuDoujun(closed));
    if (isSanshokuDoukou(shape)) yaku.push(NORMAL_YAKU.sanshokuDoukou());
    if (kanCount(shape) >= 3) yaku.push(NORMAL_YAKU.sankantsu());
    if (!isDaisangen(shape) && isShousangen(shape)) yaku.push(NORMAL_YAKU.shousangen());
    if (isIttsu(shape)) yaku.push(NORMAL_YAKU.ittsu(closed));
    if (isJunchan(shape)) yaku.push(NORMAL_YAKU.junchan(closed));
    else if (isChanta(shape)) yaku.push(NORMAL_YAKU.chanta(closed));
  }

  if (isHonroutou(counts)) yaku.push(NORMAL_YAKU.honroutou());
  if (isFlushLike(counts, false)) yaku.push(NORMAL_YAKU.honitsu(closed));
  if (isFlushLike(counts, true)) yaku.push(NORMAL_YAKU.chinitsu(closed));
  if (config.allowAncientYaku) {
    yaku.push(...checkAncientYaku(counts, context, shape));
  }
  return yaku;
}

export function checkYakuman(counts: TileCounts, context: WinContext, shape: HandShape, config = getRuleConfig(context)): YakuResult[] {
  const yaku: YakuResult[] = [];
  if (context.isTenhou) yaku.push(YAKUMAN_YAKU.tenhou());
  if (context.isChiihou) yaku.push(YAKUMAN_YAKU.chiihou());
  if (shape.type === 'thirteen-orphans') {
    yaku.push(isKokushi13(counts, context.winTile.id) ? YAKUMAN_YAKU.kokushi13(config.allowDoubleYakuman) : YAKUMAN_YAKU.kokushi());
  }
  if (shape.type === 'standard') {
    if (context.isMenzen && isSuuankou(shape, context)) yaku.push(isTanki(context, shape) ? YAKUMAN_YAKU.suuankouTanki(config.allowDoubleYakuman) : YAKUMAN_YAKU.suuankou());
    if (isDaisangen(shape)) yaku.push(YAKUMAN_YAKU.daisangen());
    if (isShousuushii(shape)) yaku.push(YAKUMAN_YAKU.shousuushii());
    if (isDaisuushii(shape)) yaku.push(YAKUMAN_YAKU.daisuushii(config.allowDoubleYakuman));
    if (kanCount(shape) >= 4) yaku.push(YAKUMAN_YAKU.suukantsu());
  }
  if (allTiles(counts).every((id) => WINDS.has(id) || DRAGONS.has(id))) yaku.push(YAKUMAN_YAKU.tsuuiisou());
  if (allTiles(counts).every((id) => GREENS.has(id))) yaku.push(YAKUMAN_YAKU.ryuuiisou());
  if (allTiles(counts).every((id) => TERMINALS.has(id))) yaku.push(YAKUMAN_YAKU.chinroutou());
  if (isChuuren(counts)) yaku.push(isChuuren9(counts, context.winTile.id) ? YAKUMAN_YAKU.chuuren9(config.allowDoubleYakuman) : YAKUMAN_YAKU.chuuren());
  if (config.allowAncientYaku) {
    if (isRenhouContext(context)) yaku.push(ANCIENT_YAKU.renhou());
    if (isDaisharin(counts, 9)) yaku.push(ANCIENT_YAKU.daisharin());
    if (isDaisharin(counts, 18)) yaku.push(ANCIENT_YAKU.daichikurin());
    if (isDaisharin(counts, 0)) yaku.push(ANCIENT_YAKU.daisuurin());
    if (shape.type === 'standard' && consecutiveTriplets(shape) >= 4) yaku.push(ANCIENT_YAKU.suurenkou());
    if (context.isDoubleRiichi && ((context.isHaitei && context.isTsumo) || (context.isHoutei && !context.isTsumo))) yaku.push(ANCIENT_YAKU.ishinoUenoSannen());
    if (isDaichisei(counts)) yaku.push(ANCIENT_YAKU.daichisei());
  }
  return yaku;
}

export function checkAncientYaku(counts: TileCounts, context: WinContext, shape: HandShape): YakuResult[] {
  const yaku: YakuResult[] = [];
  if (context.isRiichiDeclarationDiscardRon && !context.isTsumo) yaku.push(ANCIENT_YAKU.tsubamegaeshi());
  if (context.isAfterKanFirstDiscardRon && !context.isTsumo) yaku.push(ANCIENT_YAKU.kanfuri());
  if (isShiieruota(context)) yaku.push(ANCIENT_YAKU.shiieruota());
  if (isUumensai(counts)) yaku.push(ANCIENT_YAKU.uumensai());
  if (shape.type === 'standard') {
    if (consecutiveTriplets(shape) >= 3) yaku.push(ANCIENT_YAKU.sanrenkou());
    if (sameSuitSameSequenceCount(shape) >= 3) yaku.push(ANCIENT_YAKU.isshokuSanjun(context.isMenzen));
  }
  if (context.isHaitei && context.isTsumo && context.winTile.id === 9) yaku.push(ANCIENT_YAKU.iipinmooyue());
  if (context.isHoutei && !context.isTsumo && context.winTile.id === 17) yaku.push(ANCIENT_YAKU.chuupinraoyui());
  return yaku;
}

function findStandardShape(counts: TileCounts): HandShape | null {
  return findStandardShapes(counts)[0] ?? null;
}

function findStandardShapes(counts: TileCounts): HandShape[] {
  return ALL_TILE_IDS.flatMap((id) => {
    if (counts[id] < 2) return [];
    const work = cloneCounts(counts);
    work[id] -= 2;
    return extractMeldCombinations(work).map((melds) => ({ type: 'standard' as const, pair: id, melds }));
  });
}

function extractMelds(counts: TileCounts): MeldShape[] | null {
  return extractMeldCombinations(counts)[0] ?? null;
}

function extractMeldCombinations(counts: TileCounts): MeldShape[][] {
  const first = counts.findIndex((count) => count > 0);
  if (first === -1) return [[]];
  const results: MeldShape[][] = [];
  if (counts[first] >= 3) {
    const work = cloneCounts(counts);
    work[first] -= 3;
    extractMeldCombinations(work).forEach((rest) => {
      results.push([{ type: 'triplet', ids: [first, first, first] as TileId[] }, ...rest]);
    });
  }
  if (first < 27 && first % 9 <= 6 && counts[first + 1] > 0 && counts[first + 2] > 0) {
    const work = cloneCounts(counts);
    work[first] -= 1;
    work[first + 1] -= 1;
    work[first + 2] -= 1;
    extractMeldCombinations(work).forEach((rest) => {
      results.push([{ type: 'sequence', ids: [first, first + 1, first + 2] as TileId[] }, ...rest]);
    });
  }
  return results;
}

function uniqueShapes(shapes: HandShape[]): HandShape[] {
  const seen = new Set<string>();
  return shapes.filter((shape) => {
    const key = shapeKey(shape);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shapeKey(shape: HandShape): string {
  return `${shape.type}:${shape.pair ?? 'none'}:${shape.melds.map((meld) => `${meld.type}:${meld.ids.join('.')}`).sort().join('|')}`;
}

function shapePriority(shape: HandShape): number {
  if (shape.type === 'thirteen-orphans') return 0;
  if (shape.type === 'standard' && iipeikouCount(shape) >= 2) return 1;
  if (shape.type === 'seven-pairs') return 2;
  return 3;
}

function allTiles(counts: TileCounts): TileId[] {
  return ALL_TILE_IDS.filter((id) => counts[id] > 0);
}

function orphanPair(counts: TileCounts): TileId | null {
  return [...ORPHANS].find((id) => counts[id] >= 2) ?? null;
}

function windToTileId(wind: Wind): TileId {
  return { east: 27, south: 28, west: 29, north: 30 }[wind] as TileId;
}

function isTanyao(counts: TileCounts): boolean {
  return [...ORPHANS].every((id) => counts[id] === 0);
}

function isPinfu(shape: HandShape, context: WinContext): boolean {
  if (shape.type !== 'standard' || shape.pair === null) return false;
  if (!context.isMenzen || context.waitType !== 'ryanmen') return false;
  if (shape.melds.some((meld) => meld.type !== 'sequence')) return false;
  if (DRAGONS.has(shape.pair)) return false;
  if (shape.pair === windToTileId(context.seatWind) || shape.pair === windToTileId(context.roundWind)) return false;
  return true;
}

function iipeikouCount(shape: HandShape): number {
  const counts = new Map<string, number>();
  shape.melds.filter((meld) => meld.type === 'sequence').forEach((meld) => counts.set(meld.ids.join(','), (counts.get(meld.ids.join(',')) ?? 0) + 1));
  return [...counts.values()].filter((count) => count >= 2).length;
}

function yakuhai(shape: HandShape, context: WinContext): YakuResult[] {
  return shape.melds.filter((meld) => meld.type !== 'sequence').flatMap((meld) => {
    const id = meld.ids[0];
    const yaku: YakuResult[] = [];
    if (DRAGONS.has(id)) yaku.push(NORMAL_YAKU.yakuhai(`役牌·${dragonName(id)}`));
    if (id === windToTileId(context.roundWind)) yaku.push(NORMAL_YAKU.yakuhai(`场风·${windName(context.roundWind)}`));
    if (id === windToTileId(context.seatWind)) yaku.push(NORMAL_YAKU.yakuhai(`自风·${windName(context.seatWind)}`));
    return yaku;
  });
}

function dragonName(id: TileId): string {
  if (id === 31) return '白';
  if (id === 32) return '发';
  return '中';
}

function windName(wind: Wind): string {
  return { east: '东', south: '南', west: '西', north: '北' }[wind];
}

function isToitoi(shape: HandShape): boolean {
  return shape.type === 'standard' && shape.melds.every((meld) => meld.type !== 'sequence');
}

function tripletCount(shape: HandShape): number {
  return shape.melds.filter((meld) => meld.type !== 'sequence').length;
}

export function countConcealedTripletLikeSets(shape: HandShape, context: WinContext): number {
  if (shape.type !== 'standard') return 0;
  const winningTile = context.winningTile ?? context.winTile;
  const winType = context.winType ?? (context.isTsumo ? 'tsumo' : 'ron');
  return shape.melds.filter((meld) => {
    if (meld.type === 'sequence') return false;
    if (meld.source === 'call') return meld.type === 'kan' && meld.kanType === 'ankan';
    if (meld.type === 'kan') return meld.kanType === 'ankan';
    const completedTripletByRon = winType === 'ron'
      && (context.waitType === 'shanpon' || context.waitType === undefined)
      && meld.ids[0] === winningTile.id
      && shape.pair !== winningTile.id;
    return !completedTripletByRon;
  }).length;
}

function kanCount(shape: HandShape): number {
  return shape.melds.filter((meld) => meld.type === 'kan').length;
}

function isSanshokuDoujun(shape: HandShape): boolean {
  const starts = new Set(shape.melds.filter((meld) => meld.type === 'sequence').map((meld) => meld.ids[0]));
  for (let start = 0; start <= 6; start += 1) {
    if (starts.has(start as TileId) && starts.has((start + 9) as TileId) && starts.has((start + 18) as TileId)) return true;
  }
  return false;
}

function isSanshokuDoukou(shape: HandShape): boolean {
  const triplets = new Set(shape.melds.filter((meld) => meld.type !== 'sequence').map((meld) => meld.ids[0]));
  for (let rank = 0; rank <= 8; rank += 1) {
    if (triplets.has(rank as TileId) && triplets.has((rank + 9) as TileId) && triplets.has((rank + 18) as TileId)) return true;
  }
  return false;
}

function isIttsu(shape: HandShape): boolean {
  const starts = new Set(shape.melds.filter((meld) => meld.type === 'sequence').map((meld) => meld.ids[0]));
  return [0, 9, 18].some((base) => starts.has(base as TileId) && starts.has((base + 3) as TileId) && starts.has((base + 6) as TileId));
}

function isChanta(shape: HandShape): boolean {
  if (shape.type !== 'standard' || shape.pair === null) return false;
  if (!ORPHANS.has(shape.pair)) return false;
  if (!shape.melds.some((meld) => meld.type === 'sequence')) return false;
  return shape.melds.every((meld) => meld.ids.some((id) => ORPHANS.has(id)));
}

function isJunchan(shape: HandShape): boolean {
  if (shape.type !== 'standard' || shape.pair === null) return false;
  if (!TERMINALS.has(shape.pair)) return false;
  if (!shape.melds.some((meld) => meld.type === 'sequence')) return false;
  return shape.melds.every((meld) => meld.ids.every((id) => id < 27) && meld.ids.some((id) => TERMINALS.has(id)));
}

function isHonroutou(counts: TileCounts): boolean {
  const ids = allTiles(counts);
  return ids.length > 0 && ids.every((id) => ORPHANS.has(id)) && ids.some((id) => TERMINALS.has(id)) && ids.some((id) => WINDS.has(id) || DRAGONS.has(id));
}

function isFlushLike(counts: TileCounts, pure: boolean): boolean {
  const suits = [0, 9, 18].filter((base) => counts.slice(base, base + 9).some((count) => count > 0)).length;
  const hasHonors = counts.slice(27).some((count) => count > 0);
  return pure ? suits === 1 && !hasHonors : suits === 1 && hasHonors;
}

function isKokushi13(counts: TileCounts, winTile: TileId): boolean {
  return ORPHANS.has(winTile) && counts[winTile] === 2 && [...ORPHANS].every((id) => counts[id] > 0);
}

function isSuuankou(shape: HandShape, context: WinContext): boolean {
  return countConcealedTripletLikeSets(shape, context) === 4;
}

function isTanki(context: WinContext, shape: HandShape): boolean {
  return shape.pair === context.winTile.id;
}

function isDaisangen(shape: HandShape): boolean {
  const triplets = new Set(shape.melds.filter((meld) => meld.type !== 'sequence').map((meld) => meld.ids[0]));
  return [31, 32, 33].every((id) => triplets.has(id as TileId));
}

function isShousangen(shape: HandShape): boolean {
  if (shape.pair === null || !DRAGONS.has(shape.pair)) return false;
  return shape.melds.filter((meld) => meld.type !== 'sequence' && DRAGONS.has(meld.ids[0])).length === 2;
}

function windTripletCount(shape: HandShape): number {
  return shape.melds.filter((meld) => meld.type !== 'sequence' && WINDS.has(meld.ids[0])).length;
}

function isShousuushii(shape: HandShape): boolean {
  return windTripletCount(shape) === 3 && shape.pair !== null && WINDS.has(shape.pair);
}

function isDaisuushii(shape: HandShape): boolean {
  return windTripletCount(shape) === 4;
}

function isChuuren(counts: TileCounts): boolean {
  const suitBases = [0, 9, 18];
  return suitBases.some((base) => {
    const slice = counts.slice(base, base + 9);
    const total = slice.reduce((sum, count) => sum + count, 0);
    return total === 14 && slice[0] >= 3 && slice[8] >= 3 && slice.slice(1, 8).every((count) => count >= 1);
  });
}

function isChuuren9(counts: TileCounts, winTile: TileId): boolean {
  if (winTile >= 27) return false;
  const base = Math.floor(winTile / 9) * 9;
  const index = winTile - base;
  const need = index === 0 || index === 8 ? 4 : 2;
  return counts[winTile] >= need;
}

function isDaisharin(counts: TileCounts, base: 0 | 9 | 18): boolean {
  const required = new Set([base + 1, base + 2, base + 3, base + 4, base + 5, base + 6, base + 7]);
  return normalizeCounts(counts).reduce((sum, count) => sum + count, 0) === 14
    && ALL_TILE_IDS.every((id) => required.has(id) ? counts[id] === 2 : counts[id] === 0);
}

function isDaichisei(counts: TileCounts): boolean {
  return [27, 28, 29, 30, 31, 32, 33].every((id) => counts[id] === 2)
    && normalizeCounts(counts).reduce((sum, count) => sum + count, 0) === 14;
}

function isRenhouContext(context: WinContext): boolean {
  return !context.isTsumo && Boolean(context.isRenhou);
}

function isShiieruota(context: WinContext): boolean {
  return !context.isTsumo
    && context.waitType === 'tanki'
    && (context.melds?.filter((meld) => meld.open).length ?? 0) >= 4;
}

function isUumensai(counts: TileCounts): boolean {
  return counts.slice(0, 9).some((count) => count > 0)
    && counts.slice(9, 18).some((count) => count > 0)
    && counts.slice(18, 27).some((count) => count > 0)
    && counts.slice(27, 31).some((count) => count > 0)
    && counts.slice(31, 34).some((count) => count > 0);
}

function consecutiveTriplets(shape: HandShape): number {
  const starts = shape.melds.filter((meld) => meld.type !== 'sequence' && meld.ids[0] < 27).map((meld) => meld.ids[0]).sort((a, b) => a - b);
  let best = 0;
  starts.forEach((start) => {
    let count = 1;
    while (starts.includes((start + count) as TileId) && Math.floor((start + count) / 9) === Math.floor(start / 9)) count += 1;
    best = Math.max(best, count);
  });
  return best;
}

function sameSuitSameSequenceCount(shape: HandShape): number {
  const counts = new Map<string, number>();
  shape.melds.filter((meld) => meld.type === 'sequence').forEach((meld) => counts.set(meld.ids.join(','), (counts.get(meld.ids.join(',')) ?? 0) + 1));
  return Math.max(0, ...counts.values());
}
