import type { MatchRuleConfig } from './types';
import { defaultRuleConfig, type RuleConfig } from '../score/rules/RuleConfig';
import type { FullRuleConfig } from './types';

export type RulePresetId = 'east-round' | 'south-round' | 'custom';
export type LegacyRulePresetId = 'mahjong-soul-style' | 'standard-competitive';
export type RulePresetInput = RulePresetId | LegacyRulePresetId;

export const defaultMatchRuleConfig: MatchRuleConfig = {
  matchLength: 'east-only',
  matchCount: 1,
  startingPoints: 25000,
  targetPoints: 30000,
  returnPoints: 25000,
  bankruptcyEndsMatch: true,
  bankruptcyThreshold: 0,
  dealerContinuationOnWin: true,
  dealerContinuationOnTenpaiDraw: true,
  agariYame: true,
  tenpaiYame: false,
  agariYameMode: 'automatic',
  tenpaiYameMode: 'automatic',
  allowWestRound: true,
  maxExtraRoundWind: 'south',
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

export type MatchRuleConfigInput = Partial<MatchRuleConfig> & { roundCount?: number };

export function normalizeMatchRuleConfig(overrides: MatchRuleConfigInput = {}): MatchRuleConfig {
  const { roundCount: legacyRoundCount, ...current } = overrides;
  const config = {
    ...defaultMatchRuleConfig,
    ...current,
    matchCount: normalizeMatchCount(current.matchCount ?? legacyRoundCount ?? defaultMatchRuleConfig.matchCount),
  };
  if (config.matchLength === 'hanchan' && config.maxExtraRoundWind === 'south') {
    config.maxExtraRoundWind = 'west';
  }
  if (config.useUma) validateUma(config.uma);
  return config;
}

export function createFullRuleConfig(round: Partial<RuleConfig> = {}, match: MatchRuleConfigInput = {}): FullRuleConfig {
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
        kiriageMangan: true,
        kazoeYakumanMode: 'yakuman',
        tripleRonMode: 'allow',
      },
      {
        matchLength: 'hanchan',
        matchCount: 1,
        returnPoints: 25000,
        maxExtraRoundWind: 'west',
        useUma: false,
        useOka: false,
        tenpaiYame: false,
        tenpaiYameMode: 'automatic',
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
        matchCount: 1,
        returnPoints: 25000,
        maxExtraRoundWind: 'south',
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
  if (![1, 2, 3, 4].includes(match.matchCount)) errors.push('比赛场数必须为一到四之间的整数');
  if (!['disabled', 'sanbaiman', 'yakuman'].includes(round.kazoeYakumanMode)) errors.push('累计役满设置无效');
  return { valid: errors.length === 0, errors };
}

export const RULE_CONFIG_STORAGE_KEY = 'local-mahjong.rule-config.v1';

export interface RuleConfigStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type RuleConfigStorageOperation = 'read' | 'write' | 'remove';
export type RuleConfigStorageErrorKind = 'security' | 'quota' | 'invalid-data' | 'unknown';

export class RuleConfigStorageError extends Error {
  readonly operation: RuleConfigStorageOperation;
  readonly kind: RuleConfigStorageErrorKind;
  readonly cause: unknown;

  constructor(operation: RuleConfigStorageOperation, cause: unknown, kind = classifyStorageError(cause)) {
    super(`规则配置${operationLabel(operation)}失败：${errorMessage(cause)}`);
    this.name = 'RuleConfigStorageError';
    this.operation = operation;
    this.kind = kind;
    this.cause = cause;
  }
}

export type RuleConfigStorageResult =
  | { ok: true }
  | { ok: false; error: RuleConfigStorageError };

export type RuleConfigLoadResult =
  | { ok: true; config: FullRuleConfig }
  | { ok: false; config: FullRuleConfig; error: RuleConfigStorageError };

export const RULE_CONFIG_SAVE_FAILURE_NOTICE = '规则设置已应用，但无法保存到浏览器；刷新页面后可能恢复原设置。';

export function createRuleConfigStorageAdapter(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): RuleConfigStorageAdapter {
  return {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
  };
}

export function loadStoredRuleConfigResult(storage?: RuleConfigStorageAdapter): RuleConfigLoadResult {
  try {
    const target = storage ?? defaultRuleConfigStorage();
    const raw = target.getItem(RULE_CONFIG_STORAGE_KEY);
    if (!raw) return { ok: true, config: getRulePreset('east-round') };
    const parsed = JSON.parse(raw) as { version?: number; config?: FullRuleConfig };
    if (parsed.version !== 1 || !parsed.config) {
      return failedLoad(new Error('配置版本或内容无效'), 'invalid-data');
    }
    const config = createFullRuleConfig(parsed.config.round, parsed.config.match);
    if (!validateRuleConfig(config).valid) return failedLoad(new Error('配置校验失败'), 'invalid-data');
    return { ok: true, config };
  } catch (error) {
    return failedLoad(error, error instanceof SyntaxError ? 'invalid-data' : undefined);
  }
}

export function loadStoredRuleConfig(storage?: RuleConfigStorageAdapter): FullRuleConfig {
  return loadStoredRuleConfigResult(storage).config;
}

export function saveStoredRuleConfig(config: FullRuleConfig, storage?: RuleConfigStorageAdapter): RuleConfigStorageResult {
  try {
    const target = storage ?? defaultRuleConfigStorage();
    target.setItem(RULE_CONFIG_STORAGE_KEY, JSON.stringify({ version: 1, config }));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: new RuleConfigStorageError('write', error) };
  }
}

