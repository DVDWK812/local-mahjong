import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { sampleReplayRecord } from '../game/persistence/saveTestUtils';
import { buildReplayState } from '../game/replay/roundReplay';
import { replayRoundNavigationState } from './ReplayBottomBar';
import { ReplayScreen, selectReplayRound } from './ReplayScreen';
import { ReplayWallDrawer } from './ReplayWallDrawer';

describe('Replay fullscreen layout', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('回放根节点占满视口且中央区域不会引起整页滚动', () => {
    const screenRule = css.match(/\.replay-screen\s*\{([^}]*)\}/s)?.[1] ?? '';
    const viewportRule = css.match(/\.app-resolution-viewport\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(screenRule).toContain('display: flex');
    expect(screenRule).toContain('flex-direction: column');
    expect(screenRule).toContain('width: 100%');
    expect(screenRule).toContain('height: 100%');
    expect(screenRule).toContain('overflow: hidden');
    expect(viewportRule).toContain('width: 100%');
    expect(viewportRule).toContain('height: 100dvh');
    expect(css).toMatch(/\.replay-table-viewport\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
  });

  it('顶栏、中央牌桌和底栏取代详情卡片与常驻局列表', () => {
    const html = renderToStaticMarkup(<ReplayScreen replay={sampleReplayRecord()} />);
    expect(html).toContain('class="replay-top-bar"');
    expect(html).toContain('class="replay-table-viewport"');
    expect(html).toContain('class="replay-bottom-bar"');
    expect(html).toContain('返回牌谱列表');
    expect(html).toContain('当前步骤：0 /');
    expect(html).toContain('aria-label="选择局数"');
    expect(html).toContain('aria-label="步骤进度"');
    expect(html).not.toContain('replay-card__metadata');
    expect(html).not.toContain('replay-round-list');
    expect(html).not.toContain('replay-open-badge');
  });

  it('牌山抽屉提供打开和关闭状态并复用现有牌山内容', () => {
    const replay = sampleReplayRecord();
    const state = buildReplayState(replay.log.rounds[0], 0);
    const closed = renderToStaticMarkup(<ReplayWallDrawer open={false} replayState={state} allOpen={false} cameraPlayerId={0} onClose={() => undefined} />);
    const open = renderToStaticMarkup(<ReplayWallDrawer open replayState={state} allOpen cameraPlayerId={0} onClose={() => undefined} />);
    expect(closed).toContain('aria-hidden="true"');
    expect(closed).not.toContain('replay-wall-drawer is-open');
    expect(open).toContain('replay-wall-drawer is-open');
    expect(open).toContain('关闭');
    expect(open).toContain('replay-wall--missing');
  });

  it('窄屏切换为视角下拉并让底栏分行且不横向溢出', () => {
    expect(css).toContain('.replay-view-switch__select');
    expect(css).toMatch(/@media \(max-width: 1180px\)[\s\S]*?\.replay-view-switch__buttons\s*\{[^}]*display:\s*none;/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.replay-bottom-bar\s*\{[^}]*grid-template-columns:\s*1fr;/);
    expect(css).toMatch(/\.replay-screen\s*\{[^}]*overflow:\s*hidden;/s);
  });

  it('未完成末局的前后局按钮只依赖局索引且切换会回到开始步骤', () => {
    expect(replayRoundNavigationState(1, 2)).toEqual({ canGoPrevious: true, canGoNext: false });
    expect(replayRoundNavigationState(0, 2)).toEqual({ canGoPrevious: false, canGoNext: true });
    expect(selectReplayRound(0, 2)).toEqual({ playing: false, roundIndex: 0, stepIndex: 0 });
  });

  it('局数选择框加宽且局切换按钮并入播放控制顺序', () => {
    const selectRule = css.match(/\.replay-round-selector\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(selectRule).toContain('width: 264px');
    const html = renderToStaticMarkup(<ReplayScreen replay={sampleReplayRecord()} />);
    expect(html.indexOf('上一局')).toBeLessThan(html.indexOf('上一步'));
    expect(html.indexOf('下一局')).toBeGreaterThan(html.indexOf('下一步'));
  });

  it('闭合局数按键只显示局名和本场，展开选项保留详细摘要', () => {
    const html = renderToStaticMarkup(<ReplayScreen replay={sampleReplayRecord()} />);
    expect(html).toMatch(/replay-round-selector__current" aria-hidden="true">东1局 · 0本场<\/span>/);
    expect(html).toMatch(/<option[^>]*>东1局 · 0本场 · [^<]+<\/option>/);
    expect(selectReplayRound(1, 2)).toEqual({ playing: false, roundIndex: 1, stepIndex: 0 });
  });

  it('普通牌山固定七列、最多七行并在内部纵向滚动', () => {
    const liveWallRule = css.match(/\.replay-wall__tiles--live-wall\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(liveWallRule).toContain('grid-template-columns: repeat(7, minmax(0, 1fr))');
    expect(liveWallRule).toContain('max-height: calc(var(--replay-wall-row-height) * 7 + 18px)');
    expect(liveWallRule).toContain('overflow-y: auto');
    expect(liveWallRule).toContain('overflow-x: hidden');
    expect(css).toMatch(/\.replay-wall__tiles--dead-wall\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(7,/s);
    expect(css).not.toContain('.replay-wall__tiles--dead-wall > :nth-child(5)');
    expect(css).toMatch(/\.replay-wall-tile--drawn :is\(\.tile\)\s*\{[^}]*opacity:[^}]*filter:/s);
  });
});
