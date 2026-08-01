import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createMatch } from '../../game/match/matchEngine';
import { GameScreen } from './GameScreen';
import { MahjongTable } from './MahjongTable';

describe('牌桌布局回归', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('中央区使用较小方形尺寸且文本不换行', () => {
    expect(css).toContain('--center-size: 164px');
    expect(css).toContain('width: var(--center-size)');
    expect(css).toContain('height: var(--center-size)');
    expect(css).toContain('.center-round strong');
    expect(css).toContain('white-space: nowrap');
  });

  it('四家 PlayerZone 处于独立九宫格区域', () => {
    expect(css).toContain('"west center east"');
    expect(css).toContain('.player-slot--top { grid-area: north; }');
    expect(css).toContain('.player-slot--left { grid-area: west; }');
    expect(css).toContain('.player-slot--right { grid-area: east; }');
    expect(css).toContain('.player-slot--bottom { grid-area: south; }');
  });

  it('牌谱回放按固定视觉槽位复用正常四人局几何且不再使用越界位移', () => {
    expect(css).toContain('.player-slot--top { grid-area: north; }');
    expect(css).not.toMatch(/\.replay-screen \.player-slot--(?:top|left|right) [^{]*\{[^}]*translateX/s);
    expect(css).not.toMatch(/\.replay-screen [^{]*\[data-player-index=/);
  });

  it('四家牌河放大后仍固定在中央周围并使用 6.5 张占位尺寸', () => {
    expect(css).toContain('--river-tile-width: 27px');
    expect(css).toContain('--river-area-width');
    expect(css).toContain('--river-area-height');
    expect(css).toContain('grid-template-columns: repeat(13, var(--river-half-width))');
    expect(css).toContain('grid-auto-rows: var(--river-tile-height)');
    expect(css).toContain('height: var(--river-area-height)');
  });

  it('左右家手牌、副露与中央牌河使用独立容器和明确间距', () => {
    expect(css).toContain('"hand info"');
    expect(css).toContain('table-center-cluster');
    expect(css).toContain('west-river west-stick center east-stick east-river');
    expect(css).toContain('column-gap: 10px');
    expect(css).toContain('.side-player-hand-wrapper');
  });

  it('对手手牌和宝牌指示牌尺寸放大，且三名 AI 均有独立副露区', () => {
    const html = renderToStaticMarkup(<MahjongTable gameState={createInitialGameState()} matchState={createMatch()} />);
    expect(css).toContain('--opponent-tile-width: 23px');
    expect(css).toContain('width: 32px');
    expect((html.match(/data-table-meld-zone=/g) ?? [])).toHaveLength(3);
    expect(css).toContain('--side-player-outset: 18px');
    expect(css).toContain('--opponent-edge-gap: 8px');
    expect(css).toContain('--side-player-edge-shift: calc(var(--side-player-outset) + var(--opponent-edge-gap))');
    expect(css).toContain('translate: none');
    expect(css).toContain('.table-meld-anchor--north');
    expect(css).toContain('.table-meld-anchor--east');
    expect(css).toContain('.table-meld-anchor--west');
    expect(css).toContain('flex-direction: column');
  });

  it('桌面视口保持单屏无溢出且小于最低尺寸由外壳拒绝', () => {
    expect(css).toContain('height: 100dvh');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('.desktop-table-viewport--unsupported');
    expect(css).toContain('.desktop-table-too-small');
  });

  it('DOM 中玩家 ID、手牌和中央牌河不是同一容器，且中央区不显示玩家姓名', () => {
    const html = renderToStaticMarkup(<MahjongTable gameState={createInitialGameState()} matchState={createMatch()} />);
    expect(html).toContain('player-identity');
    expect(html).toContain('player-zone-hand-wrap');
    expect(html).toContain('table-river-anchor');
    expect(html).toContain('center-score-grid');
    expect(html.indexOf('player-zone-hand-wrap')).not.toBe(html.indexOf('table-river-anchor'));
  });

  it('牌桌左上角渲染宝牌指示牌槽和局数信息', () => {
    const html = renderToStaticMarkup(<MahjongTable gameState={createInitialGameState()} matchState={createMatch()} />);
    expect(html).toContain('dora-indicator-stack');
    expect(html).toContain('宝牌指示牌');
    expect(html).toContain('东1局　0本场');
    expect((html.match(/class="dora-indicator-slot"/g) ?? [])).toHaveLength(5);
  });

  it('完整对局页包含牌桌、底部本家手牌和分析抽屉但只渲染一个主页面', () => {
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={createInitialGameState()}
        matchState={createMatch()}
        analysisOpen={false}
        canDiscard={false}
        onToggleAnalysis={() => undefined}
        onCloseAnalysis={() => undefined}
        onReturnMenu={() => undefined}
        onDiscard={() => undefined}
        onReset={() => undefined}
      />,
    );
    expect((html.match(/class="game-screen"/g) ?? [])).toHaveLength(1);
    expect(html).toContain('mahjong-table');
    expect(html).toContain('local-hand-area');
    expect(html).toContain('analysis-drawer');
  });
});