export function persistRuleConfigUpdate(config: FullRuleConfig, storage?: RuleConfigStorageAdapter): {
  config: FullRuleConfig;
  result: RuleConfigStorageResult;
  notice: string | null;
} {
  const result = saveStoredRuleConfig(config, storage);
  return { config, result, notice: result.ok ? null : RULE_CONFIG_SAVE_FAILURE_NOTICE };
}

export function removeStoredRuleConfig(storage?: RuleConfigStorageAdapter): RuleConfigStorageResult {
  try {
    const target = storage ?? defaultRuleConfigStorage();
    target.removeItem(RULE_CONFIG_STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: new RuleConfigStorageError('remove', error) };
  }
}

function failedLoad(error: unknown, kind?: RuleConfigStorageErrorKind): RuleConfigLoadResult {
  return { ok: false, config: getRulePreset('east-round'), error: new RuleConfigStorageError('read', error, kind) };
}

function defaultRuleConfigStorage(): RuleConfigStorageAdapter {
  if (typeof localStorage === 'undefined') throw new RuleConfigStorageError('read', new Error('localStorage 不可用'));
  return createRuleConfigStorageAdapter(localStorage);
}

function classifyStorageError(error: unknown): RuleConfigStorageErrorKind {
  const name = error instanceof Error ? error.name : '';
  if (name === 'SecurityError') return 'security';
  if (name === 'QuotaExceededError') return 'quota';
  return 'unknown';
}

function operationLabel(operation: RuleConfigStorageOperation): string {
  if (operation === 'read') return '读取';
  if (operation === 'write') return '写入';
  return '删除';
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '未知存储错误';
}

export function validateUma(uma: [number, number, number, number]): void {
  const total = uma.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total) > 0.0001) throw new Error('马点合计必须为零');
}

export function scheduledFinalWind(config: Pick<MatchRuleConfig, 'matchLength'> | MatchRuleConfig['matchLength']) {
  const matchLength = typeof config === 'string' ? config : config.matchLength;
  return matchLength === 'east-only' ? 'east' : 'south';
}

function normalizeMatchCount(value: number): 1 | 2 | 3 | 4 {
  const rounded = Math.round(Number(value) || 1);
  return Math.min(4, Math.max(1, rounded)) as 1 | 2 | 3 | 4;
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
