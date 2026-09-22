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

function withDuplicateRiichiPrompt(): GameState {
  const base = createInitialGameState();
  const ids: TileId[] = [0, 1, 2, 9, 10, 11, 18, 19, 20, 21, 22, 23, 23, 31];
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

describe('立直候选提示', () => {
  it('只显示一次立直文字，所有合法弃牌候选仍保留为牌图按钮', () => {
    const state = withRiichiPrompt();
    const actions = getDrawActionState(state, 0);
    const riichiCandidateCount = actions.riichiDiscardCandidateGroups.length;
    const html = renderToStaticMarkup(<Board gameState={state} {...handlers} />);
    const tileActionButtonCount = (html.match(/<button[^>]*class="[^"]*prompt-tile-action[^"]*"/g) ?? []).length;
    const visibleActionLabelCount = (html.match(/class="prompt-tile-action-label"/g) ?? []).length;

    expect(riichiCandidateCount).toBeGreaterThan(0);
    expect(tileActionButtonCount - visibleActionLabelCount).toBe(riichiCandidateCount);
    expect((html.match(/class="tile-image"/g) ?? []).length).toBeGreaterThanOrEqual(riichiCandidateCount);
    expect((html.match(/data-operation="riichi"/g) ?? [])).toHaveLength(riichiCandidateCount);
    expect((html.match(/data-riichi-candidate="true"/g) ?? [])).toHaveLength(riichiCandidateCount);
  });

  it('悬停、焦点、切换、移出、失焦、按下和点击候选时同步更新并清除听牌预览', () => {
    const candidates = getDrawActionState(withRiichiPrompt(), 0).riichiDiscardCandidateGroups;
    expect(candidates.length).toBeGreaterThan(1);
    const previews: Array<string | null> = [];
    let clicked = '';
    const candidateButton = (candidate: (typeof candidates)[number]) => TileActionButton({
      operation: 'riichi',
      label: '立直',
      tile: candidate.tile,
      onPreviewChange: (active) => previews.push(active ? candidate.instanceIds[0] : null),
      onClick: () => { clicked = candidate.instanceIds[0]; },
    });
    const first = candidateButton(candidates[0]);
    const second = candidateButton(candidates[1]);

    first.props.onPointerEnter();
    first.props.onPointerLeave();
    second.props.onPointerEnter();
    expect(previews.slice(-3)).toEqual([candidates[0].instanceIds[0], null, candidates[1].instanceIds[0]]);

    second.props.onPointerLeave();
    second.props.onFocus();
    second.props.onBlur();
    expect(previews.slice(-2)).toEqual([candidates[1].instanceIds[0], null]);
    second.props.onPointerEnter();
    second.props.onPointerDown();
    expect(previews[previews.length - 1]).toBeNull();

    second.props.onPointerEnter();
    second.props.onClick();
    expect(previews[previews.length - 1]).toBeNull();
    expect(clicked).toBe(candidates[1].instanceIds[0]);
  });

  it('相同普通牌在立直操作框只显示一个候选，并点击对应合法instanceId', () => {
    const state = withDuplicateRiichiPrompt();
    const actions = getDrawActionState(state, 0);
    const sixSouGroups = actions.riichiDiscardCandidateGroups.filter((candidate) => candidate.tile.id === 23 && !candidate.tile.red);
    const html = renderToStaticMarkup(<Board gameState={state} {...handlers} />);

    expect(sixSouGroups).toHaveLength(1);
    expect(sixSouGroups[0].instanceIds).toHaveLength(2);
    expect((html.match(/立直并打出6索/g) ?? [])).toHaveLength(1);

    let clicked = '';
    const candidate = sixSouGroups[0];
    const button = TileActionButton({
      operation: 'riichi',
      label: '立直',
      tile: candidate.tile,
      onClick: () => { clicked = candidate.instanceIds[0]; },
    });
    button.props.onClick();
    expect(clicked).toBe(candidate.instanceIds[0]);
  });
});
