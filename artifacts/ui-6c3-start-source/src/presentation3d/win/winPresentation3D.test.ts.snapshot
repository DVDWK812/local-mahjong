import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import type { WinPresentationAction } from '../../presentation/winAnimation/WinPresentationController';
import { buildTableSceneState } from '../sceneState/buildTableSceneState';
import {
  resolveWinnerHandMotion3D,
  resolveWinningRiverTarget3D,
  resolveWinnerRevealPlayerId3D,
  type WinPresentation3DState,
} from './winPresentation3D';

function presentation(overrides: Partial<WinPresentation3DState> = {}): WinPresentation3DState {
  const action: WinPresentationAction = {
    eventId: 'win-2',
    sequence: 2,
    type: 'win_declared',
    playerId: 2,
    winType: 'ron',
    sourceEventId: 'discard-1',
    sourceDiscard: {
      eventId: 'discard-1',
      sequence: 1,
      type: 'tile_discarded',
      playerId: 0,
      tile: { id: 14, red: false },
      riverIndex: 7,
      isRiichiDiscard: true,
    },
  };
  return { action, phase: 'ready', ...overrides };
}

describe('3D win presentation semantics', () => {
  it('confirmed opponent 才返回 reveal player，本家继续由 DOM 表现', () => {
    expect(resolveWinnerRevealPlayerId3D(null, 0)).toBeUndefined();
    expect(resolveWinnerRevealPlayerId3D(presentation(), 0)).toBe(2);
    expect(resolveWinnerRevealPlayerId3D(presentation({
      action: { ...presentation().action, playerId: 0 },
    }), 0)).toBeUndefined();

    const state = createInitialGameState();
    const beforeConfirm = buildTableSceneState(state, { bottomPlayerId: 0 });
    const afterConfirm = buildTableSceneState(state, {
      bottomPlayerId: 0,
      revealedPlayerId: resolveWinnerRevealPlayerId3D(presentation(), 0),
    });
    expect(beforeConfirm.seats.top.hand.every((tile) => tile.faceState === 'face-down' && tile.tile === undefined)).toBe(true);
    expect(afterConfirm.seats.top.hand.every((tile) => tile.faceState === 'face-up' && tile.tile !== undefined)).toBe(true);
    expect(afterConfirm.seats.right.hand.every((tile) => tile.faceState === 'face-down' && tile.tile === undefined)).toBe(true);
    expect(afterConfirm.seats.left.hand.every((tile) => tile.faceState === 'face-down' && tile.tile === undefined)).toBe(true);
  });

  it('Ron 只使用 sourceEventId 已解析出的真实 riverIndex，不猜最后一张', () => {
    expect(resolveWinningRiverTarget3D(presentation())).toEqual({ playerId: 0, riverIndex: 7 });
    expect(resolveWinningRiverTarget3D(presentation({
      action: { ...presentation().action, sourceDiscard: undefined },
    }))).toBeNull();
    expect(resolveWinningRiverTarget3D(presentation({
      action: { ...presentation().action, winType: 'tsumo', sourceDiscard: undefined },
    }))).toBeNull();
  });

  it('winner hand 仅在 active phases 向中心推进并倾倒，cleanup 恢复基线', () => {
    expect(resolveWinnerHandMotion3D('top', 'ready')).toEqual({ offset: [0, 0, 0], tiltX: 0 });
    expect(resolveWinnerHandMotion3D('top', 'hold').offset[2]).toBeGreaterThan(0);
    expect(resolveWinnerHandMotion3D('right', 'hold').offset[0]).toBeLessThan(0);
    expect(resolveWinnerHandMotion3D('left', 'hold').offset[0]).toBeGreaterThan(0);
    expect(resolveWinnerHandMotion3D('top', 'hold').tiltX).toBeLessThan(0);
    expect(resolveWinnerHandMotion3D('top', 'cleanup')).toEqual({ offset: [0, 0, 0], tiltX: 0 });
  });
});
