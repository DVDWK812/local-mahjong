import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getRulePreset, loadStoredRuleConfig, saveStoredRuleConfig } from '../game/match/matchRules';
import { ruleDescriptions } from '../game/rules/ruleDescriptions';
import { buildUma, DEFAULT_AI_PLAYER_SETTINGS, MatchSettings, normalizeMatchSettingsConfig } from './MatchSettings';

describe('比赛设置界面', () => {
  it('不显示规则预设下拉框', () => {
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('east-round')} onConfigChange={() => undefined} />);
    expect(html).not.toContain('规则预设');
    expect(html).not.toContain('自定义预设');
  });

  it('不显示比赛长度下拉框', () => {
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('east-round')} onConfigChange={() => undefined} />);
    expect(html).not.toContain('比赛长度');
    expect(html).not.toContain('value="east-only"');
    expect(html).not.toContain('value="hanchan"');
  });

  it('四人东显示只读比赛类型并固定为 east-only', () => {
    const config = getRulePreset('east-round');
    const html = renderToStaticMarkup(
      <MatchSettings config={config} matchTypeLabel="四人东" pathLabel="本地模式 ＞ 立直麻将 ＞ 四人间 ＞ 四人东" onConfigChange={() => undefined} />,
    );
    expect(html).toContain('比赛类型');
    expect(html).toContain('四人东');
    expect(normalizeMatchSettingsConfig(config, { matchLength: 'hanchan' }).match.matchLength).toBe('east-only');
  });

  it('四人南显示只读比赛类型并固定为 hanchan', () => {
    const config = getRulePreset('south-round');
    const html = renderToStaticMarkup(
      <MatchSettings config={config} matchTypeLabel="四人南" pathLabel="本地模式 ＞ 立直麻将 ＞ 四人间 ＞ 四人南" onConfigChange={() => undefined} />,
    );
    expect(html).toContain('比赛类型');
    expect(html).toContain('四人南');
    expect(normalizeMatchSettingsConfig(config, { matchLength: 'east-only' }).match.matchLength).toBe('hanchan');
  });

  it('比赛信息页为三名AI分别显示难度和性格下拉框', () => {
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('east-round')} onConfigChange={() => undefined} />);
    expect(html).toContain('AI难度');
    expect((html.match(/class="ai-setting-row"/g) ?? [])).toHaveLength(3);
    expect(html).toContain('AI 玩家 2');
    expect(html).toContain('AI 玩家 3');
    expect(html).toContain('AI 玩家 4');
    expect(html).toContain('筑根（简单）');
    expect(html).toContain('心转手（中等）');
    expect(html).toContain('上层（难）');
    expect(html).toContain('鬼神（地狱）');
    expect(html).toContain('沉稳老练（防守向）');
    expect(html).toContain('锋芒毕露（进攻向）');
    expect(html).toContain('稳步进取（平衡向）');
  });

  it('三名AI默认使用筑根难度和稳步进取性格', () => {
    expect(DEFAULT_AI_PLAYER_SETTINGS).toEqual([
      { playerId: 1, difficulty: 'chikukon', personality: 'balanced' },
      { playerId: 2, difficulty: 'chikukon', personality: 'balanced' },
      { playerId: 3, difficulty: 'chikukon', personality: 'balanced' },
    ]);
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('east-round')} onConfigChange={() => undefined} />);
    expect((html.match(/value="chikukon" selected=""/g) ?? [])).toHaveLength(3);
    expect((html.match(/value="balanced" selected=""/g) ?? [])).toHaveLength(3);
    expect(html).toContain('不改变现有 AI 行为');
  });

  it('不显示突然死亡目标输入框，目标点数变化会同步 suddenDeathTarget', () => {
    const config = getRulePreset('east-round');
    const html = renderToStaticMarkup(<MatchSettings config={config} onConfigChange={() => undefined} />);
    const next = normalizeMatchSettingsConfig(config, { targetPoints: 32000 });
    expect(html).not.toContain('突然死亡目标');
    expect(next.match.targetPoints).toBe(32000);
    expect(next.match.suddenDeathTarget).toBe(32000);
  });

  it('不显示和牌止模式与听牌止模式，下发配置固定为自动', () => {
    const config = getRulePreset('east-round');
    const html = renderToStaticMarkup(<MatchSettings config={config} onConfigChange={() => undefined} />);
    const next = normalizeMatchSettingsConfig(config, { agariYameMode: 'player-choice', tenpaiYameMode: 'player-choice' });
    expect(html).not.toContain('和牌止模式');
    expect(html).not.toContain('听牌止模式');
    expect(next.match.agariYameMode).toBe('automatic');
    expect(next.match.tenpaiYameMode).toBe('automatic');
  });

  it('下拉规则统一显示在整场规则和单局规则之前', () => {
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('south-round')} onConfigChange={() => undefined} />);
    expect(html.indexOf('下拉规则')).toBeLessThan(html.indexOf('整场规则'));
    expect(html.indexOf('整场规则')).toBeLessThan(html.indexOf('单局规则'));
    expect(html).toContain('残余供托');
  });

  it('三家和位于单局规则并使用默认开启的点按开关', () => {
    const config = getRulePreset('east-round');
    const html = renderToStaticMarkup(<MatchSettings config={config} onConfigChange={() => undefined} />);
    expect(html.indexOf('单局规则')).toBeLessThan(html.indexOf('三家和'));
    expect(html).toMatch(/<label class="settings-check"><input type="checkbox" checked=""\/><span>三家和<\/span>/);
    expect(html).not.toContain('<option value="allow">');
    expect(html).not.toContain('<option value="abortive-draw">');
    expect(config.round.tripleRonMode).toBe('allow');
  });

  it('旧配置缺少三家和字段时按开启处理', () => {
    const config = getRulePreset('east-round');
    const legacy = {
      ...config,
      round: Object.fromEntries(Object.entries(config.round).filter(([key]) => key !== 'tripleRonMode')) as typeof config.round,
    };
    expect(normalizeMatchSettingsConfig(legacy).round.tripleRonMode).toBe('allow');
  });

  it('不显示累计役满规则说明和下拉条', () => {
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('east-round')} onConfigChange={() => undefined} />);
    expect(html).not.toContain('数え役满');
    expect(html).not.toContain('累计役满');
    expect(html).not.toContain('value="sanbaiman"');
    expect(ruleDescriptions).not.toHaveProperty('kazoeYakumanMode');
  });

  it('鸣牌留空默认关闭，并在设置页显示说明', () => {
    const config = getRulePreset('east-round');
    const html = renderToStaticMarkup(<MatchSettings config={config} onConfigChange={() => undefined} />);
    expect(config.round.preserveClaimedDiscardGap).toBe(false);
    expect(html).toContain('鸣牌留空');
    expect(html).toContain('被吃、碰或杠走的弃牌会在原牌河位置留下空白');
    expect(html.indexOf('辅助显示')).toBeLessThan(html.indexOf('鸣牌留空'));
  });

  it('辅助显示默认开启宝牌闪光、悬停同牌、听牌剩余量和摸切显示', () => {
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('east-round')} onConfigChange={() => undefined} />);
    expect(html).toContain('宝牌闪光效果');
    expect(html).toContain('悬停显示相同牌');
    expect(html).toContain('显示听牌与剩余量');
    expect(html).toContain('摸切显示');
  });

  it('旧配置缺少鸣牌留空字段时按关闭处理', () => {
    const config = getRulePreset('east-round');
    const legacy = {
      ...config,
      round: Object.fromEntries(Object.entries(config.round).filter(([key]) => key !== 'preserveClaimedDiscardGap')) as typeof config.round,
    };
    expect(normalizeMatchSettingsConfig(legacy).round.preserveClaimedDiscardGap).toBe(false);
  });

  it('四人东最大延长场风可以选择南风', () => {
    const config = { ...getRulePreset('east-round'), match: { ...getRulePreset('east-round').match, allowWestRound: true } };
    const html = renderToStaticMarkup(<MatchSettings config={config} onConfigChange={() => undefined} />);
    expect(html).toContain('最大延长场风');
    expect(html).toContain('value="south"');
    expect(html).toContain('>南</option>');
    expect(html).toContain('<option value="none">不延长</option>');
  });

  it('显示比赛场数并把输入限制在一到四场', () => {
    const config = getRulePreset('east-round');
    const html = renderToStaticMarkup(<MatchSettings config={config} onConfigChange={() => undefined} />);
    expect(html).toContain('比赛场数');
    expect(html).toContain(ruleDescriptions.matchCount);
    expect(normalizeMatchSettingsConfig(config, { matchCount: 3 }).match.matchCount).toBe(3);
    expect(normalizeMatchSettingsConfig(config, { matchCount: 9 as any }).match.matchCount).toBe(4);
    expect(normalizeMatchSettingsConfig(config, { matchCount: 0 as any }).match.matchCount).toBe(1);
  });

  it('关闭延长局后不显示最大延长场风', () => {
    const config = getRulePreset('east-round');
    const html = renderToStaticMarkup(
      <MatchSettings config={{ ...config, match: { ...config.match, allowWestRound: false, maxExtraRoundWind: 'none' } }} onConfigChange={() => undefined} />,
    );
    expect(html).not.toContain('最大延长场风');
  });

  it('开启马点后显示两个奖励输入框，关闭后隐藏', () => {
    const config = getRulePreset('custom');
    const enabled = renderToStaticMarkup(<MatchSettings config={{ ...config, match: { ...config.match, useUma: true } }} onConfigChange={() => undefined} />);
    const disabled = renderToStaticMarkup(<MatchSettings config={{ ...config, match: { ...config.match, useUma: false } }} onConfigChange={() => undefined} />);
    expect(enabled).toContain('第一名奖励');
    expect(enabled).toContain('第二名奖励');
    expect(disabled).not.toContain('第一名奖励');
    expect(disabled).not.toContain('第二名奖励');
  });

  it('马点 20 和 10 自动生成四人马点数组', () => {
    expect(buildUma(20, 10)).toEqual([20, 10, -10, -20]);
  });

  it('修改第一名和第二名奖励后自动更新 uma', () => {
    expect(buildUma(30, 10)).toEqual([30, 10, -10, -30]);
    expect(buildUma(20, 15)).toEqual([20, 15, -15, -20]);
  });

  it('比赛设置组件本身不渲染返回按钮', () => {
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('east-round')} onConfigChange={() => undefined} />);
    expect(html).not.toContain('返回');
  });

  it('所有显示的规则项都有圆圈问号说明按钮', () => {
    const html = renderToStaticMarkup(<MatchSettings config={getRulePreset('south-round')} onConfigChange={() => undefined} />);
    const helpButtons = html.match(/aria-label="查看规则说明"/g) ?? [];
    expect(helpButtons.length).toBeGreaterThanOrEqual(26);
    expect(html).toContain(ruleDescriptions.useUma);
    expect(html).toContain(ruleDescriptions.targetPoints);
  });

  it('保留旧配置和旧存档字段读取兼容', () => {
    const storage = new Map<string, string>();
    const localStorageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size;
      },
    } as Storage;
    const config = getRulePreset('south-round');
    saveStoredRuleConfig({ ...config, match: { ...config.match, suddenDeathTarget: 33000 } }, localStorageLike);
    const loaded = loadStoredRuleConfig(localStorageLike);
    expect(loaded.match.matchLength).toBe('hanchan');
    expect(loaded.match.suddenDeathTarget).toBe(33000);
  });
});
