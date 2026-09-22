import { describe, expect, it, vi } from 'vitest';
import { createTile } from '../../game/tileUtils';
import type { LocalHandPresentation, TableInteractionActions } from '../../presentation/table/TablePresentationContract';
import {
  activateHand3DTile,
  clearHoveredTileIfMatching,
  clearHand3DSelection,
  getStableHandHitInterval,
  shouldCommitDeferredHoverRelease,
  resolveHand3DCursor,
  resolveHand3DInteractionBinding,
  selectHand3DTile,
} from './handInteraction';
import { TILE_SPACING_3D } from '../tile/tileSpacing';

function presentation(): LocalHandPresentation {
  const tile = createTile(4, 0);
  return {
    playerId: 0,
    tiles: [{ tile, playable: true, selected: true, drawn: true, riichiCandidate: true }],
    canDiscard: true,
    playableTileInstanceIds: [tile.instanceId],
    selectedTileInstanceId: tile.instanceId,
    drawnTileInstanceId: tile.instanceId,
    riichiCandidateInstanceIds: [tile.instanceId],
    kuikaeForbiddenTileIds: [],
  };
}

function actions(): TableInteractionActions & Readonly<{
  selectTile: ReturnType<typeof vi.fn>;
  discard: ReturnType<typeof vi.fn>;
}> {
  return { selectTile: vi.fn(), discard: vi.fn() };
}

describe('UI-5D Hand3D shared interaction binding', () => {
  it('maps stable tile identity, index and every shared presentation state', () => {
    const state = presentation();
    expect(resolveHand3DInteractionBinding(
      0,
      `hand-0-${state.tiles[0].tile.instanceId}`,
      0,
      state,
    )).toEqual({
      tileInstanceId: state.tiles[0].tile.instanceId,
      handIndex: 0,
      playable: true,
      selected: true,
      drawn: true,
      riichiCandidate: true,
    });
  });

  it('routes playable hover and click through shared actions exactly once', () => {
    const state = presentation();
    const binding = resolveHand3DInteractionBinding(
      0,
      `hand-0-${state.tiles[0].tile.instanceId}`,
      0,
      state,
    );
    const sharedActions = actions();
    expect(selectHand3DTile(binding, sharedActions)).toBe(true);
    expect(activateHand3DTile(binding, sharedActions)).toBe(true);
    expect(sharedActions.selectTile).toHaveBeenNthCalledWith(1, state.tiles[0].tile.instanceId);
    expect(sharedActions.selectTile).toHaveBeenNthCalledWith(2, null);
    expect(sharedActions.discard).toHaveBeenCalledOnce();
    expect(sharedActions.discard).toHaveBeenCalledWith(state.tiles[0].tile.instanceId);
  });

  it('never dispatches a disabled or mismatched tile', () => {
    const state = presentation();
    const sharedActions = actions();
    const disabled = { ...resolveHand3DInteractionBinding(
      0,
      `hand-0-${state.tiles[0].tile.instanceId}`,
      0,
      state,
    )!, playable: false };
    expect(selectHand3DTile(disabled, sharedActions)).toBe(false);
    expect(activateHand3DTile(disabled, sharedActions)).toBe(false);
    expect(resolveHand3DInteractionBinding(1, 'hand-1-hidden', 0, state)).toBeNull();
    expect(sharedActions.selectTile).not.toHaveBeenCalled();
    expect(sharedActions.discard).not.toHaveBeenCalled();
  });

  it('clears the shared selection on pointer leave', () => {
    const sharedActions = actions();
    clearHand3DSelection(sharedActions);
    expect(sharedActions.selectTile).toHaveBeenCalledWith(null);
  });

  it('keeps hover ownership stable when an adjacent tile emits pointer out', () => {
    expect(clearHoveredTileIfMatching('tile-b', 'tile-a')).toBe('tile-b');
    expect(clearHoveredTileIfMatching('tile-a', 'tile-a')).toBeNull();
    expect(resolveHand3DCursor('tile-a')).toBe('pointer');
    expect(resolveHand3DCursor(null)).toBe('default');
  });

  it('cancels a deferred release when the same event turn restores hover ownership', () => {
    expect(shouldCommitDeferredHoverRelease('tile-a', 'tile-a', 4, 4)).toBe(true);
    expect(shouldCommitDeferredHoverRelease('tile-a', 'tile-a', 4, 5)).toBe(false);
    expect(shouldCommitDeferredHoverRelease('tile-b', 'tile-a', 4, 4)).toBe(false);
  });

  it('keeps neighbouring stable hit targets disjoint', () => {
    [1, 0.9, 0.8].forEach((tileScale) => {
      const first = getStableHandHitInterval(0, tileScale);
      const second = getStableHandHitInterval(
        TILE_SPACING_3D.standingHand * tileScale,
        tileScale,
      );
      expect(first.max).toBeLessThan(second.min);
    });
  });
});
