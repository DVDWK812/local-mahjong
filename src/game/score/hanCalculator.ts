import type { Tile } from '../types';
import type { WinContext } from './yakuChecker';
import type { YakuResult } from './yaku/types';
import { defaultRuleConfig } from './rules/RuleConfig';

export interface HanResult {
  han: number;
  yakumanValue: number;
  hasYakuman: boolean;
}

export function calculateHan(yaku: YakuResult[], hand: Tile[], context: WinContext, dora: number, uraDora: number, redDora: number): HanResult {
  const config = { ...defaultRuleConfig, ...(context.ruleConfig ?? {}) };
  const yakumanValue = yaku
    .filter((item) => item.category === 'yakuman' || item.category === 'double_yakuman')
    .reduce((sum, item) => {
      const value = item.yakumanValue ?? (item.category === 'double_yakuman' ? 2 : 1);
      return sum + (config.multipleYakuman ? value : Math.min(value, 1));
    }, 0);

  if (yakumanValue > 0) return { han: 0, yakumanValue, hasYakuman: true };

  const baseHan = yaku
    .filter((item) => item.category === 'normal')
    .reduce((sum, item) => sum + (item.han ?? 0), 0);
  return { han: baseHan + dora + uraDora + (config.akaDora ? redDora : 0), yakumanValue: 0, hasYakuman: false };
}

export function countDora(hand: Tile[], indicators: Tile[]): number {
  const doraIds = indicators.map((tile) => nextDoraId(tile.id));
  return hand.filter((tile) => doraIds.includes(tile.id)).length;
}

function nextDoraId(id: number): number {
  if (id < 27) {
    const base = Math.floor(id / 9) * 9;
    return base + ((id - base + 1) % 9);
  }
  if (id <= 30) return 27 + ((id - 27 + 1) % 4);
  return 31 + ((id - 31 + 1) % 3);
}
