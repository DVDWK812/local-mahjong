import type { WinContext } from './yakuChecker';
import { defaultRuleConfig } from './rules/RuleConfig';

export interface PointResult {
  ron?: number;
  tsumoDealer?: number;
  tsumoChild?: number;
  total: number;
  limitName?: string;
}

export function calculatePoints(han: number, fu: number, context: WinContext, yakumanValue = 0): PointResult {
  if (yakumanValue > 0) return calculateYakumanPoints(yakumanValue, context);
  if (han <= 0) return { total: 0 };

  const config = { ...defaultRuleConfig, ...(context.ruleConfig ?? {}) };
  if (han >= 13 && config.kazoeYakumanMode === 'yakuman') return calculateYakumanPoints(1, context, '数え役满');

  const isDealer = context.seatWind === 'east';
  const limit = limitBasePoints(han, fu, config.kiriageMangan);
  const base = limit.basePoints;
  const honbaBonus = context.honba * 300;
  const stickBonus = context.riichiSticks * 1000;

  if (context.isTsumo) {
    if (isDealer) {
      const each = roundUp(base * 2, 100) + context.honba * 100;
      return { tsumoChild: each, total: each * 3 + stickBonus, limitName: limit.name };
    }
    const child = roundUp(base, 100) + context.honba * 100;
    const dealer = roundUp(base * 2, 100) + context.honba * 100;
    return { tsumoDealer: dealer, tsumoChild: child, total: dealer + child * 2 + stickBonus, limitName: limit.name };
  }

  const ron = roundUp(base * (isDealer ? 6 : 4), 100) + honbaBonus + stickBonus;
  return { ron, total: ron, limitName: limit.name };
}

function calculateYakumanPoints(yakumanValue: number, context: WinContext, limitName?: string): PointResult {
  const isDealer = context.seatWind === 'east';
  const base = 8000 * yakumanValue;
  const stickBonus = context.riichiSticks * 1000;
  const name = limitName ?? (yakumanValue > 1 ? `${yakumanValue}倍役满` : '役满');

  if (context.isTsumo) {
    if (isDealer) {
      const each = base * 2 + context.honba * 100;
      return { tsumoChild: each, total: each * 3 + stickBonus, limitName: name };
    }
    const child = base + context.honba * 100;
    const dealer = base * 2 + context.honba * 100;
    return { tsumoDealer: dealer, tsumoChild: child, total: dealer + child * 2 + stickBonus, limitName: name };
  }

  const ron = base * (isDealer ? 6 : 4) + context.honba * 300 + stickBonus;
  return { ron, total: ron, limitName: name };
}

function limitBasePoints(han: number, fu: number, kiriageMangan: boolean): { basePoints: number; name?: string } {
  if (han >= 13) return { basePoints: 6000, name: '三倍满' };
  if (han >= 11) return { basePoints: 6000, name: '三倍满' };
  if (han >= 8) return { basePoints: 4000, name: '倍满' };
  if (han >= 6) return { basePoints: 3000, name: '跳满' };
  if (han >= 5) return { basePoints: 2000, name: '满贯' };
  const base = fu * 2 ** (han + 2);
  if (kiriageMangan && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) return { basePoints: 2000, name: '切上满贯' };
  if (base >= 2000) return { basePoints: 2000, name: '满贯' };
  return { basePoints: base };
}

function roundUp(value: number, unit: number): number {
  return Math.ceil(value / unit) * unit;
}
