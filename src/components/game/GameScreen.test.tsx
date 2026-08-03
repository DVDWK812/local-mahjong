import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { getDrawActionState } from '../../game/interaction';
import { createTile } from '../../game/tileUtils';
import type { GameState, TileId } from '../../game/types';
import { GameScreen } from './GameScreen';

function noop() {
  return undefined;
}

function riichiPreviewState(): GameState {
  const base = createInitialGameState();
  const ids: TileId[] = [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31];
  const hand = ids.map((id, index) => createTile(id, index));
  return {
    ...base,
    phase: 'discard',
    currentPlayer: 0,
    players: base.players.map((player) => player.id === 0 ? {
      ...player,
      hand,
      drawnTile: hand[hand.length - 1],
      calls: [],
      riichi: false,
      riichiState: null,
    } : player),
  };
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

  it('听牌框使用独立右下固定层，不随鸣牌栏出现而移动', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toContain('.game-tenpai-layer');
    expect(css).toMatch(/\.game-tenpai-layer\s*\{[^}]*position:\s*absolute;/s);
    expect(css).toMatch(/\.game-tenpai-layer\s*\{[^}]*right:/s);
    expect(css).toMatch(/\.game-tenpai-layer\s*\{[^}]*bottom:/s);
    expect(css).not.toContain('game-prompt-layer--with-tenpai');
  });

  it('使用立直候选预览 ID 调用正式听牌展示并在清除后隐藏', () => {
    const state = riichiPreviewState();
    const candidate = getDrawActionState(state, 0).riichiDiscardCandidates[0];
    expect(candidate).toBeDefined();
    const props = {
      gameState: state,
      analysisOpen: false,
      canDiscard: false,
      onToggleAnalysis: noop,
      onCloseAnalysis: noop,
      onReturnMenu: noop,
      onDiscard: noop,
      onReset: noop,
    };
    const preview = renderToStaticMarkup(<GameScreen {...props} tenpaiPreviewDiscardInstanceId={candidate.instanceId} />);
    const cleared = renderToStaticMarkup(<GameScreen {...props} tenpaiPreviewDiscardInstanceId={null} />);
    expect(preview).toContain('听牌与剩余量');
    expect(preview).toContain('打出');
    expect(cleared).not.toContain('听牌与剩余量');
  });
});
