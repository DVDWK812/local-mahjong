import { describe, expect, it } from 'vitest';
import {
  getRulePreset,
  loadStoredRuleConfig,
  normalizeRulePresetId,
  RULE_CONFIG_STORAGE_KEY,
  saveStoredRuleConfig,
  validateRuleConfig,
} from './matchRules';

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

describe('比赛规则预设和校验', () => {
  it('加载东风场、南风场、自定义三个完整预设', () => {
    expect(getRulePreset('east-round').match.matchLength).toBe('east-only');
    expect(getRulePreset('south-round').match.matchLength).toBe('hanchan');
    expect(getRulePreset('east-round').match.roundCount).toBe(1);
    expect(getRulePreset('south-round').match.roundCount).toBe(2);
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

  it('累计役满默认按役满处理且预设不暴露其他模式', () => {
    expect(getRulePreset('east-round').round.kazoeYakumanMode).toBe('yakuman');
    expect(getRulePreset('south-round').round.kazoeYakumanMode).toBe('yakuman');
    expect(getRulePreset('custom').round.kazoeYakumanMode).toBe('yakuman');
  });

  it('旧配置缺少庄数时按比赛长度自动补齐', () => {
    const storage = memoryStorage();
    storage.setItem(RULE_CONFIG_STORAGE_KEY, JSON.stringify({
      version: 1,
      config: {
        ...getRulePreset('south-round'),
        match: { ...getRulePreset('south-round').match, roundCount: undefined },
      },
    }));
    expect(loadStoredRuleConfig(storage).match.roundCount).toBe(2);
  });

  it('击飞线默认保留为零', () => {
    expect(getRulePreset('custom').match.bankruptcyThreshold).toBe(0);
  });

  it('拒绝无效起始点数、马点、庄数和累计役满设置', () => {
    const config = getRulePreset('custom');
    expect(validateRuleConfig({ ...config, match: { ...config.match, startingPoints: 0 } }).errors).toContain('起始点数必须大于零');
    expect(validateRuleConfig({ ...config, match: { ...config.match, uma: [20, 10, -5, -20] } }).errors).toContain('马点合计必须为零');
    expect(validateRuleConfig({ ...config, match: { ...config.match, roundCount: 5 as any } }).errors).toContain('庄数必须为一到四之间的整数');
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
});
