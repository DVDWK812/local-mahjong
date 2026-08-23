import type { Tile, TileId } from './types';
import { sevenPairsShanten, thirteenOrphansShanten } from './shanten';
import { tilesToCounts } from './tileCounts';
import { calculateFu as calculateFuFromContext, type FuContext, type FuMeld } from './score/fu/fuCalculator';
import { calculateHan, countDora } from './score/hanCalculator';
import { calculatePoints as calculatePointResult, type LimitTier, type PointResult } from './score/pointCalculator';
import { checkYaku, findWinningShape, findWinningShapes, type HandShape, type MeldShape, type WinContext } from './score/yakuChecker';
import type { ScoringMeld, WaitType } from './score/scoringTypes';
import { classifyWaitFromTenpaiState } from './score/waitClassifier';
import type { YakuResult } from './score/yaku/types';

export type { WinContext, MeldShape, HandShape };
export type Yaku = YakuResult & { han: number };

export interface ScoreResult {
  isWinning: boolean;
  yaku: Yaku[];
  dora: number;
  uraDora: number;
  redDora: number;
  han: number;
  yakumanValue: number;
  yakumanMultiplier: number;
  totalDora: number;
  limitTier: LimitTier;
  fu: number;
  points: PointResult;
  shape: HandShape | null;
}

export function evaluateWin(hand: Tile[], context: WinContext): ScoreResult {
  const fixedMelds = context.melds ?? [];
  const shapes = findWinningShapes(hand).filter((shape) => isShapeCompatibleWithFixedMelds(shape, fixedMelds));
  if (shapes.length === 0) return emptyScore(false);
  return shapes
    .map((shape, index) => evaluateShape(hand, context, shape, fixedMelds, index))
    .sort(compareScoreCandidates)[0].score;
}

function evaluateShape(hand: Tile[], context: WinContext, concealedShape: HandShape, fixedMelds: ScoringMeld[], index: number): { score: ScoreResult; index: number } {
  const fullShape = mergeFixedMelds(concealedShape, fixedMelds);
  const fullHand = [...hand, ...fixedMelds.flatMap((meld) => meld.tiles)];
  const winningTile = context.winningTile ?? context.winTile;
  const waitType = context.waitType ?? classifyWaitFromTenpaiState(context.preWinHand ?? removeWinningTile(hand, winningTile), winningTile, fixedMelds, concealedShape);
  const scoringContext: WinContext = {
    ...context,
    winningTile,
    winTile: winningTile,
    winType: context.winType ?? (context.isTsumo ? 'tsumo' : 'ron'),
    waitType,
    isTsumo: (context.winType ?? (context.isTsumo ? 'tsumo' : 'ron')) === 'tsumo',
  };
  const yaku = checkYaku(fullHand, scoringContext, fullShape).map((item) => ({ ...item, han: item.han ?? 0 }));
  const dora = countDora(fullHand, context.doraIndicators);
  const uraDora = countDora(fullHand, context.uraDoraIndicators);
  const redDora = fullHand.filter((tile) => tile.red).length;
  const hanResult = calculateHan(yaku, fullHand, scoringContext, dora, uraDora, redDora);
  const fu = calculateFuFromContext(toFuContext(fullHand, scoringContext, fullShape, fixedMelds, waitType, yaku));

  const points = calculatePointResult(hanResult.han, fu, scoringContext, hanResult.yakumanValue);
  return {
    score: {
      isWinning: true,
      yaku,
      dora,
      uraDora,
      redDora,
      han: hanResult.han,
      yakumanValue: hanResult.yakumanValue,
      yakumanMultiplier: hanResult.yakumanValue,
      totalDora: dora + uraDora + redDora,
      limitTier: points.limitTier,
      fu,
      points,
      shape: fullShape,
    },
    index,
  };
}

function isShapeCompatibleWithFixedMelds(shape: HandShape, fixedMelds: ScoringMeld[]): boolean {
  if (fixedMelds.length === 0) return true;
  return shape.type === 'standard' && shape.melds.length + fixedMelds.length === 4;
}

function mergeFixedMelds(shape: HandShape, fixedMelds: ScoringMeld[]): HandShape {
  if (shape.type !== 'standard' || fixedMelds.length === 0) return shape;
  return {
    ...shape,
    melds: [
      ...shape.melds,
      ...fixedMelds.map((meld): MeldShape => ({
        type: meld.type,
        ids: meld.ids,
        open: meld.open,
        kanType: meld.kanType,
        calledTile: meld.calledTile,
        source: 'call',
      })),
    ],
  };
}

