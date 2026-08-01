import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MainMenu } from './MainMenu';
import { TestModeScreen } from './TestModeScreen';
import { ReplayScreen } from './ReplayScreen';
import { getBuiltInTestScenario } from '../game/testMode/builtInScenarios';
import { createTestModeMatchLog } from '../game/testMode/actions';
import { createReplayRecord } from '../game/persistence/replayRecord';
import { createMemoryTestStorage, executeTestCase, getBuiltInTestCases } from '../game/testMode/testCases';
import { p0ReplayRunners } from './TestModeP0ReplayRunner';

describe('测试模式界面', () => {
  const menuProps = {
    hasSave: false,
    onContinue: () => undefined,
    onLocalMode: () => undefined,
    onOnlineMode: () => undefined,
    onReplayStudy: () => undefined,
    onSettings: () => undefined,
  };

  it('普通生产菜单不显示入口，启用后才显示测试模式', () => {
    expect(renderToStaticMarkup(<MainMenu {...menuProps} testModeEnabled={false} />)).not.toContain('测试模式');
    const enabled = renderToStaticMarkup(<MainMenu {...menuProps} testModeEnabled onTestMode={() => undefined} />);
    expect(enabled).toContain('测试模式');
    expect(enabled).toContain('开发者');
  });

  it('用例中心显示六种用例、八个分类、四个旧场景和明显测试环境标识', () => {
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} />);
    expect(html).toContain('测试环境');
    expect(html).toContain('开发者测试用例中心');
    expect(html).toContain('STAB-001-ANKAN');
    expect(html).toContain('STAB-001-MINKAN');
    expect(html).toContain('STAB-001-KAKAN');
    expect(html).toContain('STAB-001-FOUR-KANS');
    expect(html).toContain('导入 TestScenario 或 TestCase JSON');
    ['playable', 'replay', 'persistence', 'import-validation', 'seeded-run', 'ui-interaction'].forEach((kind) => {
      expect(html).toContain(`data-case-kind="${kind}"`);
    });
    ['对局规则', '计分与结算', '牌谱与隐藏信息', '存档与迁移', '导入与版本', '随机与压力', '界面与键盘', 'STAB-001旧场景'].forEach((category) => {
      expect(html).toContain(category);
    });
    expect(html).toContain('未运行');
    ['随机与压力', 'Seed', '运行1局', '运行10局', '运行100局', '运行500局', '暂停', '导出失败种子', '将失败状态转为TestScenarioV1', '比较两次同seed运行', '每动作不变量'].forEach((label) => {
      expect(html).toContain(label);
    });
    ['界面与键盘实验室', 'ResultDialog', 'ContinueMatchDialog', 'ExitGameDialog', 'MatchResultDialog', '当前焦点元素', '是否在焦点圈内', 'Escape预期', '背景点击预期', '关闭后返回元素'].forEach((label) => {
      expect(html).toContain(label);
    });
  });

  it('加载暗杠场景后使用真实Board并显示工具栏、调试槽位和合法暗杠', () => {
    const scenario = getBuiltInTestScenario('STAB-001-ANKAN')!;
    const html = renderToStaticMarkup(<TestModeScreen initialScenario={scenario} onExit={() => undefined} />);
    expect(html).toContain('data-testid="game-screen"');
    expect(html).toContain('测试模式工具栏');
    expect(html).toContain('固定14张王牌槽位');
    expect(html).toContain('执行下一AI动作');
    expect(html).toContain('暗杠');
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

  it('用例中心展示STAB-002/003回归并为附带牌谱提供人工查看入口', () => {
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} onOpenReplay={() => undefined} />);
    [
      'STAB-002-CHI-SAVE', 'STAB-002-PON-SAVE', 'STAB-002-MINKAN-SAVE', 'STAB-002-INVALID-ALIASES',
      'STAB-003-HIDDEN-DRAW', 'STAB-003-PUBLIC-AFTER-DISCARD', 'STAB-003-CALL-PUBLIC', 'STAB-003-CAMERA-SWITCH', 'STAB-003-FULL-OPEN',
    ].forEach((id) => expect(html).toContain(id));
    expect(html.match(/人工查看附带牌谱/g)).toHaveLength(5);
  });

  it('五个STAB-003用例自动检查隐藏、公开、鸣牌、视角和全牌开关', async () => {
    const cases = getBuiltInTestCases().filter((testCase) => testCase.relatedAuditId === 'STAB-003' && testCase.id.startsWith('STAB-003-'));
    expect(cases).toHaveLength(5);
    for (const testCase of cases) {
      const result = await executeTestCase(testCase, { storage: createMemoryTestStorage(), replayRunners: p0ReplayRunners });
      expect(result.status, `${testCase.id}: ${result.actual.join('; ')}`).toBe('passed');
      expect(result.actual.length, testCase.id).toBeGreaterThan(0);
    }
  });

  it('STAB-005结算场景显示快照、当前供托和动态守恒调试数据', () => {
    const testCase = getBuiltInTestCases().find((entry) => entry.id === 'STAB-005-CUSTOM-STARTING-POINTS');
    if (!testCase || testCase.kind !== 'playable') throw new Error('Missing STAB-005 custom-points case');
    const html = renderToStaticMarkup(<TestModeScreen initialScenario={testCase.scenario} onExit={() => undefined} />);
    expect(html).toContain('结算前供托');
    expect(html).toContain('当前桌面供托');
    expect(html).toContain('玩家点数合计');
    expect(html).toContain('动态初始总点数');
    expect(html).toContain('108000');
    expect(html).toContain('<dt>点数守恒</dt><dd>通过</dd>');
    expect(html).toContain('供托奖励：2根 × 1000点');
  });

  it('STAB-004场景在调试面板显示按实例去重的可见牌统计与来源区域', () => {
    const testCase = getBuiltInTestCases().find((entry) => entry.id === 'STAB-004-PON-VISIBLE-COUNT');
    if (!testCase || testCase.kind !== 'playable') throw new Error('Missing STAB-004 pon case');
    const html = renderToStaticMarkup(<TestModeScreen initialScenario={testCase.scenario} onExit={() => undefined} />);
    expect(html).toContain('按实例去重的公开牌统计');
    expect(html).toContain('tile.id');
    expect(html).toContain('唯一公开 instanceId');
    expect(html).toContain('visibleCount');
    expect(html).toContain('remainingCount');
    expect(html).toContain('来源区域');
    expect(html).toContain('player-1-river');
    expect(html).toContain('player-0-call-0');
  });

  it('STAB-006场景由真实Board显示共享暗杠候选并展示等待差分诊断', () => {
    const cases = getBuiltInTestCases();
    const legal = cases.find((entry) => entry.id === 'STAB-006-ANKAN-WAIT-UNCHANGED');
    const changed = cases.find((entry) => entry.id === 'STAB-006-ANKAN-WAIT-CHANGED');
    if (!legal || legal.kind !== 'playable' || !changed || changed.kind !== 'playable') throw new Error('Missing STAB-006 cases');
    const legalHtml = renderToStaticMarkup(<TestModeScreen initialScenario={legal.scenario} onExit={() => undefined} />);
    const changedHtml = renderToStaticMarkup(<TestModeScreen initialScenario={changed.scenario} onExit={() => undefined} />);
    expect(legalHtml).toContain('暗杠');
    expect(changedHtml).not.toContain('class="call-option-label">暗杠');
    ['杠前等待', '移除四张后的等待', '共享判定结果', 'UI候选', '底层canAnkan结果'].forEach((label) => expect(legalHtml).toContain(label));
    expect(changedHtml).toContain('<dt>共享判定结果</dt><dd>禁止</dd>');
  });

  it('用例中心显示四个STAB-007存档兼容用例及迁移差异说明', () => {
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} />);
    [
      'STAB-007-MISSING-APPLIED-ROUND-IDS',
      'STAB-007-MISSING-SCORE-HISTORY',
      'STAB-007-MISSING-RULE-CONFIG',
      'STAB-007-MINIMAL-V1-SAVE',
    ].forEach((id) => expect(html).toContain(id));
    expect(html).toContain('显示迁移前后字段差异');
    expect(html).toContain('存档兼容');
  });

  it('用例中心显示STAB-008用例和仅作用于测试适配器的存储失败面板', () => {
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} />);
    [
      'STAB-008-GET-FAILURE',
      'STAB-008-SET-SECURITY-ERROR',
      'STAB-008-SET-QUOTA-ERROR',
      'STAB-008-REMOVE-FAILURE',
    ].forEach((id) => expect(html).toContain(id));
    expect(html).toContain('模拟存储失败');
    expect(html).toContain('写入 QuotaExceededError');
    expect(html).toContain('仅注入测试中心内存适配器');
    expect(html).toContain('不读取或修改 window.localStorage');
  });

  it('用例中心显示ReplayRecord和裸MatchLog的六个STAB-009版本用例', () => {
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} />);
    [
      'STAB-009-REPLAY-V0', 'STAB-009-REPLAY-V1', 'STAB-009-REPLAY-V2',
      'STAB-009-RAW-LOG-V0', 'STAB-009-RAW-LOG-V1', 'STAB-009-RAW-LOG-V2',
    ].forEach((id) => expect(html).toContain(id));
    expect(html).toContain('拒绝：不支持的未来版本');
    expect(html).toContain('接受：当前版本');
    expect(html).toContain('错误包含格式MatchLog、实际版本和支持版本');
  });
});
