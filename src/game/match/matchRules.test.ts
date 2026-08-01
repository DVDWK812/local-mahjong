import { describe, expect, it } from 'vitest';
import {
  getRulePreset,
  loadStoredRuleConfigResult,
  loadStoredRuleConfig,
  normalizeRulePresetId,
  persistRuleConfigUpdate,
  removeStoredRuleConfig,
  RuleConfigStorageError,
  RULE_CONFIG_STORAGE_KEY,
  saveStoredRuleConfig,
  validateRuleConfig,
} from './matchRules';

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    peek: (key: string) => store.get(key) ?? null,
  };
}

describe('比赛规则预设和校验', () => {
  it('加载东风场、南风场、自定义三个完整预设', () => {
    expect(getRulePreset('east-round').match.matchLength).toBe('east-only');
    expect(getRulePreset('south-round').match.matchLength).toBe('hanchan');
    expect(getRulePreset('east-round').match.matchCount).toBe(1);
    expect(getRulePreset('south-round').match.matchCount).toBe(1);
    expect(getRulePreset('custom').match.startingPoints).toBe(25000);
  });

  it('兼容旧预设标识迁移', () => {
    expect(normalizeRulePresetId('mahjong-soul-style')).toBe('east-round');
    expect(normalizeRulePresetId('standard-competitive')).toBe('south-round');
    expect(getRulePreset('mahjong-soul-style').match.matchLength).toBe('east-only');
    expect(getRulePreset('standard-competitive').match.matchLength).toBe('hanchan');
  });

  it('默认开启国士无双抢暗杠', () => {
    expect(getRulePreset('east-round').round.allowKokushiChankanAnkan).toBe(true);
    expect(getRulePreset('south-round').round.allowKokushiChankanAnkan).toBe(true);
    expect(getRulePreset('custom').round.allowKokushiChankanAnkan).toBe(true);
  });

  it('四人东、四人南和自定义预设均默认开启三家和', () => {
    expect(getRulePreset('east-round').round.tripleRonMode).toBe('allow');
    expect(getRulePreset('south-round').round.tripleRonMode).toBe('allow');
    expect(getRulePreset('custom').round.tripleRonMode).toBe('allow');
  });

  it('四人东和四人南默认关闭听牌止、马点、头跳、古役和鸣牌留空，其余主要规则一致开启', () => {
    const east = getRulePreset('east-round');
    const south = getRulePreset('south-round');
    for (const config of [east, south]) {
      expect(config.match.tenpaiYame).toBe(false);
      expect(config.match.useUma).toBe(false);
      expect(config.match.useOka).toBe(false);
      expect(config.round.allowAncientYaku).toBe(false);
      expect(config.round.preserveClaimedDiscardGap).toBe(false);
      expect(config.round.allowOpenTanyao).toBe(true);
      expect(config.round.akaDora).toBe(true);
      expect(config.round.ippatsu).toBe(true);
      expect(config.round.kiriageMangan).toBe(true);
      expect(config.round.allowKokushiChankanAnkan).toBe(true);
    }
  });

  it('累计役满默认按役满处理且预设不暴露其他模式', () => {
    expect(getRulePreset('east-round').round.kazoeYakumanMode).toBe('yakuman');
    expect(getRulePreset('south-round').round.kazoeYakumanMode).toBe('yakuman');
    expect(getRulePreset('custom').round.kazoeYakumanMode).toBe('yakuman');
  });

  it('旧配置中的roundCount迁移为比赛场数', () => {
    const storage = memoryStorage();
    storage.setItem(RULE_CONFIG_STORAGE_KEY, JSON.stringify({
      version: 1,
      config: {
        ...getRulePreset('south-round'),
        match: { ...getRulePreset('south-round').match, matchCount: undefined, roundCount: 3 },
      },
    }));
    expect(loadStoredRuleConfig(storage).match.matchCount).toBe(3);
  });

  it('击飞线默认保留为零', () => {
    expect(getRulePreset('custom').match.bankruptcyThreshold).toBe(0);
  });

  it('拒绝无效起始点数、马点、比赛场数和累计役满设置', () => {
    const config = getRulePreset('custom');
    expect(validateRuleConfig({ ...config, match: { ...config.match, startingPoints: 0 } }).errors).toContain('起始点数必须大于零');
    expect(validateRuleConfig({ ...config, match: { ...config.match, uma: [20, 10, -5, -20] } }).errors).toContain('马点合计必须为零');
    expect(validateRuleConfig({ ...config, match: { ...config.match, matchCount: 5 as any } }).errors).toContain('比赛场数必须为一到四之间的整数');
    expect(validateRuleConfig({ ...config, round: { ...config.round, kazoeYakumanMode: 'bad' as any } }).errors).toContain('累计役满设置无效');
  });

  it('恢复有效本地设置，损坏设置回落到东风场', () => {
    const storage = memoryStorage();
    const config = getRulePreset('south-round');
    saveStoredRuleConfig(config, storage);
    expect(loadStoredRuleConfig(storage).match.matchLength).toBe('hanchan');
    storage.setItem(RULE_CONFIG_STORAGE_KEY, '{bad');
    expect(loadStoredRuleConfig(storage).match.matchLength).toBe('east-only');
  });

  it('读取抛错时返回默认配置和统一的读取错误，不让异常逃逸', () => {
    const failure = namedError('SecurityError', 'storage disabled');
    const result = loadStoredRuleConfigResult({
      getItem: () => { throw failure; },
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.config).toEqual(getRulePreset('east-round'));
    if (result.ok) throw new Error('Expected read failure');
    expect(result.error).toBeInstanceOf(RuleConfigStorageError);
    expect(result.error).toMatchObject({ operation: 'read', kind: 'security' });
  });

  it.each([
    ['SecurityError', 'security'],
    ['QuotaExceededError', 'quota'],
    ['Error', 'unknown'],
  ] as const)('写入抛 %s 时返回失败、保留原配置且不抛异常', (name, kind) => {
    const original = JSON.stringify({ version: 1, config: getRulePreset('south-round') });
    const values = new Map([[RULE_CONFIG_STORAGE_KEY, original]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => { throw namedError(name, 'write failed'); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const next = { ...getRulePreset('east-round'), match: { ...getRulePreset('east-round').match, targetPoints: 32000 } };
    const outcome = persistRuleConfigUpdate(next, storage);
    expect(outcome.result).toMatchObject({ ok: false, error: { operation: 'write', kind } });
    expect(outcome.config).toBe(next);
    expect(outcome.config.match.targetPoints).toBe(32000);
    expect(outcome.notice).toContain('已应用');
    expect(values.get(RULE_CONFIG_STORAGE_KEY)).toBe(original);
  });

  it('删除抛错时返回统一错误并保留原配置', () => {
    const original = JSON.stringify({ version: 1, config: getRulePreset('south-round') });
    const values = new Map([[RULE_CONFIG_STORAGE_KEY, original]]);
    const result = removeStoredRuleConfig({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: () => { throw namedError('SecurityError', 'remove failed'); },
    });
    expect(result).toMatchObject({ ok: false, error: { operation: 'remove', kind: 'security' } });
    expect(values.get(RULE_CONFIG_STORAGE_KEY)).toBe(original);
  });

  it('普通浏览器适配器成功写入与删除路径保持不变', () => {
    const storage = memoryStorage();
    expect(saveStoredRuleConfig(getRulePreset('south-round'), storage)).toEqual({ ok: true });
    expect(persistRuleConfigUpdate(getRulePreset('south-round'), storage).notice).toBeNull();
    expect(loadStoredRuleConfig(storage).match.matchLength).toBe('hanchan');
    expect(removeStoredRuleConfig(storage)).toEqual({ ok: true });
    expect(storage.peek(RULE_CONFIG_STORAGE_KEY)).toBeNull();
  });
});

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}
