import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { XuezhanCenter } from './XuezhanHud';
import { GameTopBarView } from './game/GameTopBar';
import { TableCenterView } from './game/TableCenter';
import { applyXz } from '../game/xuezhan/engine';
import { loadXzScenario, xzCases } from '../game/xuezhan/scenarios';
const load = (id: string) => loadXzScenario(xzCases().find(c => c.id === id)!.scenario);
describe('shared XZ presentation', () => {
  it('shows authoritative exchange progress without riichi counters', () => {
    let s = load('XZ-PRESET-2');
    const tiles = s.players[0].hand.filter(t => t.id < 9).slice(0, 3).map(t => t.instanceId);
    s = applyXz(s, 0, { type: 'exchange', tiles });
    const html = renderToStaticMarkup(<XuezhanCenter state={s} />);
    expect(html).toContain('换3张 1/4');
    expect(html).toContain('待定缺');
    expect(html).toContain('血战到底');
    expect(html).not.toContain('本场');
    expect(html.match(/data-center-player=/g)).toHaveLength(4);
  });
  it('preserves the shared first-win rank for simultaneous winners', () => {
    let s = load('XZ-TRIPLE');
    for (const seat of [1, 2, 3] as const) s = applyXz(s, seat, { type: 'win' });
    const html = renderToStaticMarkup(<XuezhanCenter state={s} />);
    expect(html.match(/第1胡/g)).toHaveLength(3);
    expect(html).not.toContain('第2胡');
    expect(html).toContain('本局结束');
    expect(html).toContain('余55 · 活跃1');
    expect(html).toContain('<strong>97</strong>');
    expect(html.match(/<strong>101<\/strong>/g)).toHaveLength(3);
  });
  it('preserves the formal riichi toolbar and center defaults', () => {
    const noop = () => {};
    const bar = renderToStaticMarkup(<GameTopBarView currentName="测试玩家" currentWind="east" phaseLabel="打牌" analysisOpen={false} onOpenRulesGuide={noop} onOpenAudioSettings={noop} onToggleAnalysis={noop} onReturnMenu={noop} />);
    for (const label of ['规则说明', '牌局分析', '返回菜单', '音乐设置', '东家']) expect(bar).toContain(label);
    const center = renderToStaticMarkup(<TableCenterView scores={[]} roundLabel="东1局" honba={2} remainingLabel="剩余30张" />);
    expect(center).toContain('2本场'); expect(center).toContain('剩余30张');
  });
});
