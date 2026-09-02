import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import { getDrawActionState } from '../../game/interaction';
import { createTile } from '../../game/tileUtils';
import {
  buildDoraIndicatorSlots,
  buildTablePresentationState,
  createTableInteractionActions,
  withLocalHandSelection,
} from './TablePresentationContract';

describe('UI-5C.5 shared table presentation contract', () => {
  it('keeps TableSceneState wall semantics while exposing the same scene to both renderers', () => {
    const state = createInitialGameState();
    const presentation = buildTablePresentationState(state, { canDiscardOverride: false });

    expect(presentation.scene.wall).toHaveLength(69);
    expect(presentation.scene.deadWall).toHaveLength(14);
    expect(presentation.scene.doraIndicators).toHaveLength(1);
  });

  it('builds one revealed and four identity-free hidden Dora slots initially', () => {
    const state = createInitialGameState();
    const slots = buildDoraIndicatorSlots(state.doraIndicators);

    expect(slots).toHaveLength(5);
    expect(slots.filter((slot) => slot.state === 'revealed')).toHaveLength(1);
    expect(slots.filter((slot) => slot.state === 'hidden')).toHaveLength(4);
    for (const slot of slots.filter((entry) => entry.state === 'hidden')) {
      expect(slot).not.toHaveProperty('tile');
    }
  });

  it('reveals Kan indicators in order, caps at five, and preserves authoritative red state', () => {
    const state = createInitialGameState();
    const redIndicator = { ...createTile(4, 900), red: true };
    const afterKan = buildDoraIndicatorSlots([state.doraIndicators[0], redIndicator]);
    const maximum = buildDoraIndicatorSlots([
      state.doraIndicators[0],
      redIndicator,
      ...state.deadWall.slice(0, 4),
    ]);

    expect(afterKan.map((slot) => slot.state)).toEqual([
      'revealed', 'revealed', 'hidden', 'hidden', 'hidden',
    ]);
    expect(afterKan[1]).toMatchObject({ state: 'revealed', tile: { id: 4, red: true } });
    expect(maximum).toHaveLength(5);
    expect(maximum.every((slot) => slot.state === 'revealed')).toBe(true);
  });

  it('shares drawn, playable, selected, and Riichi-candidate identities without recalculating them in renderers', () => {
    const state = createInitialGameState();
    const selected = state.players[0].hand[0].instanceId;
    const authority = getDrawActionState(state, 0);
    const presentation = buildTablePresentationState(state, {
      canDiscardOverride: true,
      allowedDiscardInstanceIdsOverride: [selected],
      selectedTileInstanceId: selected,
    });

    expect(presentation.localHand.playableTileInstanceIds).toEqual([selected]);
    expect(presentation.localHand.tiles.find((entry) => entry.tile.instanceId === selected))
      .toMatchObject({ playable: true, selected: true });
    expect(presentation.localHand.tiles[presentation.localHand.tiles.length - 1]?.tile.instanceId)
      .toBe(presentation.localHand.drawnTileInstanceId);
    expect(presentation.localHand.riichiCandidateInstanceIds).toEqual(
      authority.riichiDiscardCandidateGroups.flatMap((candidate) => candidate.instanceIds),
    );
    expect(presentation.drawActions).toEqual(authority);
  });

  it('centralizes legal action and prompt state at the existing rule selectors', () => {
    const state = createInitialGameState();
    const authority = getDrawActionState(state, 0);
    const presentation = buildTablePresentationState(state);

    expect(presentation.legalActions.canTsumo).toBe(authority.canTsumo);
    expect(presentation.legalActions.canRiichi).toBe(authority.canRiichi);
    expect(presentation.prompt.open).toBe(
      presentation.prompt.draw
      || presentation.prompt.ron
      || presentation.prompt.call
      || presentation.prompt.chankan,
    );
    expect(presentation.legalActions.canSkip).toBe(presentation.prompt.open);
  });

  it('projects the existing selected preview into shared state without changing legality', () => {
    const presentation = buildTablePresentationState(createInitialGameState(), {
      canDiscardOverride: true,
    });
    const selectedId = presentation.localHand.tiles[0].tile.instanceId;
    const selected = withLocalHandSelection(presentation, selectedId);
    expect(selected.localHand.selectedTileInstanceId).toBe(selectedId);
    expect(selected.localHand.tiles.find((entry) => entry.selected)?.tile.instanceId).toBe(selectedId);
    expect(selected.localHand.playableTileInstanceIds)
      .toEqual(presentation.localHand.playableTileInstanceIds);
  });

  it('routes renderer-neutral selection and discard actions to the existing controller boundary', () => {
    const selectTile = vi.fn();
    const discard = vi.fn();
    const actions = createTableInteractionActions(2, selectTile, discard);

    actions.selectTile('tile-1');
    actions.selectTile(null);
    actions.discard('tile-2');

    expect(selectTile.mock.calls).toEqual([['tile-1'], [null]]);
    expect(discard).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledWith(2, 'tile-2');
  });
});
