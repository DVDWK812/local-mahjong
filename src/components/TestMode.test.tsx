import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MainMenu } from './MainMenu';
import { TestModeScreen } from './TestModeScreen';
import { ReplayScreen } from './ReplayScreen';
import { getBuiltInTestScenario } from '../game/testMode/builtInScenarios';
import { createTestModeMatchLog } from '../game/testMode/actions';
import { createReplayRecord } from '../game/persistence/replayRecord';

describe('测试模式界面', () => {
  const menuProps = {
    hasSave: false,
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

  it('场景库显示四个内置场景和明显测试环境标识', () => {
    const html = renderToStaticMarkup(<TestModeScreen onExit={() => undefined} />);
    expect(html).toContain('测试环境');
    expect(html).toContain('STAB-001-ANKAN');
    expect(html).toContain('STAB-001-MINKAN');
    expect(html).toContain('STAB-001-KAKAN');
    expect(html).toContain('STAB-001-FOUR-KANS');
    expect(html).toContain('导入 TestScenario JSON');
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
});
