import type { Tile } from '../../types';
import type { HandShape, WinContext } from '../yakuChecker';
import { defaultRuleConfig } from '../rules/RuleConfig';
import type { YakuResult } from '../yaku/types';
import { isPinfuShape, meldFu, pairFu, roundFu } from './fuUtils';
import type { FuContext, FuMeld, WaitType } from './fuRules';

export type { FuContext, FuMeld, WaitType, WinType } from './fuRules';

export interface FuBreakdown {
  baseFu: number;
  winFu: number;
  waitFu: number;
  pairFu: number;
  meldFu: number;
  totalBeforeRounding: number;
  total: number;
  fixedReason?: 'seven-pairs' | 'pinfu-tsumo';
}

const WAIT_FU: Record<WaitType, number> = {
  ryanmen: 0,
  shanpon: 0,
  kanchan: 2,
  penchan: 2,
  tanki: 2,
};

export function calculateFu(context: FuContext): number;
export function calculateFu(context: WinContext, shape: HandShape, hand?: Tile[], yakuList?: YakuResult[]): number;
export function calculateFu(context: FuContext | WinContext, shape?: HandShape, hand: Tile[] = [], yakuList: YakuResult[] = []): number {
  return calculateFuDetailsInternal(context, shape, hand, yakuList).total;
}

export function calculateFuDetails(context: FuContext): FuBreakdown;
export function calculateFuDetails(context: WinContext, shape: HandShape, hand?: Tile[], yakuList?: YakuResult[]): FuBreakdown;
export function calculateFuDetails(context: FuContext | WinContext, shape?: HandShape, hand: Tile[] = [], yakuList: YakuResult[] = []): FuBreakdown {
  return calculateFuDetailsInternal(context, shape, hand, yakuList);
}

function calculateFuDetailsInternal(context: FuContext | WinContext, shape?: HandShape, hand: Tile[] = [], yakuList: YakuResult[] = []): FuBreakdown {
  const fuContext = isFuContext(context) ? context : fromWinContext(context, shape, hand, yakuList);
  if (!fuContext) return fixedBreakdown(0);
  if (isSevenPairs(fuContext)) return fixedBreakdown(25, 'seven-pairs');
  if (isPinfuTsumo(fuContext)) return fixedBreakdown(20, 'pinfu-tsumo');

  const ruleConfig = { ...defaultRuleConfig, ...(fuContext.ruleConfig ?? {}) };
  const baseFu = 20;
  const winFu = (fuContext.isMenzen && fuContext.isRon ? 10 : 0) + (fuContext.isTsumo ? 2 : 0);
  const waitFu = WAIT_FU[fuContext.waitType];
  const headFu = pairFu(fuContext.pair, fuContext.seatWind, fuContext.roundWind, ruleConfig.doubleWindPairFu);
  const bodyFu = fuContext.melds.reduce((sum, meld) => sum + meldFu(meld), 0);
  const totalBeforeRounding = baseFu + winFu + waitFu + headFu + bodyFu;
  return {
    baseFu,
    winFu,
    waitFu,
    pairFu: headFu,
    meldFu: bodyFu,
    totalBeforeRounding,
    total: totalBeforeRounding === 20 ? 30 : roundFu(totalBeforeRounding),
  };
}

function fixedBreakdown(total: number, fixedReason?: FuBreakdown['fixedReason']): FuBreakdown {
  return {
    baseFu: total,
    winFu: 0,
    waitFu: 0,
    pairFu: 0,
    meldFu: 0,
    totalBeforeRounding: total,
    total,
    fixedReason,
  };
}

function isFuContext(context: FuContext | WinContext): context is FuContext {
  return 'winningTile' in context && 'waitType' in context && 'winType' in context;
}

function fromWinContext(context: WinContext, shape?: HandShape, hand: Tile[] = [], yakuList: YakuResult[] = []): FuContext | null {
  if (!shape) return null;
  const melds = shape.melds.map((meld): FuMeld => ({
    type: meld.type,
    ids: meld.ids,
    open: meld.open ?? inferOpen(context, meld, shape),
    kanType: meld.kanType,
  }));
  return {
    hand,
    winningTile: context.winTile,
    melds,
    pair: shape.pair,
    waitType: inferWaitType(context, shape),
    winType: context.isTsumo ? 'tsumo' : 'ron',
    isMenzen: context.isMenzen,
    isTsumo: context.isTsumo,
    isRon: !context.isTsumo,
    seatWind: context.seatWind,
    roundWind: context.roundWind,
    yakuList,
    ruleConfig: context.ruleConfig,
  };
}

function inferOpen(context: WinContext, meld: HandShape['melds'][number], shape: HandShape): boolean {
  if (context.isMenzen) return false;
  if (!context.isTsumo && meld.type === 'triplet' && meld.ids[0] === context.winTile.id && shape.pair !== context.winTile.id) return true;
  if (context.isTsumo && meld.type === 'triplet' && meld.ids[0] === context.winTile.id && shape.pair !== context.winTile.id) return false;
  return true;
}

function inferWaitType(context: WinContext, shape: HandShape): WaitType {
  if (shape.pair === context.winTile.id) return 'tanki';
  const sequence = shape.melds.find((meld) => meld.type === 'sequence' && meld.ids.includes(context.winTile.id));
  if (sequence) {
    const [first, , third] = sequence.ids;
    if (context.winTile.id === first + 1) return 'kanchan';
    if ((first % 9 === 0 && context.winTile.id === third) || (first % 9 === 6 && context.winTile.id === first)) return 'penchan';
    return 'ryanmen';
  }
  if (shape.melds.some((meld) => meld.type !== 'sequence' && meld.ids[0] === context.winTile.id)) return 'shanpon';
  return 'ryanmen';
}

function isSevenPairs(context: FuContext): boolean {
  return context.yakuList.some((yaku) => yaku.name === '七对子') || (context.pair === null && context.melds.length === 0);
}

function isPinfuTsumo(context: FuContext): boolean {
  return context.isMenzen
    && context.isTsumo
    && context.waitType === 'ryanmen'
    && isPinfuShape(context.melds, context.pair, context.seatWind, context.roundWind);
}
