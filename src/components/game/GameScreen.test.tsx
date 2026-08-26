import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { getDrawActionState } from '../../game/interaction';
import { createTile } from '../../game/tileUtils';
import type { GameState, TileId } from '../../game/types';
import {
  GameScreen,
  buildRoundEndPresentationKey,
  shouldBlockRoundEndResultPresentation,
  shouldBlockWinResultPresentation,
} from './GameScreen';

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

function minimumHanRiichiPreviewState(): { state: GameState; discardInstanceId: string } {
  const base = createInitialGameState();
  const hand = [1, 1, 1, 3, 4, 5, 11, 12, 13, 14, 14, 20, 20, 8].map((id, index) => createTile(id as TileId, index));
  return {
    state: {
      ...base,
      phase: 'discard',
      currentPlayer: 0,
      firstTurnInterrupted: true,
      matchRuleConfig: { minimumHan: 2 },
      players: base.players.map((player) => player.id === 0 ? {
        ...player,
        hand,
        drawnTile: hand[hand.length - 1],
        calls: [],
        riichi: false,
        riichiState: null,
      } : player),
    },
    discardInstanceId: hand[hand.length - 1].instanceId,
  };
}

describe('GameScreen', () => {
  it('Win presentation pending 时阻止 Result，完成或禁用后放行', () => {
    expect(shouldBlockWinResultPresentation('round:ron:1', true, null)).toBe(true);
    expect(shouldBlockWinResultPresentation('round:ron:1', true, 'round:ron:1')).toBe(false);
    expect(shouldBlockWinResultPresentation('round:ron:1', false, null)).toBe(false);
  });

  it('流局和途中流局也使用同一个 Result presentation gate', () => {
    const base = createInitialGameState();
    const exhaustive: GameState = {
      ...base,
      phase: 'exhaustive-draw',
      result: {
        type: 'exhaustive-draw',
        tenpaiPlayers: [0, 2],
        notenPlayers: [1, 3],
        scoreDeltas: [1500, -1500, 1500, -1500],
        pointDeltas: [1500, -1500, 1500, -1500],
        dealerContinues: true,
        honbaIncrement: 1,
        riichiSticksCarryOver: true,
      },
    };
    const abortive: GameState = {
      ...base,
      phase: 'round-ended',
      result: {
        type: 'abortive-draw',
        reason: 'kyuushu-kyuuhai',
        declaredBy: 0,
        dealerContinues: true,
        honbaIncrement: 1,
        riichiSticksCarryOver: true,
        scoreDeltas: [0, 0, 0, 0],
        pointDeltas: [0, 0, 0, 0],
      },
    };
    const exhaustiveKey = buildRoundEndPresentationKey(exhaustive, 'east-1');
    const abortiveKey = buildRoundEndPresentationKey(abortive, 'east-1');
    expect(exhaustiveKey).toContain('exhaustive-draw');
    expect(abortiveKey).toContain('abortive-draw:kyuushu-kyuuhai:0');
    expect(shouldBlockRoundEndResultPresentation(exhaustiveKey, true, null)).toBe(true);
    expect(shouldBlockRoundEndResultPresentation(abortiveKey, false, null)).toBe(false);
  });

  it('直接挂载已结束状态不会回放历史表现，ResultDialog 立即可见', () => {
    const base = createInitialGameState();
    const state: GameState = {
      ...base,
      phase: 'exhaustive-draw',
      result: {
        type: 'exhaustive-draw',
        tenpaiPlayers: [],
        notenPlayers: [0, 1, 2, 3],
        scoreDeltas: [0, 0, 0, 0],
        pointDeltas: [0, 0, 0, 0],
        dealerContinues: false,
        honbaIncrement: 1,
        riichiSticksCarryOver: true,
      },
    };
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={state}
        analysisOpen={false}
        canDiscard={false}
        handAnimationsEnabled={false}
        onToggleAnalysis={noop}
        onCloseAnalysis={noop}
        onReturnMenu={noop}
        onDiscard={noop}
        onReset={noop}
      />,
    );
    expect(html).toContain('result-dialog');
    expect(html).toContain('流局');
  });

  it('局终等待复用 PresentationPacingGate 的活动注册与 fail-open，组件内没有第二套固定 Result timer', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/game/GameScreen.tsx'), 'utf8');
    expect(source).toContain('presentationPacingGate.waitUntilActivityClearAfter');
    expect(source).toContain("status === 'timed-out'");
    expect(source).not.toContain('window.setTimeout');
  });

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

  it('2.5D 只作用于牌桌，交互手牌和 overlay 保持外层兄弟节点', () => {
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
    const tableIndex = html.indexOf('class="mahjong-table"');
    const localHandIndex = html.indexOf('class="local-hand-area');
    const eventOverlayIndex = html.indexOf('data-testid="game-event-overlay"');
    const promptIndex = html.indexOf('class="game-prompt-layer"');
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(tableIndex).toBeGreaterThan(-1);
    expect(localHandIndex).toBeGreaterThan(tableIndex);
    expect(eventOverlayIndex).toBeGreaterThan(localHandIndex);
    expect(promptIndex).toBeGreaterThan(localHandIndex);
    expect(css).toContain('.game-screen:not(.seventeen-steps-game) > .mahjong-table');
    expect(css).toContain('perspective(var(--mahjong-table-perspective))');
  });

  it('Test Mode 关闭 handAnimations 时同步禁用实时 Event Overlay', () => {
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={createInitialGameState()}
        analysisOpen={false}
        canDiscard={false}
        handAnimationsEnabled={false}
        onToggleAnalysis={noop}
        onCloseAnalysis={noop}
        onReturnMenu={noop}
        onDiscard={noop}
        onReset={noop}
      />,
    );
    expect(html).toContain('data-event-overlays-enabled="false"');
    expect(html).not.toContain('game-event-overlay-stage');
  });

  it('听牌框使用独立右下固定层，不随立直操作栏出现而移动', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toContain('.game-tenpai-layer');
    expect(css).toMatch(/\.game-tenpai-layer\s*\{[^}]*position:\s*absolute;/s);
    expect(css).toMatch(/\.game-tenpai-layer\s*\{[^}]*left:/s);
    expect(css).toMatch(/\.game-tenpai-layer\s*\{[^}]*bottom:/s);
    expect(css).not.toContain('.game-prompt-layer--with-tenpai');
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
    const preview = renderToStaticMarkup(<GameScreen {...props} actionPrompt={<section className="action-prompt">立直候选</section>} tenpaiPreviewDiscardInstanceId={candidate.instanceId} />);
    const cleared = renderToStaticMarkup(<GameScreen {...props} tenpaiPreviewDiscardInstanceId={null} />);
    expect(preview).toContain('听牌与剩余量');
    expect(preview).toContain('打出');
    expect(preview).toContain('总有效枚数');
    expect(preview).toContain('game-tenpai-layer');
    expect(cleared).not.toContain('听牌与剩余量');
  });

  it('关闭常驻听牌提示时，立直候选预览仍显示', () => {
    const state = riichiPreviewState();
    const candidate = getDrawActionState(state, 0).riichiDiscardCandidates[0];
    const html = renderToStaticMarkup(
      <GameScreen
        gameState={state}
        analysisOpen={false}
        actionPrompt={<section className="action-prompt">立直候选</section>}
        canDiscard={false}
        onToggleAnalysis={noop}
        onCloseAnalysis={noop}
        onReturnMenu={noop}
        onDiscard={noop}
        onReset={noop}
        showTenpaiWaitsEnabled={false}
        tenpaiPreviewDiscardInstanceId={candidate.instanceId}
        tenpaiPreviewRiichiKind="double-riichi"
      />,
    );
    expect(html).toContain('听牌与剩余量');
    expect(html).toContain('game-tenpai-layer');
  });

  it('二番缚立直候选预览计入立直番，不显示番数不足', () => {
    const { state, discardInstanceId } = minimumHanRiichiPreviewState();
    const props = {
      gameState: state,
      analysisOpen: false,
      canDiscard: false,
      onToggleAnalysis: noop,
      onCloseAnalysis: noop,
      onReturnMenu: noop,
      onDiscard: noop,
      onReset: noop,
      tenpaiPreviewDiscardInstanceId: discardInstanceId,
    };
    const ordinaryPreview = renderToStaticMarkup(<GameScreen {...props} />);
    const riichiPreview = renderToStaticMarkup(<GameScreen {...props} tenpaiPreviewRiichiKind="riichi" />);
    expect(ordinaryPreview).toContain('番数不足');
    expect(riichiPreview).toContain('听牌与剩余量');
    expect(riichiPreview).not.toContain('番数不足');
  });
});