function toFuContext(hand: Tile[], context: WinContext, shape: HandShape, fixedMelds: ScoringMeld[], waitType: WaitType, yakuList: Yaku[]): FuContext {
  const winType = context.winType ?? (context.isTsumo ? 'tsumo' : 'ron');
  return {
    hand,
    winningTile: context.winningTile ?? context.winTile,
    melds: shape.melds.map((meld): FuMeld => ({
      type: meld.type,
      ids: meld.ids,
      open: meld.source === 'call'
        ? meld.open ?? true
        : isConcealedMeldOpenForFu(meld, context, shape, waitType, fixedMelds),
    })),
    pair: shape.pair,
    waitType,
    winType,
    isMenzen: context.isMenzen,
    isTsumo: winType === 'tsumo',
    isRon: winType === 'ron',
    seatWind: context.seatWind,
    roundWind: context.roundWind,
    yakuList,
    ruleConfig: context.ruleConfig,
  };
}

function isConcealedMeldOpenForFu(meld: MeldShape, context: WinContext, shape: HandShape, waitType: WaitType, _fixedMelds: ScoringMeld[]): boolean {
  const winType = context.winType ?? (context.isTsumo ? 'tsumo' : 'ron');
  const winningTile = context.winningTile ?? context.winTile;
  if (meld.type === 'sequence') return false;
  if (meld.source === 'call') return meld.open ?? true;
  if (waitType === 'shanpon' && winType === 'ron' && meld.ids[0] === winningTile.id && shape.pair !== winningTile.id) return true;
  return false;
}

function removeWinningTile(hand: Tile[], winningTile: Tile): Tile[] {
  const index = hand.findIndex((tile) => tile.instanceId === winningTile.instanceId);
  if (index !== -1) return hand.filter((_, tileIndex) => tileIndex !== index);
  const idIndex = hand.findIndex((tile) => tile.id === winningTile.id);
  return idIndex === -1 ? hand : hand.filter((_, tileIndex) => tileIndex !== idIndex);
}

function compareScoreCandidates(a: { score: ScoreResult; index: number }, b: { score: ScoreResult; index: number }): number {
  const payment = b.score.points.total - a.score.points.total;
  if (payment !== 0) return payment;
  const yakuman = b.score.yakumanValue - a.score.yakumanValue;
  if (yakuman !== 0) return yakuman;
  const han = b.score.han - a.score.han;
  if (han !== 0) return han;
  const fu = b.score.fu - a.score.fu;
  if (fu !== 0) return fu;
  return a.index - b.index;
}

export function potentialYaku(hand: Tile[], context: WinContext): string[] {
  const counts = tilesToCounts(hand);
  const names = new Set<string>();
  if (context.isRiichi && context.isMenzen) names.add('立直');
  if (context.isMenzen) names.add('门前清自摸');
  if (sevenPairsShanten(counts) <= 1) names.add('七对子');
  if (thirteenOrphansShanten(counts) <= 1) names.add('国士无双');
  checkYaku(hand, context).forEach((yaku) => names.add(yaku.name));
  return [...names];
}

export function detectYaku(hand: Tile[], context: WinContext, shape: HandShape): Yaku[] {
  return checkYaku(hand, context, shape).map((item) => ({ ...item, han: item.han ?? 0 }));
}

export { findWinningShape, findWinningShapes, countDora };

export function calculateFu(_hand: Tile[], context: WinContext, shape: HandShape): number {
  const waitType = context.waitType ?? classifyWaitFromTenpaiState(context.preWinHand ?? removeWinningTile(_hand, context.winningTile ?? context.winTile), context.winningTile ?? context.winTile, context.melds ?? [], shape);
  return calculateFuFromContext(toFuContext(_hand, context, shape, context.melds ?? [], waitType, []));
}

export function calculatePoints(han: number, fu: number, context: WinContext): PointResult {
  return calculatePointResult(han, fu, context);
}

function emptyScore(isWinning: boolean): ScoreResult {
  return {
    isWinning,
    yaku: [],
    dora: 0,
    uraDora: 0,
    redDora: 0,
    han: 0,
    yakumanValue: 0,
    yakumanMultiplier: 0,
    totalDora: 0,
    limitTier: 'none',
    fu: 0,
    points: { total: 0, limitTier: 'none' },
    shape: null,
  };
}
