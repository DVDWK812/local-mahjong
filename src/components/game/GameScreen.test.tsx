import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { GameScreen } from './GameScreen';

function noop() {
  return undefined;
}

describe('GameScreen', () => {
  it('渲染顶部状态栏、中央牌桌和底部本家手牌三区', () => {
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={createInitialGameState()}
        analysisOpen={false}
        canDiscard={false}
        onToggleAnalysis={noop}
        onCloseAnalysis={noop}
        onReturnMenu={noop}
        onDiscard={noop}
        onReset={noop}
      />,
    );
    expect(html).toContain('data-testid="game-screen"');
    expect(html).toContain('对局状态栏');
    expect(html).toContain('麻将牌桌');
    expect(html).toContain('本家手牌');
  });

  it('不再渲染旧左侧信息栏和右侧常驻分析栏', () => {
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={createInitialGameState()}
        analysisOpen={false}
        canDiscard={false}
        onToggleAnalysis={noop}
        onCloseAnalysis={noop}
        onReturnMenu={noop}
        onDiscard={noop}
        onReset={noop}
      />,
    );
    expect(html).not.toContain('score-panel');
    expect(html).not.toContain('right-rail');
    expect(html).toContain('analysis-drawer');
    expect(html).toContain('aria-hidden="true"');
  });

  it('动作提示放入固定提示层而不进入普通牌桌流', () => {
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={createInitialGameState()}
        analysisOpen={false}
        actionPrompt={<section className="action-prompt">可执行操作</section>}
        canDiscard={false}
        onToggleAnalysis={noop}
        onCloseAnalysis={noop}
        onReturnMenu={noop}
        onDiscard={noop}
        onReset={noop}
      />,
    );
    expect(html).toContain('game-prompt-layer');
    expect(html).toContain('可执行操作');
  });
});
