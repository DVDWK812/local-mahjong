import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { createInitialMatchLog } from '../game/replay/eventRecorder';
import { getRulePreset } from '../game/match/matchRules';
import { sampleSavedMatch } from '../game/persistence/saveTestUtils';
import { BackButton } from './BackButton';
import { ExitGameDialog } from './ExitGameDialog';
import { GameTypeMenu } from './GameTypeMenu';
import { LocalModeMenu } from './LocalModeMenu';
import { MainMenu } from './MainMenu';
import { MatchSettings } from './MatchSettings';
import { ReplayLibrary } from './ReplayLibrary';
import { RiichiModeMenu } from './RiichiModeMenu';

describe('菜单和页面导航', () => {
  it('应用启动显示主菜单且不显示牌桌', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('主菜单');
    expect(html).toContain('本地模式');
    expect(html).toContain('联机模式');
    expect(html).toContain('牌谱研习');
    expect(html).not.toContain('river-board');
  });

  it('主菜单存在存档时显示继续对局', () => {
    const html = renderToStaticMarkup(<MainMenu hasSave notice={null} onContinue={() => undefined} onLocalMode={() => undefined} onOnlineMode={() => undefined} onReplayStudy={() => undefined} />);
    expect(html).toContain('继续对局');
  });

  it('主菜单显示联机模式敬请期待', () => {
    const html = renderToStaticMarkup(<MainMenu hasSave={false} notice="联机模式敬请期待。" onContinue={() => undefined} onLocalMode={() => undefined} onOnlineMode={() => undefined} onReplayStudy={() => undefined} />);
    expect(html).toContain('联机模式');
    expect(html).toContain('敬请期待');
  });

  it('本地模式显示玩法选择和未开发提示入口', () => {
    const html = renderToStaticMarkup(<LocalModeMenu notice="剧情模式敬请期待。" onBack={() => undefined} onRiichi={() => undefined} onComingSoon={() => undefined} />);
    expect(html).toContain('选择玩法');
    expect(html).toContain('剧情模式');
    expect(html).toContain('立直麻将');
    expect(html).toContain('血战到底');
    expect(html).toContain('敬请期待');
  });

  it('立直麻将进入人数选择，三人间不能开始比赛', () => {
    const html = renderToStaticMarkup(<RiichiModeMenu notice="三人间敬请期待。" onBack={() => undefined} onFourPlayer={() => undefined} onThreePlayer={() => undefined} />);
    expect(html).toContain('选择人数');
    expect(html).toContain('四人间');
    expect(html).toContain('三人间');
    expect(html).toContain('敬请期待');
    expect(html).not.toContain('开始游戏');
  });

  it('四人间比赛长度显示四人东和四人南', () => {
    const html = renderToStaticMarkup(<GameTypeMenu onBack={() => undefined} onEast={() => undefined} onSouth={() => undefined} />);
    expect(html).toContain('四人东');
    expect(html).toContain('四人南');
  });

  it('规则设置页面可以显示开始游戏按钮并保留临时配置', () => {
    const config = { ...getRulePreset('east-round'), match: { ...getRulePreset('east-round').match, startingPoints: 26000 } };
    const html = renderToStaticMarkup(
      <main>
        <p>本地模式 ＞ 立直麻将 ＞ 四人间 ＞ 四人东</p>
        <MatchSettings config={config} presetId="custom" onPresetChange={() => undefined} onConfigChange={() => undefined} />
        <button type="button">开始游戏</button>
      </main>,
    );
    expect(html).toContain('本地模式 ＞ 立直麻将 ＞ 四人间 ＞ 四人东');
    expect(html).toContain('value="26000"');
    expect(html).toContain('开始游戏');
  });

  it('每一级返回按钮文本一致', () => {
    expect(renderToStaticMarkup(<BackButton onClick={() => undefined} />)).toContain('返回');
  });

  it('游戏中点击返回显示二次确认文案', () => {
    const html = renderToStaticMarkup(<ExitGameDialog matchEnded={false} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(html).toContain('退出当前对局？');
    expect(html).toContain('继续游戏');
    expect(html).toContain('确认退出');
  });

  it('已结束比赛返回菜单无需未完成对局提示', () => {
    const html = renderToStaticMarkup(<ExitGameDialog matchEnded onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(html).toContain('当前比赛已经结束');
    expect(html).not.toContain('继续游戏');
  });

  it('退出确认按钮可以触发保存回调一次', () => {
    const onConfirm = vi.fn();
    renderToStaticMarkup(<ExitGameDialog matchEnded={false} onCancel={() => undefined} onConfirm={onConfirm} />);
    onConfirm();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('取消退出保持继续游戏入口', () => {
    const html = renderToStaticMarkup(<ExitGameDialog matchEnded={false} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(html).toContain('继续游戏');
  });

  it('牌谱研习能够进入现有牌谱入口', () => {
    const log = createInitialMatchLog({ initialDealer: 0, initialScores: [25000, 25000, 25000, 25000], ruleConfig: getRulePreset('east-round') });
    const html = renderToStaticMarkup(<ReplayLibrary replays={[{ matchId: log.matchId, createdAt: log.createdAt, playerNames: log.playerNames }]} onOpen={() => undefined} onDelete={() => undefined} />);
    expect(html).toContain('牌谱列表');
    expect(html).toContain('回放');
  });

  it('同一时间只渲染一个主菜单页面', () => {
    const html = renderToStaticMarkup(<MainMenu hasSave={false} onContinue={() => undefined} onLocalMode={() => undefined} onOnlineMode={() => undefined} onReplayStudy={() => undefined} />);
    expect((html.match(/menu-page/g) ?? []).length).toBe(1);
    expect(html).not.toContain('选择玩法');
  });

  it('保存样例可作为继续对局入口数据', () => {
    expect(sampleSavedMatch().matchState.phase).toBe('round-active');
  });
});
