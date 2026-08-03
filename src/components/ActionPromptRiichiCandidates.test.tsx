import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Board, TileActionButton } from './Board';
import { createInitialGameState } from '../game/engine';
import { getDrawActionState } from '../game/interaction';
import { createTile } from '../game/tileUtils';
import type { GameState, Tile, TileId } from '../game/types';

function noop() {
  return undefined;
}

const handlers = {
  onDiscard: noop,
  onTsumo: noop,
  onRon: noop,
  onPassRon: noop,
  onDeclareRiichi: noop,
  onDeclareKyuushuKyuuhai: noop,
  onPon: noop,
  onChi: noop,
  onKan: noop,
  onChankanRon: noop,
  onPassChankan: noop,
  onPassCall: noop,
  onSkipDrawActions: noop,
  onReset: noop,
};

function tiles(ids: TileId[]): Tile[] {
  return ids.map((id, index) => createTile(id, index));
}

function withRiichiPrompt(): GameState {
  const base = createInitialGameState();
  const localHand = tiles([0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 31]);
  return {
    ...base,
    phase: 'discard',
    currentPlayer: 0,
    players: base.players.map((player) => player.id === 0 ? {
      ...player,
      hand: localHand,
      drawnTile: localHand[localHand.length - 1],
      calls: [],
      riichi: false,
      riichiState: null,
    } : player),
  };
}

describe('立直候选提示', () => {
  it('只显示一次立直文字，所有合法弃牌候选仍保留为牌图按钮', () => {
    const state = withRiichiPrompt();
    const riichiCandidateCount = getDrawActionState(state, 0).riichiDiscardCandidates.length;
    const html = renderToStaticMarkup(<Board gameState={state} {...handlers} />);
    const tileActionButtonCount = (html.match(/class="prompt-tile-action"/g) ?? []).length;
    const visibleActionLabelCount = (html.match(/class="prompt-tile-action-label"/g) ?? []).length;

    expect(riichiCandidateCount).toBeGreaterThan(0);
    expect(tileActionButtonCount - visibleActionLabelCount).toBe(riichiCandidateCount);
    expect((html.match(/class="tile-image"/g) ?? []).length).toBeGreaterThanOrEqual(riichiCandidateCount);
  });

  it('悬停、切换、移出、按下和点击候选时同步更新并清除听牌预览', () => {
    const candidates = getDrawActionState(withRiichiPrompt(), 0).riichiDiscardCandidates;
    expect(candidates.length).toBeGreaterThan(1);
    const previews: Array<string | null> = [];
    let clicked = '';
    const candidateButton = (tile: Tile) => TileActionButton({
      label: '立直',
      tile,
      onPreviewChange: (active) => previews.push(active ? tile.instanceId : null),
      onClick: () => { clicked = tile.instanceId; },
    });
    const first = candidateButton(candidates[0]);
    const second = candidateButton(candidates[1]);

    first.props.onPointerEnter();
    first.props.onPointerLeave();
    second.props.onPointerEnter();
    expect(previews.slice(-3)).toEqual([candidates[0].instanceId, null, candidates[1].instanceId]);

    second.props.onPointerLeave();
    second.props.onPointerEnter();
    second.props.onPointerDown();
    expect(previews[previews.length - 1]).toBeNull();

    second.props.onPointerEnter();
    second.props.onClick();
    expect(previews[previews.length - 1]).toBeNull();
    expect(clicked).toBe(candidates[1].instanceId);
  });
});
