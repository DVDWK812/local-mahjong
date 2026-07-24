import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { createMatch } from '../../game/match/matchEngine';
import { GameScreen } from './GameScreen';
import { MahjongTable } from './MahjongTable';

describe('Table layout regression', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('中央区使用更小方形尺寸且文本不换行', () => {
    expect(css).toContain('--center-size: clamp(120px, 11vw, 180px)');
    expect(css).toContain('width: var(--center-size)');
    expect(css).toContain('height: var(--center-size)');
    expect(css).toContain('.center-round strong');
    expect(css).toContain('white-space: nowrap');
  });

  it('四家PlayerZone处于独立九宫格区域', () => {
    expect(css).toContain('"west center east"');
    expect(css).toContain('.player-zone--north { grid-area: north; }');
    expect(css).toContain('.player-zone--west { grid-area: west; }');
    expect(css).toContain('.player-zone--east { grid-area: east; }');
    expect(css).toContain('.player-zone--south { grid-area: south; }');
  });

  it('四家牌河固定在中央周围并使用6.5乘4占位尺寸', () => {
    expect(css).toContain('--river-board-width');
    expect(css).toContain('--river-board-height');
    expect(css).toContain('grid-template-columns: repeat(13, var(--river-half-width))');
    expect(css).toContain('grid-auto-rows: var(--river-tile-height)');
    expect(css).toContain('height: var(--river-board-height)');
  });

  it('左右家手牌与中央牌河使用独立容器和明确间距', () => {
    expect(css).toContain('"hand info"');
    expect(css).toContain('table-center-cluster');
    expect(css).toContain('west-river west-stick center east-stick east-river');
    expect(css).toContain('column-gap: 14px');
    expect(css).toContain('.side-player-hand-wrapper');
  });

  it('小视口下页面仍保持单屏无纵向溢出', () => {
    expect(css).toContain('height: 100dvh');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('@media (max-width: 900px)');
  });

  it('DOM中玩家ID、手牌和中央牌河不是同一个容器，且中央区不显示玩家姓名', () => {
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
