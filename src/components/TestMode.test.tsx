import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MainMenu } from './MainMenu';
import { resolveTestModeControlPlayer, TestModeScreen } from './TestModeScreen';
import { TestModeDebugPanel } from './TestModeDebugPanel';
import { ReplayScreen } from './ReplayScreen';
import { getBuiltInTestScenario } from '../game/testMode/builtInScenarios';
import { createTestModeMatchLog } from '../game/testMode/actions';
import { createReplayRecord } from '../game/persistence/replayRecord';
import { DEFAULT_PLAYER_PROFILE } from '../profile/playerProfile';
import { TestCaseResultsStorage } from '../game/testMode/resultsStorage';
import { loadTestScenarioState, runtimeInvariantChecks } from '../game/testMode/scenario';

describe('测试模式界面', () => {
  const menuProps = {
    hasSave: false,
    playerProfile: DEFAULT_PLAYER_PROFILE,
    onOpenPlayerSettings: () => undefined,
    onContinue: () => undefined,
    onLocalMode: () => undefined,
    onOnlineMode: () => undefined,
    onReplayStudy: () => undefined,
  };

  it('普通生产菜单不显示入口，启用后才显示测试模式', () => {
    expect(renderToStaticMarkup(<MainMenu {...menuProps} testModeEnabled={false} />)).not.toContain('测试模式');
    const enabled = renderToStaticMarkup(<MainMenu {...menuProps} testModeEnabled onTestMode={() => undefined} />);
    expect(enabled).toContain('测试模式');
    expect(enabled).toContain('开发者');
  });

  it('场景库显示统计、筛选、用例状态、最后测试时间和开始按钮', () => {
    const storage = new MemoryStorage();
    new TestCaseResultsStorage(storage).save('STAB-001-ANKAN', 1, 'passed', '2026-08-03T01:02:03.000Z');
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} testResultStorage={storage} />);
    expect(html).toContain('测试环境');
    expect(html).toContain('测试统计');
    expect(html).toContain('通过');
    expect(html).toContain('失败');
    expect(html).toContain('待测试');
    expect(html).toContain('阻塞');
    expect(html).toContain('按类型筛选');
    expect(html).toContain('按状态筛选');
    expect(html).toContain('按关键词筛选');
    expect(html).toContain('STAB-001-ANKAN');
    expect(html).toContain('STAB-001-MINKAN');
    expect(html).toContain('STAB-001-KAKAN');
    expect(html).toContain('STAB-001-FOUR-KANS');
    expect(html).toContain('RIICHI-DISCARD-MUST-TENPAI');
    expect(html).toContain('UI-RIICHI-DISCARD-WAIT-PREVIEW');
    expect(html).toContain('RULE-MINIMUM-HAN-2');
    expect(html).toContain('RULE-MINIMUM-HAN-3');
    expect(html).toContain('RULE-MINIMUM-HAN-4');
    expect(html).toContain('RULE-MINIMUM-HAN-5');
    expect(html).toContain('依次悬停或聚焦不同候选');
    expect(html).toContain('最后测试');
    expect(html).toContain('开始测试');
    expect(html).toContain('自动');
    expect(html).toContain('视觉');
    expect(html).toContain('混合');
  });

  it('二番缚场景在正式牌桌显示听牌与番数不足', () => {
    const scenario = getBuiltInTestScenario('RULE-MINIMUM-HAN-2')!;
    const html = renderToStaticMarkup(<TestModeScreen initialScenario={scenario} onExit={() => undefined} />);
    expect(html).toContain('听牌');
    expect(html).toContain('番数不足');
    expect(html).toContain('低于：断幺九（1番）');
    expect(html).toContain('等于：断幺九＋一杯口（2番）');
    expect(html).toContain('高于：门清混一色（3番）');
  });

  it('视觉和混合用例写明步骤、预期结果和人工检查项', () => {
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} />);
    expect(html).toContain('操作步骤');
    expect(html).toContain('预期结果');
    expect(html).toContain('人工检查项');
  });

  it('JSON导入默认折叠并提供制作说明、字段校验、格式化、复制和真实地和示例', () => {
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} />);
    const details = html.match(/<details class="test-mode-import"[^>]*>/)?.[0] ?? '';
    expect(details).not.toContain('open');
    expect(html).toContain('制作说明');
    expect(html).toContain('校验字段');
    expect(html).toContain('格式化');
    expect(html).toContain('复制 JSON');
    expect(html).toContain('地和（真实 TestScenarioV1）');
  });

  it('加载立直候选场景后显示正式立直操作框和多个弃牌候选', () => {
    const scenario = getBuiltInTestScenario('UI-RIICHI-DISCARD-WAIT-PREVIEW')!;
    const html = renderToStaticMarkup(<TestModeScreen initialScenario={scenario} onExit={() => undefined} />);
    expect(html).toContain('data-testid="game-screen"');
    expect((html.match(/aria-label="(?:双立直|立直)并打出/g) ?? []).length).toBeGreaterThan(1);
  });

  it('加载暗杠场景后使用真实Board，调试默认完全关闭且不遮挡鸣牌区', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const html = renderToStaticMarkup(<TestModeScreen initialScenario={scenario} onExit={() => undefined} />);
    expect(html).toContain('data-testid="game-screen"');
    expect(html).toContain('测试模式工具栏');
    expect(html).toContain('展开详细调试');
    expect(html).not.toContain('测试模式调试面板');
    expect(html).not.toContain('固定王牌槽位表');
    expect(html).not.toContain('原始状态');
    expect(html).toContain('执行下一AI动作');
    expect(html).toContain('完全控制');
    expect(html).not.toContain('结束测试');
    expect(html).toContain('暗杠');
  });

  it('完全控制开启后跟随正式状态的当前玩家，关闭时保留手动控制玩家', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const state = loadTestScenarioState(scenario);
    const nextState = { ...state, currentPlayer: 2 as const };
    expect(resolveTestModeControlPlayer(true, 0, nextState)).toBe(2);
    expect(resolveTestModeControlPlayer(false, 0, nextState)).toBe(0);
  });

  it('测试模式分析抽屉避开顶部工具栏，关闭按钮不会被覆盖', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    expect(css).toMatch(/\.test-mode-session \.analysis-drawer\s*\{[^}]*top:\s*var\(--test-mode-toolbar-height\)/s);
    expect(css).toMatch(/\.test-mode-session \.analysis-drawer\s*\{[^}]*height:\s*calc\(100% - var\(--test-mode-toolbar-height\)\)/s);
  });

  it('展开调试面板后按七个指定分组显示详细内容', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const gameState = loadTestScenarioState(scenario);
    const html = renderToStaticMarkup(<TestModeDebugPanel open scenario={scenario} gameState={gameState} matchLog={createTestModeMatchLog(scenario)} actionLog={[]} checks={runtimeInvariantChecks(scenario, gameState)} />);
    ['摘要', '不变量', '合法动作', '日志', '牌墙', '实例', '原始状态'].forEach((title) => expect(html).toContain(`<summary>${title}</summary>`));
    expect(html).toContain('固定王牌槽位表');
    expect(html).toContain('有效区域实例唯一性');
  });

  it('测试模式牌谱播放器显示转换入口，普通牌谱播放器保持原样', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const replay = createReplayRecord({ log: createTestModeMatchLog(scenario), source: 'test-mode' });
    const normal = renderToStaticMarkup(<ReplayScreen replay={replay} />);
    const enabled = renderToStaticMarkup(<ReplayScreen replay={replay} testModeEnabled onConvertToTestScenario={() => undefined} />);
    expect(normal).not.toContain('转为测试场景');
    expect(enabled).toContain('转为测试场景');
    expect(enabled).not.toContain('无法转换：');
  });

  it('旧牌谱缺少完整牌山时禁用转换并显示明确原因', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const replay = createReplayRecord({ log: createTestModeMatchLog(scenario), source: 'test-mode' });
    const oldReplay = JSON.parse(JSON.stringify(replay)) as typeof replay;
    delete oldReplay.log.rounds[0].liveWall;
    delete oldReplay.log.rounds[0].deadWall;
    delete oldReplay.log.rounds[0].wallOrder;
    const html = renderToStaticMarkup(<ReplayScreen replay={oldReplay} testModeEnabled onConvertToTestScenario={() => undefined} />);
    expect(html).toContain('转为测试场景');
    expect(html).toContain('disabled');
    expect(html).toContain('未记录完整活牌墙和14张王牌');
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}
