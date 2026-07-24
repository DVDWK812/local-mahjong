import type { MatchRuleConfig } from './types';
import { defaultRuleConfig, type RuleConfig } from '../score/rules/RuleConfig';
import type { FullRuleConfig } from './types';

export type RulePresetId = 'east-round' | 'south-round' | 'custom';
export type LegacyRulePresetId = 'mahjong-soul-style' | 'standard-competitive';
export type RulePresetInput = RulePresetId | LegacyRulePresetId;

export const defaultMatchRuleConfig: MatchRuleConfig = {
  matchLength: 'east-only',
  roundCount: 1,
  startingPoints: 25000,
  targetPoints: 30000,
  returnPoints: 30000,
  bankruptcyEndsMatch: true,
  bankruptcyThreshold: 0,
  dealerContinuationOnWin: true,
  dealerContinuationOnTenpaiDraw: true,
  agariYame: true,
  tenpaiYame: false,
  agariYameMode: 'automatic',
  tenpaiYameMode: 'automatic',
  allowWestRound: true,
  maxExtraRoundWind: 'west',
  suddenDeathTarget: 30000,
  carryRiichiSticksToNextRound: true,
  leftoverRiichiStickMode: 'first-place',
  useUma: false,
  uma: [20, 10, -10, -20],
  useOka: false,
};

export function normalizeRulePresetId(id: RulePresetInput): RulePresetId {
  if (id === 'mahjong-soul-style') return 'east-round';
  if (id === 'standard-competitive') return 'south-round';
  return id;
}

export function normalizeMatchRuleConfig(overrides: Partial<MatchRuleConfig> = {}): MatchRuleConfig {
  const config = { ...defaultMatchRuleConfig, ...overrides };
  if (overrides.roundCount === undefined) {
    config.roundCount = config.matchLength === 'hanchan' ? 2 : 1;
  }
  if (config.useUma) validateUma(config.uma);
  return config;
}

export function createFullRuleConfig(round: Partial<RuleConfig> = {}, match: Partial<MatchRuleConfig> = {}): FullRuleConfig {
  return {
    round: { ...defaultRuleConfig, ...round },
    match: normalizeMatchRuleConfig(match),
  };
}

export function getRulePreset(id: RulePresetInput): FullRuleConfig {
  const normalized = normalizeRulePresetId(id);
  if (normalized === 'south-round') {
    return createFullRuleConfig(
      {
        allowAncientYaku: false,
        allowOpenTanyao: true,
        akaDora: true,
        ippatsu: true,
        allowKokushiChankanAnkan: true,
        kiriageMangan: false,
        kazoeYakumanMode: 'yakuman',
      },
      {
        matchLength: 'hanchan',
        roundCount: 2,
        useUma: true,
        useOka: true,
        tenpaiYame: true,
        tenpaiYameMode: 'player-choice',
      },
    );
  }
  if (normalized === 'east-round') {
    return createFullRuleConfig(
      {
        allowOpenTanyao: true,
        akaDora: true,
        ippatsu: true,
        allowDoubleYakuman: true,
        multipleYakuman: true,
        allowKokushiChankanAnkan: true,
        kiriageMangan: true,
        kazoeYakumanMode: 'yakuman',
        tripleRonMode: 'allow',
      },
      {
        matchLength: 'east-only',
        roundCount: 1,
        agariYame: true,
        agariYameMode: 'automatic',
        tenpaiYame: false,
        useUma: false,
        useOka: false,
      },
    );
  }
  return createFullRuleConfig();
}

export interface RuleConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRuleConfig(config: FullRuleConfig): RuleConfigValidationResult {
  const errors: string[] = [];
  const match = config.match;
  const round = config.round;
  if (!Number.isFinite(match.startingPoints) || match.startingPoints <= 0) errors.push('起始点数必须大于零');
  if (!Number.isFinite(match.targetPoints) || match.targetPoints < match.startingPoints) errors.push('目标点数不能低于起始点数');
  if (!Number.isFinite(match.returnPoints) || match.returnPoints <= 0) errors.push('返还点必须大于零');
  if (!Array.isArray(match.uma) || match.uma.length !== 4) errors.push('马点必须包含四个数值');
  else if (Math.abs(match.uma.reduce((sum, value) => sum + value, 0)) > 0.0001) errors.push('马点合计必须为零');
  if (!Number.isFinite(match.bankruptcyThreshold)) errors.push('击飞线必须是有效数值');
  if (!match.allowWestRound && match.maxExtraRoundWind !== 'none') errors.push('关闭延长局时，最大延长场风必须为无');
  if (!Number.isFinite(match.suddenDeathTarget) || match.suddenDeathTarget <= 0) errors.push('突然死亡目标必须大于零');
  if (![1, 2, 3, 4].includes(match.roundCount)) errors.push('庄数必须为一到四之间的整数');
  if (!['disabled', 'sanbaiman', 'yakuman'].includes(round.kazoeYakumanMode)) errors.push('累计役满设置无效');
  return { valid: errors.length === 0, errors };
}

export const RULE_CONFIG_STORAGE_KEY = 'local-mahjong.rule-config.v1';

export function loadStoredRuleConfig(storage: Pick<Storage, 'getItem'> = localStorage): FullRuleConfig {
  try {
    const raw = storage.getItem(RULE_CONFIG_STORAGE_KEY);
    if (!raw) return getRulePreset('east-round');
    const parsed = JSON.parse(raw) as { version?: number; config?: FullRuleConfig };
    const config = parsed.version === 1 && parsed.config
      ? createFullRuleConfig(parsed.config.round, parsed.config.match)
      : getRulePreset('east-round');
    return validateRuleConfig(config).valid ? config : getRulePreset('east-round');
  } catch {
    return getRulePreset('east-round');
  }
}

export function saveStoredRuleConfig(config: FullRuleConfig, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(RULE_CONFIG_STORAGE_KEY, JSON.stringify({ version: 1, config }));
}

export function validateUma(uma: [number, number, number, number]): void {
  const total = uma.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total) > 0.0001) throw new Error('马点合计必须为零');
}

export function scheduledFinalWind(config: Pick<MatchRuleConfig, 'matchLength'> & Partial<Pick<MatchRuleConfig, 'roundCount'>> | MatchRuleConfig['matchLength']) {
  if (typeof config === 'string') return config === 'east-only' ? 'east' : 'south';
  const roundCount = config.roundCount ?? (config.matchLength === 'east-only' ? 1 : 2);
  if (roundCount <= 1) return 'east';
  if (roundCount === 2) return 'south';
  if (roundCount === 3) return 'west';
  return 'north';
}

export function maxExtraWindIndex(config: MatchRuleConfig): number {
  if (config.maxExtraRoundWind === 'none') {
    const scheduled = scheduledFinalWind(config);
    if (scheduled === 'east') return 0;
    if (scheduled === 'south') return 1;
    if (scheduled === 'west') return 2;
    return 3;
  }
  if (config.maxExtraRoundWind === 'south') return 1;
  return config.maxExtraRoundWind === 'west' ? 2 : 3;
}
