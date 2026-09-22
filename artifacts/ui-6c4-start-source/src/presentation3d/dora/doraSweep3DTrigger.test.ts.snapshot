import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../game/engine';
import type {
  TileDiscardedPresentationEvent,
  TileDrawnPresentationEvent,
} from '../../presentation/PresentationEventBus';
import type { TileDoraVisualKind } from '../../presentation/table/tileVisualSemantics';
import type { ActiveTableAnimation3D } from '../animation/HandAction3D';
import { buildTableSceneState } from '../sceneState/buildTableSceneState';
import type { TableSceneState, TableSceneTile } from '../sceneState/tableSceneTypes';
import { resolveDoraSweep3DTrigger } from './doraSweep3DTrigger';

const VISUAL_CONTEXT = { doraGlowEnabled: true } as const;

describe('UI-5F.3 settled event trigger semantics', () => {
  it('activates a normal Dora only after the discard enters retreat/settled handoff', () => {
    const tile = sceneTile('river-dora', 'tile--dora');
    const scene = withBottomRiver(tile);

    expect(resolveDoraSweep3DTrigger(activeDiscard('travel', tile.key), scene, VISUAL_CONTEXT)).toBeNull();
    expect(resolveDoraSweep3DTrigger(activeDiscard('retreat', tile.key), scene, VISUAL_CONTEXT)).toEqual({
      eventId: 'discard-event',
      targets: [{ key: tile.key, variant: 'normal' }],
    });
  });

  it('activates the combined variant for Aka + Dora', () => {
    const tile = sceneTile('river-combined', 'tile--double-dora', true);
    expect(resolveDoraSweep3DTrigger(
      activeDiscard('retreat', tile.key),
      withBottomRiver(tile),
      VISUAL_CONTEXT,
    )?.targets).toEqual([{ key: tile.key, variant: 'combined' }]);
  });

  it('does not activate non-Dora or hidden identity', () => {
    const nonDora = sceneTile('river-normal', null);
    const hidden = {
      ...sceneTile('river-hidden', 'tile--dora'),
      tile: undefined,
      faceState: 'face-down' as const,
    };
    const scene = withBottomRiver(nonDora, hidden);

    expect(resolveDoraSweep3DTrigger(activeDiscard('retreat', nonDora.key), scene, VISUAL_CONTEXT)).toBeNull();
    expect(resolveDoraSweep3DTrigger(activeDiscard('retreat', hidden.key), scene, VISUAL_CONTEXT)).toBeNull();
  });

  it('supports visible Hand3D and four-tile Meld targets from authoritative animation keys', () => {
    const handTile = { ...sceneTile('hand-dora', 'tile--dora'), drawn: true };
    const meldTiles = Array.from({ length: 4 }, (_, index) => ({
      ...sceneTile(`meld-dora-${index}`, 'tile--dora'),
      called: index === 0,
      stacked: index === 3,
    }));
    const base = buildTableSceneState(createInitialGameState());
    const scene: TableSceneState = {
      ...base,
      seats: {
        ...base.seats,
        top: { ...base.seats.top, hand: [handTile] },
        right: {
          ...base.seats.right,
          melds: [{ key: 'meld-1', callType: 'minkan', tiles: meldTiles }],
        },
      },
    };
    const drawAction: TileDrawnPresentationEvent = {
      eventId: 'draw-event',
      sequence: 1,
      type: 'tile_drawn',
      playerId: base.seats.top.playerId,
    };
    const draw = {
      phase: 'retreat',
      plan: { action: drawAction, hiddenHandKey: handTile.key },
    } as unknown as ActiveTableAnimation3D;
    const meld = {
      phase: 'retreat',
      plan: {
        action: {
          eventId: 'meld-event',
          sequence: 2,
          type: 'meld_declared',
          playerId: base.seats.right.playerId,
          meldType: 'kan',
          kanType: 'minkan',
        },
        hiddenMeldTileKeys: meldTiles.map((tile) => tile.key),
      },
    } as unknown as ActiveTableAnimation3D;

    expect(resolveDoraSweep3DTrigger(draw, scene, VISUAL_CONTEXT)?.targets).toEqual([
      { key: handTile.key, variant: 'normal' },
    ]);
    expect(resolveDoraSweep3DTrigger(meld, scene, VISUAL_CONTEXT)?.targets).toHaveLength(4);
  });

  it('respects the shared doraGlowEnabled semantic switch', () => {
    const tile = sceneTile('river-dora-disabled', 'tile--dora');
    expect(resolveDoraSweep3DTrigger(
      activeDiscard('retreat', tile.key),
      withBottomRiver(tile),
      { doraGlowEnabled: false },
    )).toBeNull();
  });
});

function sceneTile(
  key: string,
  doraKind: TileDoraVisualKind | null,
  red = false,
): TableSceneTile {
  return {
    key,
    tile: { id: 4, red, doraKind },
    faceState: 'face-up',
    orientation: 'upright',
  };
}

function withBottomRiver(...tiles: readonly TableSceneTile[]): TableSceneState {
  const base = buildTableSceneState(createInitialGameState());
  return {
    ...base,
    seats: {
      ...base.seats,
      bottom: {
        ...base.seats.bottom,
        river: tiles.map((tile, index) => ({
          ...tile,
          riverIndex: index,
          layoutIndex: index,
          claimed: false,
          visible: true,
        })),
      },
    },
  };
}

function activeDiscard(
  phase: ActiveTableAnimation3D['phase'],
  hiddenRiverKey: string,
): ActiveTableAnimation3D {
  const action: TileDiscardedPresentationEvent = {
    eventId: 'discard-event',
    sequence: 1,
    type: 'tile_discarded',
    playerId: 0,
    tile: { id: 4, red: false },
    riverIndex: 0,
    isRiichiDiscard: false,
  };
  return { phase, plan: { action, hiddenRiverKey } } as ActiveTableAnimation3D;
}
