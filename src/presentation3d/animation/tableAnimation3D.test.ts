import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SetStateAction } from 'react';
import { createInitialGameState } from '../../game/engine';
import type { GameState, PlayerId } from '../../game/types';
import { AnimationScheduler, effectiveAnimationDuration } from '../../presentation/animation/AnimationScheduler';
import { HandAnimationController } from '../../presentation/handAnimation/HandAnimationController';
import { HandAnimationConsumer } from '../../presentation/handAnimation/HandAnimationConsumer';
import { DiscardSourceSnapshotStore } from '../../presentation/handAnimation/DiscardSourceSnapshot';
import { PresentationPacingGate } from '../../presentation/pacing/PresentationPacingGate';
import { PresentationEventBus } from '../../presentation/PresentationEventBus';
import type {
  MeldDeclaredPresentationEvent,
  RiichiDeclaredPresentationEvent,
  TileDiscardedPresentationEvent,
  TileDrawnPresentationEvent,
} from '../../presentation/PresentationEventBus';
import { buildTableSceneState } from '../sceneState/buildTableSceneState';
import type { MeldSceneState, TableSceneState } from '../sceneState/tableSceneTypes';
import { getMeldTileTransforms } from '../coordinates/sceneTransforms';
import type { Table3DSeat } from '../coordinates/seatTransforms';
import { getTileWorldBottomY } from '../tile/tileGrounding';
import { TABLE_FELT_TOP_Y } from '../table/tableSurfaceSpec';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import { DiscardSource3DStore } from './DiscardSource3D';
import { PaintCommitBarrier } from './PaintCommitBarrier';
import {
  getTableAnimation3DHoldMs,
  resolveTableAnimation3DMotion,
  resolveTableAnimation3DPlan,
  resolveTransientTile3DMotion,
  TABLE_ANIMATION_3D_CADENCE,
} from './tableAnimation3D';
import {
  prepareTableAnimation3DRenderState,
  TableAnimation3DTarget,
  transitionTableAnimation3DRenderState,
  type TableAnimation3DRenderState,
} from './useTableAnimation3D';

function sourcePath(relativePath: string): string {
  return decodeURIComponent(new URL(relativePath, import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
}

function withPlayer(
  state: GameState,
  playerId: PlayerId,
  update: Partial<GameState['players'][number]>,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId
      ? { ...player, ...update }
      : player),
  };
}

const drawEvent = (playerId: PlayerId, sequence = 1): TileDrawnPresentationEvent => ({
  eventId: `draw-${playerId}-${sequence}`,
  sequence,
  type: 'tile_drawn',
  playerId,
});

function discardEvent(
  playerId: PlayerId,
  tile: GameState['players'][number]['hand'][number],
  riverIndex: number,
  sequence: number,
): TileDiscardedPresentationEvent {
  return {
    eventId: `discard-${playerId}-${sequence}`,
    sequence,
    type: 'tile_discarded',
    playerId,
    tile: { id: tile.id, red: tile.red },
    riverIndex,
    isRiichiDiscard: false,
  };
}

function renderStateHarness() {
  let renderState: TableAnimation3DRenderState = {
    active: null,
    hiddenHandKeys: new Set(),
    hiddenRiverKeys: new Set(),
    hiddenMeldTileKeys: new Set(),
    hiddenRiichiSeats: new Set(),
  };
  const setRenderState = (update: SetStateAction<TableAnimation3DRenderState>) => {
    renderState = typeof update === 'function' ? update(renderState) : update;
  };
  return { get: () => renderState, setRenderState };
}

function withBottomMeld(
  scene: TableSceneState,
  callType: MeldSceneState['callType'],
): TableSceneState {
  const sourceTiles = scene.seats.bottom.hand.slice(0, 4);
  const tileCount = callType === 'chi' || callType === 'pon' ? 3 : 4;
  const meld: MeldSceneState = {
    key: `meld-${callType}`,
    callType,
    tiles: sourceTiles.slice(0, tileCount).map((tile, index) => ({
      ...tile,
      key: `${callType}-${index}`,
      drawn: undefined,
      called: index === 1,
      stacked: callType === 'kakan' && index === 3,
      orientation: index === 1 ? 'sideways' : 'upright',
      faceState: callType === 'ankan' && (index === 0 || index === 3) ? 'face-down' : 'face-up',
    })),
  };
  return {
    ...scene,
    seats: {
      ...scene.seats,
      bottom: { ...scene.seats.bottom, melds: [meld] },
    },
  };
}

describe('UI-5E.1 3D draw/discard plans', () => {
  it('enqueues bottom draw pacing for the DOM hand without creating a duplicate world proxy', async () => {
    const initial = createInitialGameState();
    const rightPlayer = initial.players[1];
    const scene = buildTableSceneState(withPlayer(initial, 1, {
      drawnTile: rightPlayer.hand[rightPlayer.hand.length - 1],
    }));
    const harness = renderStateHarness();
    const target = new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
    );

    const localPhases: string[] = [];
    const localTarget = new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
      () => 0,
      () => undefined,
      (state) => localPhases.push(state?.phase ?? 'clear'),
    );

    expect(localTarget.beforeEnqueue(drawEvent(0, 100))).toBe(true);
    await localTarget.prepare(drawEvent(0, 100));
    expect(harness.get().active?.plan.showPrimaryTile).toBe(false);
    expect(harness.get().active?.plan.localDomDraw).toBe(true);
    expect(localPhases).toContain('enter');
    expect(target.beforeEnqueue(drawEvent(1, 101))).toBe(true);
  });

  it('resolves all four draw seats to their authoritative drawn slot and keeps opponents hidden', () => {
    let state = createInitialGameState();
    ([1, 2, 3] as PlayerId[]).forEach((playerId) => {
      const player = state.players[playerId];
      state = withPlayer(state, playerId, { drawnTile: player.hand[player.hand.length - 1] });
    });
    const scene = buildTableSceneState(state);
    const store = new DiscardSource3DStore();
    const plans = ([0, 1, 2, 3] as PlayerId[]).map((playerId) =>
      resolveTableAnimation3DPlan(drawEvent(playerId), scene, store, 'east-1'));

    expect(plans.map((plan) => plan?.seat)).toEqual(['bottom', 'right', 'top', 'left']);
    expect(plans[0]?.tile).toBeDefined();
    plans.slice(1).forEach((plan) => {
      expect(plan?.faceState).toBe('face-down');
      expect(plan?.tile).toBeUndefined();
    });
    expect(plans[0]?.hiddenHandKey).toBeUndefined();
    plans.slice(1).forEach((plan) => {
      expect(plan?.hiddenHandKey).toBeTruthy();
    });
    plans.forEach((plan) => {
      expect(plan?.entry).not.toEqual(plan?.destination);
    });
  });

  it.each([0, 1, 2, 3] as PlayerId[])('creates a scheduler task for seat %s TileDrawn', async (playerId) => {
    const initial = createInitialGameState();
    const player = initial.players[playerId];
    const scene = buildTableSceneState(withPlayer(initial, playerId, {
      drawnTile: player.hand[player.hand.length - 1],
    }));
    const harness = renderStateHarness();
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const controller = new HandAnimationController(new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
    ), scheduler);

    expect(controller.enqueue(drawEvent(playerId, 200 + playerId))).toBe(true);
    await controller.whenIdle();
    expect(scheduler.activeRunCount).toBe(0);
    expect(harness.get().active).toBeNull();
    controller.dispose();
  });

  it.each([0, 1, 2, 3] as PlayerId[])('creates a scheduler task for seat %s TileDiscarded', async (playerId) => {
    const initial = createInitialGameState();
    const player = initial.players[playerId];
    const discarded = player.hand[0];
    const scene = buildTableSceneState(withPlayer(initial, playerId, {
      hand: player.hand.slice(1),
      river: [discarded],
    }));
    const harness = renderStateHarness();
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const controller = new HandAnimationController(new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
    ), scheduler);

    expect(controller.enqueue(discardEvent(playerId, discarded, 0, 300 + playerId))).toBe(true);
    await controller.whenIdle();
    expect(scheduler.activeRunCount).toBe(0);
    expect(harness.get().active).toBeNull();
    controller.dispose();
  });

  it('consumes the local DOM snapshot and clears it only when the 3D proxy and River mask are ready', async () => {
    const initial = createInitialGameState();
    const discarded = initial.players[0].hand[0];
    const scene = buildTableSceneState(withPlayer(initial, 0, {
      hand: initial.players[0].hand.slice(1),
      river: [discarded],
    }));
    const snapshots = new DiscardSourceSnapshotStore();
    snapshots.capture({
      playerId: 0,
      tileInstanceId: discarded.instanceId,
      tile: { id: discarded.id, red: discarded.red },
      sourceTileRect: { left: 100, top: 600, width: 42, height: 64 },
      sessionKey: 'east-1',
      confirmedTurn: 5,
    });
    const harness = renderStateHarness();
    const localPhases: string[] = [];
    let nextFrameHandle = 1;
    const paintFrames = new Map<number, FrameRequestCallback>();
    const paintBarrier = new PaintCommitBarrier((callback) => {
      const handle = nextFrameHandle++;
      paintFrames.set(handle, callback);
      return handle;
    }, (handle) => { paintFrames.delete(handle); });
    const target = new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
      () => 5,
      () => snapshots,
      (state) => localPhases.push(state?.phase ?? 'clear'),
      paintBarrier,
    );
    const action = discardEvent(0, discarded, 0, 5);

    expect(target.beforeEnqueue(action)).toBe(true);
    expect(snapshots.hasSnapshot).toBe(false);
    expect(localPhases).toEqual([]);
    expect(target.prepare(action)).toBe(true);
    expect(harness.get().active?.plan.localDiscardSnapshotReady).toBe(true);
    expect(harness.get().hiddenRiverKeys.size).toBe(1);
    expect(localPhases).toEqual([]);
    paintFrames.get(1)?.(0);
    paintFrames.delete(1);
    await Promise.resolve();
    expect(localPhases).toEqual([]);
    paintFrames.get(2)?.(16);
    paintFrames.delete(2);
    await Promise.resolve();
    expect(localPhases).toEqual(['proxy-ready']);
  });

  it('keeps transient animation meshes outside pointer ownership and raycast hit testing', () => {
    const actionSource = readFileSync(sourcePath('./HandAction3D.tsx'), 'utf8');
    const handProxySource = readFileSync(sourcePath('./HandProxy3D.tsx'), 'utf8');

    expect(actionSource).not.toContain('onPointerDown=');
    expect(actionSource).not.toContain('onPointerUp=');
    expect(actionSource).not.toContain('onClick=');
    expect(actionSource.match(/raycastDisabled/g)?.length).toBeGreaterThanOrEqual(3);
    expect(handProxySource.match(/raycast=\{\(\) => undefined\}/g)).toHaveLength(2);
  });

  it('moves a confirmed discard from the captured hand transform to the authoritative river slot', () => {
    const initial = createInitialGameState();
    const discarded = initial.players[0].hand[0];
    const next = withPlayer(initial, 0, {
      hand: initial.players[0].hand.slice(1),
      drawnTile: null,
      river: [discarded],
    });
    const scene = buildTableSceneState(next);
    const store = new DiscardSource3DStore();
    store.capture({
      playerId: 0,
      tileInstanceId: discarded.instanceId,
      tile: { id: discarded.id, red: discarded.red },
      position: [2.5, 0.8, 9.45],
      rotationX: Math.PI / 2,
      rotationY: 0,
      sessionKey: 'east-1',
      afterSequence: 4,
    });
    const event: TileDiscardedPresentationEvent = {
      eventId: 'discard-5',
      sequence: 5,
      type: 'tile_discarded',
      playerId: 0,
      tile: { id: discarded.id, red: discarded.red },
      riverIndex: 0,
      isRiichiDiscard: false,
    };
    const plan = resolveTableAnimation3DPlan(event, scene, store, 'east-1');

    expect(plan?.source).toEqual([2.5, 0.8, 9.45]);
    expect(plan?.source).not.toEqual(plan?.destination);
    expect(plan?.hiddenRiverKey).toBe(`river-0-${discarded.instanceId}`);
    const halfway = plan && resolveTableAnimation3DMotion(plan, 'travel', 0.5);
    expect(halfway && getTileWorldBottomY(halfway.tilePosition[1], halfway.tileRotationX))
      .toBeGreaterThanOrEqual(TABLE_FELT_TOP_Y);
    const released = plan && resolveTableAnimation3DMotion(plan, 'retreat', 0);
    expect(released?.tileVisible).toBe(false);
    expect(released?.tileScale).toBe(TABLE_PRESENTATION_TUNING.tileScale.river);
  });

  it('settles the discard proxy at River scale with scale-aware grounding', () => {
    const tuning = TABLE_PRESENTATION_TUNING.tileScale as unknown as { river: number };
    const previousScale = tuning.river;
    tuning.river = 0.8;
    try {
      const initial = createInitialGameState();
      const discarded = initial.players[0].hand[0];
      const scene = buildTableSceneState(withPlayer(initial, 0, {
        hand: initial.players[0].hand.slice(1),
        river: [discarded],
      }));
      const plan = resolveTableAnimation3DPlan(
        discardEvent(0, discarded, 0, 6),
        scene,
        new DiscardSource3DStore(),
        'east-1',
      );
      expect(plan).not.toBeNull();
      if (!plan) return;

      const halfway = resolveTableAnimation3DMotion(plan, 'travel', 0.5);
      const released = resolveTableAnimation3DMotion(plan, 'release', 1);
      expect(halfway.tileScale).toBeCloseTo(0.9);
      expect(released.tileScale).toBe(0.8);
      expect(getTileWorldBottomY(
        released.tilePosition[1],
        released.tileRotationX,
        released.tileScale,
      )).toBeGreaterThanOrEqual(TABLE_FELT_TOP_Y);

      const drawPlan = resolveTableAnimation3DPlan(
        drawEvent(1, 7),
        buildTableSceneState(withPlayer(initial, 1, {
          drawnTile: initial.players[1].hand[initial.players[1].hand.length - 1],
        })),
        new DiscardSource3DStore(),
        'east-1',
      );
      expect(drawPlan).not.toBeNull();
      if (drawPlan) {
        expect(resolveTableAnimation3DMotion(drawPlan, 'release', 1).tileScale)
          .toBe(TABLE_PRESENTATION_TUNING.tileScale.rightHand);
      }
    } finally {
      tuning.river = previousScale;
    }
  });

  it('shares Hand, River, and Meld scales with animation sources, targets, and grounding', () => {
    const tuning = TABLE_PRESENTATION_TUNING.tileScale as unknown as {
      river: number;
      meld: number;
      topHand: number;
      rightHand: number;
    };
    const previous = { ...tuning };
    try {
      tuning.river = 0.9;
      tuning.meld = 0.7;
      tuning.topHand = 0.8;
      tuning.rightHand = 0.75;
      const initial = createInitialGameState();
      const rightPlayer = initial.players[1];
      const rightDraw = resolveTableAnimation3DPlan(
        drawEvent(1, 70),
        buildTableSceneState(withPlayer(initial, 1, {
          drawnTile: rightPlayer.hand[rightPlayer.hand.length - 1],
        })),
        new DiscardSource3DStore(),
        'east-1',
      );
      expect(rightDraw?.sourceScale).toBe(0.75);
      expect(rightDraw?.destinationScale).toBe(0.75);
      if (rightDraw) {
        expect(resolveTableAnimation3DMotion(rightDraw, 'release', 1).tileScale).toBe(0.75);
      }

      const topDiscarded = initial.players[2].hand[0];
      const topDiscard = resolveTableAnimation3DPlan(
        discardEvent(2, topDiscarded, 0, 71),
        buildTableSceneState(withPlayer(initial, 2, {
          hand: initial.players[2].hand.slice(1),
          river: [topDiscarded],
        })),
        new DiscardSource3DStore(),
        'east-1',
      );
      expect(topDiscard?.sourceScale).toBe(0.8);
      expect(topDiscard?.destinationScale).toBe(0.9);
      if (topDiscard) {
        expect(resolveTableAnimation3DMotion(topDiscard, 'travel', 0.5).tileScale)
          .toBeCloseTo(0.85);
      }

      const meldScene = withBottomMeld(buildTableSceneState(initial), 'pon');
      const meldPlan = resolveTableAnimation3DPlan(
        {
          eventId: 'meld-scale', sequence: 72, type: 'meld_declared', playerId: 0,
          meldType: 'pon',
        },
        meldScene,
        new DiscardSource3DStore(),
        'east-1',
      );
      const transient = meldPlan?.transientTiles?.[0];
      expect(transient?.sourceScale).toBe(1);
      expect(transient?.destinationScale).toBe(0.7);
      if (transient) {
        const released = resolveTransientTile3DMotion(transient, 'release', 1);
        expect(released.tileScale).toBe(0.7);
        expect(getTileWorldBottomY(
          released.position[1],
          released.rotationX,
          released.tileScale,
        )).toBeGreaterThanOrEqual(TABLE_FELT_TOP_Y);
      }
    } finally {
      Object.assign(tuning, previous);
    }
  });

  it('wires each shared tile scale only into its intended 3D renderer', () => {
    expect(readFileSync(sourcePath('../river/River3D.tsx'), 'utf8'))
      .toContain('tileScale={TABLE_PRESENTATION_TUNING.tileScale.river}');
    expect(readFileSync(sourcePath('../hand/Hand3D.tsx'), 'utf8'))
      .toContain('tileScale={getHandTileScale(seatState.seat)}');
    expect(readFileSync(sourcePath('../meld/Meld3D.tsx'), 'utf8'))
      .toContain('tileScale={TABLE_PRESENTATION_TUNING.tileScale.meld}');
    expect(readFileSync(sourcePath('../dora/Dora3D.tsx'), 'utf8'))
      .not.toContain('tileScale=');
  });

  it('hands proxy visibility to authoritative draw and river tiles in one render-state transition', () => {
    const initial = createInitialGameState();
    const discarded = initial.players[0].hand[0];
    const discardScene = buildTableSceneState(withPlayer(initial, 0, {
      hand: initial.players[0].hand.slice(1),
      river: [discarded],
    }));
    const discardPlan = resolveTableAnimation3DPlan(
      discardEvent(0, discarded, 0, 12),
      discardScene,
      new DiscardSource3DStore(),
      'east-1',
    );
    expect(discardPlan).not.toBeNull();
    if (!discardPlan) return;

    const prepared = prepareTableAnimation3DRenderState(renderStateHarness().get(), discardPlan);
    expect(prepared.active?.phase).toBe('approach');
    expect(prepared.hiddenRiverKeys.has(discardPlan.hiddenRiverKey!)).toBe(true);
    const releasing = transitionTableAnimation3DRenderState(prepared, discardPlan, 'release');
    expect(releasing.hiddenRiverKeys.has(discardPlan.hiddenRiverKey!)).toBe(true);
    expect(resolveTableAnimation3DMotion(discardPlan, 'release', 1).tileVisible).toBe(true);
    const settled = transitionTableAnimation3DRenderState(releasing, discardPlan, 'retreat');
    expect(settled.hiddenRiverKeys.has(discardPlan.hiddenRiverKey!)).toBe(false);
    expect(resolveTableAnimation3DMotion(discardPlan, 'retreat', 0).tileVisible).toBe(false);

    const rightPlayer = initial.players[1];
    const drawPlan = resolveTableAnimation3DPlan(
      drawEvent(1, 13),
      buildTableSceneState(withPlayer(initial, 1, {
        drawnTile: rightPlayer.hand[rightPlayer.hand.length - 1],
      })),
      new DiscardSource3DStore(),
      'east-1',
    );
    expect(drawPlan).not.toBeNull();
    if (!drawPlan) return;
    const drawPrepared = prepareTableAnimation3DRenderState(renderStateHarness().get(), drawPlan);
    expect(drawPrepared.hiddenHandKeys.has(drawPlan.hiddenHandKey!)).toBe(true);
    const drawSettled = transitionTableAnimation3DRenderState(drawPrepared, drawPlan, 'retreat');
    expect(drawSettled.hiddenHandKeys.has(drawPlan.hiddenHandKey!)).toBe(false);
    expect(resolveTableAnimation3DMotion(drawPlan, 'retreat', 0).tileVisible).toBe(false);
  });

  it('keeps Skip immediate and cancels the pending discard handoff RAF', async () => {
    const initial = createInitialGameState();
    const discarded = initial.players[0].hand[0];
    const scene = buildTableSceneState(withPlayer(initial, 0, {
      hand: initial.players[0].hand.slice(1),
      river: [discarded],
    }));
    const snapshots = new DiscardSourceSnapshotStore();
    snapshots.capture({
      playerId: 0,
      tileInstanceId: discarded.instanceId,
      tile: { id: discarded.id, red: discarded.red },
      sourceTileRect: { left: 10, top: 20, width: 30, height: 40 },
      sessionKey: 'east-1',
      confirmedTurn: 9,
    });
    const pendingFrames = new Map<number, FrameRequestCallback>();
    const cancelledFrames: number[] = [];
    const barrier = new PaintCommitBarrier((callback) => {
      pendingFrames.set(1, callback);
      return 1;
    }, (handle) => {
      cancelledFrames.push(handle);
      pendingFrames.delete(handle);
    });
    const harness = renderStateHarness();
    const target = new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
      () => 9,
      () => snapshots,
      () => undefined,
      barrier,
    );
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const controller = new HandAnimationController(target, scheduler);

    expect(controller.enqueue(discardEvent(0, discarded, 0, 9))).toBe(true);
    await controller.whenIdle();
    expect(harness.get().active).toBeNull();
    expect(harness.get().hiddenRiverKeys.size).toBe(0);
    expect(barrier.pendingCount).toBe(0);
    expect(pendingFrames.size).toBe(0);
    expect(cancelledFrames).toEqual([1]);
    controller.dispose();
  });

  it('uses speed-aware 3D-only draw/discard cadence tokens', () => {
    const tile = createInitialGameState().players[0].hand[0];
    const draw = drawEvent(0, 40);
    const discard = discardEvent(0, tile, 0, 41);
    expect(getTableAnimation3DHoldMs(draw)).toBe(TABLE_ANIMATION_3D_CADENCE.drawHoldMs);
    expect(getTableAnimation3DHoldMs(discard)).toBe(TABLE_ANIMATION_3D_CADENCE.discardHoldMs);
    expect(effectiveAnimationDuration(getTableAnimation3DHoldMs(discard), 2))
      .toBe(TABLE_ANIMATION_3D_CADENCE.discardHoldMs / 2);
  });

  it('uses a seat hand-area fallback for AI discard and never the river target', () => {
    const initial = createInitialGameState();
    const player = initial.players[1];
    const discarded = player.hand[0];
    const scene = buildTableSceneState(withPlayer(initial, 1, {
      hand: player.hand.slice(1),
      river: [discarded],
    }));
    const event: TileDiscardedPresentationEvent = {
      eventId: 'ai-discard', sequence: 2, type: 'tile_discarded', playerId: 1,
      tile: { id: discarded.id, red: discarded.red }, riverIndex: 0, isRiichiDiscard: false,
    };
    const plan = resolveTableAnimation3DPlan(event, scene, new DiscardSource3DStore(), 'east-1');
    expect(plan?.seat).toBe('right');
    expect(plan?.source).not.toEqual(plan?.destination);
  });

  it('keeps opponent draw then discard events in the controller serial order', async () => {
    const initial = createInitialGameState();
    const opponent = initial.players[1];
    const discarded = opponent.hand[0];
    const scene = buildTableSceneState(withPlayer(initial, 1, {
      drawnTile: opponent.hand[opponent.hand.length - 1],
      river: [discarded],
    }));
    const sourceStore = new DiscardSource3DStore();
    let renderState: TableAnimation3DRenderState = {
      active: null,
      hiddenHandKeys: new Set(),
      hiddenRiverKeys: new Set(),
      hiddenMeldTileKeys: new Set(),
      hiddenRiichiSeats: new Set(),
    };
    const setRenderState = (update: SetStateAction<TableAnimation3DRenderState>) => {
      renderState = typeof update === 'function' ? update(renderState) : update;
    };
    const target = new TableAnimation3DTarget(() => scene, sourceStore, () => 'east-1', setRenderState);
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const settled: string[] = [];
    const controller = new HandAnimationController(target, scheduler, {
      onSettled: (action) => settled.push(action.eventId),
    });
    const draw = drawEvent(1, 7);
    const discard: TileDiscardedPresentationEvent = {
      eventId: 'discard-8',
      sequence: 8,
      type: 'tile_discarded',
      playerId: 1,
      tile: { id: discarded.id, red: discarded.red },
      riverIndex: 0,
      isRiichiDiscard: false,
    };

    expect(controller.enqueue(draw)).toBe(true);
    expect(controller.enqueue(discard)).toBe(true);
    await controller.whenIdle();

    expect(settled).toEqual([draw.eventId, discard.eventId]);
    expect(renderState.active).toBeNull();
    expect(renderState.hiddenHandKeys.size).toBe(0);
    expect(renderState.hiddenRiverKeys.size).toBe(0);
    controller.dispose();
  });

  it('holds and releases pacing across the real event bus, 3D consumer, task, and scheduler chain', async () => {
    const initial = createInitialGameState();
    const opponent = initial.players[1];
    const discarded = opponent.hand[0];
    let scene = buildTableSceneState(withPlayer(initial, 1, {
      drawnTile: opponent.hand[opponent.hand.length - 1],
    }));
    const harness = renderStateHarness();
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const gate = new PresentationPacingGate();
    const controller = new HandAnimationController(new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
    ), scheduler, {
      onSettled: (action) => gate.complete(action.eventId),
    });
    const bus = new PresentationEventBus();
    const consumer = new HandAnimationConsumer(
      controller,
      bus,
      () => true,
      () => ({ presentationEvents: true, handAnimations: true }),
      (event) => event,
      gate,
    );

    const draw = bus.publish({ type: 'tile_drawn', playerId: 1 });
    expect(gate.pendingCount).toBe(1);
    await controller.whenIdle();
    expect(gate.pendingCount).toBe(0);

    scene = buildTableSceneState(withPlayer(initial, 1, {
      hand: opponent.hand.slice(1),
      drawnTile: null,
      river: [discarded],
    }));
    const discard = bus.publish({
      type: 'tile_discarded',
      playerId: 1,
      tile: { id: discarded.id, red: discarded.red },
      riverIndex: 0,
      isRiichiDiscard: false,
    });
    expect(discard.sequence).toBeGreaterThan(draw.sequence);
    expect(gate.pendingCount).toBe(1);
    await controller.whenIdle();
    expect(gate.pendingCount).toBe(0);
    expect(harness.get().active).toBeNull();

    consumer.dispose();
    controller.dispose();
  });

  it('reveals the authoritative river tile after normal completion and skip', async () => {
    const initial = createInitialGameState();
    const discarded = initial.players[0].hand[0];
    const scene = buildTableSceneState(withPlayer(initial, 0, {
      hand: initial.players[0].hand.slice(1),
      river: [discarded],
    }));
    const event = discardEvent(0, discarded, 0, 20);

    for (const skip of [false, true]) {
      const harness = renderStateHarness();
      const target = new TableAnimation3DTarget(
        () => scene,
        new DiscardSource3DStore(),
        () => 'east-1',
        harness.setRenderState,
      );
      const scheduler = new AnimationScheduler();
      scheduler.setSkip(skip);
      if (!skip) scheduler.setSpeed(1000);
      const controller = new HandAnimationController(target, scheduler);

      expect(controller.enqueue({ ...event, eventId: `${event.eventId}-${skip ? 'skip' : 'complete'}` })).toBe(true);
      expect(harness.get().hiddenRiverKeys.size).toBe(1);
      await controller.whenIdle();

      expect(harness.get().active).toBeNull();
      expect(harness.get().hiddenRiverKeys.size).toBe(0);
      controller.dispose();
    }
  });

  it('clears a discard mask on cancel/unmount and never re-hides the previous river tile', async () => {
    const initial = createInitialGameState();
    const first = initial.players[0].hand[0];
    const second = initial.players[0].hand[1];
    let scene = buildTableSceneState(withPlayer(initial, 0, {
      hand: initial.players[0].hand.slice(1),
      river: [first],
    }));
    const harness = renderStateHarness();
    const target = new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
    );
    const scheduler = new AnimationScheduler();
    const controller = new HandAnimationController(target, scheduler);
    const firstEvent = discardEvent(0, first, 0, 30);

    expect(controller.enqueue(firstEvent)).toBe(true);
    expect(harness.get().hiddenRiverKeys.size).toBe(1);
    controller.cancelAll();
    await controller.whenIdle();
    expect(harness.get().hiddenRiverKeys.size).toBe(0);

    scene = buildTableSceneState(withPlayer(initial, 0, {
      hand: initial.players[0].hand.slice(2),
      river: [first, second],
    }));
    const secondEvent = discardEvent(0, second, 1, 31);
    expect(target.beforeEnqueue(secondEvent)).toBe(true);
    expect(harness.get().hiddenRiverKeys.has(`river-0-${second.instanceId}`)).toBe(false);
    expect(target.prepare(secondEvent)).toBe(true);
    const hidden = harness.get().hiddenRiverKeys;
    expect(hidden.has(`river-0-${first.instanceId}`)).toBe(false);
    expect(hidden.has(`river-0-${second.instanceId}`)).toBe(true);
    target.clear();
    expect(harness.get().active).toBeNull();
    expect(harness.get().hiddenRiverKeys.size).toBe(0);
    controller.dispose();
  });

  it('dedupes events and restores masks after skip and cancel', async () => {
    const initial = createInitialGameState();
    const opponent = initial.players[1];
    const scene = buildTableSceneState(withPlayer(initial, 1, {
      drawnTile: opponent.hand[opponent.hand.length - 1],
    }));
    const sourceStore = new DiscardSource3DStore();
    let renderState: TableAnimation3DRenderState = {
      active: null,
      hiddenHandKeys: new Set(),
      hiddenRiverKeys: new Set(),
      hiddenMeldTileKeys: new Set(),
      hiddenRiichiSeats: new Set(),
    };
    const setRenderState = (update: SetStateAction<TableAnimation3DRenderState>) => {
      renderState = typeof update === 'function' ? update(renderState) : update;
    };
    const target = new TableAnimation3DTarget(() => scene, sourceStore, () => 'east-1', setRenderState);
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const settled: string[] = [];
    const controller = new HandAnimationController(target, scheduler, {
      onSettled: (action) => settled.push(action.eventId),
    });
    const event = drawEvent(1, 1);
    expect(controller.enqueue(event)).toBe(true);
    expect(controller.enqueue(event)).toBe(false);
    await controller.whenIdle();
    expect(settled).toEqual([event.eventId, event.eventId]);
    expect(renderState.active).toBeNull();
    expect(renderState.hiddenHandKeys.size).toBe(0);

    const second = drawEvent(1, 2);
    scheduler.setSkip(false);
    expect(controller.enqueue(second)).toBe(true);
    controller.cancelAll();
    await controller.whenIdle();
    expect(renderState.active).toBeNull();
    expect(renderState.hiddenHandKeys.size).toBe(0);
    expect(renderState.hiddenRiverKeys.size).toBe(0);
    controller.dispose();
  });

  it('keeps Draw/Discard/Meld/Riichi targets on their shared shifted authorities', () => {
    const tuning = TABLE_PRESENTATION_TUNING as unknown as {
      lowerTableContentOffsetZ: number;
    };
    const previousOffset = tuning.lowerTableContentOffsetZ;
    let drawState = createInitialGameState();
    ([1, 2] as PlayerId[]).forEach((playerId) => {
      const player = drawState.players[playerId];
      drawState = withPlayer(drawState, playerId, {
        drawnTile: player.hand[player.hand.length - 1],
      });
    });
    const discarded = drawState.players[0].hand[0];
    const discardScene = buildTableSceneState(withPlayer(drawState, 0, {
      hand: drawState.players[0].hand.slice(1),
      river: [discarded],
    }));
    const drawScene = buildTableSceneState(drawState);
    const meldScene = withBottomMeld(buildTableSceneState(drawState), 'pon');
    const meldAction: MeldDeclaredPresentationEvent = {
      eventId: 'meld-offset', sequence: 10, type: 'meld_declared', playerId: 0,
      meldType: 'pon',
    };
    const riichiAction: RiichiDeclaredPresentationEvent = {
      eventId: 'riichi-offset', sequence: 11, type: 'riichi_declared', playerId: 0,
      riverIndex: 0,
    };
    const resolveTargets = () => ({
      rightDraw: resolveTableAnimation3DPlan(
        drawEvent(1, 8), drawScene, new DiscardSource3DStore(), 'east-1',
      ),
      topDraw: resolveTableAnimation3DPlan(
        drawEvent(2, 9), drawScene, new DiscardSource3DStore(), 'east-1',
      ),
      discard: resolveTableAnimation3DPlan(
        discardEvent(0, discarded, 0, 7), discardScene, new DiscardSource3DStore(), 'east-1',
      ),
      meld: resolveTableAnimation3DPlan(
        meldAction, meldScene, new DiscardSource3DStore(), 'east-1',
      ),
      riichi: resolveTableAnimation3DPlan(
        riichiAction, discardScene, new DiscardSource3DStore(), 'east-1',
      ),
    });
    try {
      tuning.lowerTableContentOffsetZ = 0;
      const baseline = resolveTargets();
      tuning.lowerTableContentOffsetZ = 2;
      const shifted = resolveTargets();

      expect(shifted.rightDraw!.destination[2] - baseline.rightDraw!.destination[2]).toBe(2);
      expect(shifted.topDraw!.destination).toEqual(baseline.topDraw!.destination);
      expect(shifted.discard!.destination[2] - baseline.discard!.destination[2]).toBe(2);
      expect(shifted.meld!.destination[2] - baseline.meld!.destination[2]).toBe(2);
      expect(shifted.riichi!.destination[2] - baseline.riichi!.destination[2]).toBeCloseTo(2);
    } finally {
      tuning.lowerTableContentOffsetZ = previousOffset;
    }
  });
});

describe('UI-5E.2 3D riichi/meld plans', () => {
  it('settles Meld proxies on the same seat-offset authority as the static Meld', () => {
    const tuning = TABLE_PRESENTATION_TUNING as unknown as {
      meldSeatOffsets: Record<Table3DSeat, { inline: number; radial: number }>;
    };
    const previous = { ...tuning.meldSeatOffsets.bottom };
    const scene = withBottomMeld(buildTableSceneState(createInitialGameState()), 'pon');
    const action: MeldDeclaredPresentationEvent = {
      eventId: 'meld-seat-offset', sequence: 1, type: 'meld_declared', playerId: 0,
      meldType: 'pon',
    };
    try {
      tuning.meldSeatOffsets.bottom.inline = 0;
      tuning.meldSeatOffsets.bottom.radial = 0;
      const baseline = resolveTableAnimation3DPlan(
        action, scene, new DiscardSource3DStore(), 'east-1',
      )!;

      tuning.meldSeatOffsets.bottom.inline = 1.25;
      tuning.meldSeatOffsets.bottom.radial = 0.75;
      const shifted = resolveTableAnimation3DPlan(
        action, scene, new DiscardSource3DStore(), 'east-1',
      )!;
      const authoritative = getMeldTileTransforms('bottom', scene.seats.bottom.melds)[0];

      expect(shifted.transientTiles?.map((tile) => tile.destination))
        .toEqual(authoritative.map((transform) => transform.position));
      expect(shifted.transientTiles?.map((tile) => tile.source))
        .toEqual(baseline.transientTiles?.map((tile) => tile.source));
      expect(shifted.destination[0] - baseline.destination[0]).toBeCloseTo(1.25);
      expect(shifted.destination[2] - baseline.destination[2]).toBeCloseTo(0.75);
    } finally {
      tuning.meldSeatOffsets.bottom.inline = previous.inline;
      tuning.meldSeatOffsets.bottom.radial = previous.radial;
    }
  });

  it('uses one seat-local riichi stick plan for all four seats and atomically reveals authority', () => {
    const base = buildTableSceneState(createInitialGameState());
    const scene: TableSceneState = {
      ...base,
      seats: Object.fromEntries(Object.entries(base.seats).map(([seat, state]) => [
        seat,
        { ...state, riichi: true },
      ])) as TableSceneState['seats'],
    };
    ([0, 1, 2, 3] as PlayerId[]).forEach((playerId, index) => {
      const action: RiichiDeclaredPresentationEvent = {
        eventId: `riichi-${playerId}`,
        sequence: index + 1,
        type: 'riichi_declared',
        playerId,
        riverIndex: 0,
      };
      const plan = resolveTableAnimation3DPlan(action, scene, new DiscardSource3DStore(), 'east-1');
      expect(plan?.seat).toBe((['bottom', 'right', 'top', 'left'] as const)[index]);
      expect(plan?.stickProxy).toBeDefined();
      expect(plan?.source).not.toEqual(plan?.destination);
      if (!plan) return;
      const prepared = prepareTableAnimation3DRenderState(renderStateHarness().get(), plan);
      expect(prepared.hiddenRiichiSeats.has(plan.seat)).toBe(true);
      const settled = transitionTableAnimation3DRenderState(prepared, plan, 'retreat');
      expect(settled.hiddenRiichiSeats.has(plan.seat)).toBe(false);
    });
  });

  it.each([
    ['chi', undefined, 3],
    ['pon', undefined, 3],
    ['kan', 'ankan', 4],
    ['kan', 'minkan', 4],
  ] as const)('maps %s/%s to authoritative tile order and the shared meld lane', (meldType, kanType, count) => {
    const callType = (kanType ?? meldType) as MeldSceneState['callType'];
    const scene = withBottomMeld(buildTableSceneState(createInitialGameState()), callType);
    const action: MeldDeclaredPresentationEvent = {
      eventId: `meld-${callType}`,
      sequence: 1,
      type: 'meld_declared',
      playerId: 0,
      meldType,
      kanType,
    };
    const plan = resolveTableAnimation3DPlan(action, scene, new DiscardSource3DStore(), 'east-1');
    const authoritative = scene.seats.bottom.melds[0].tiles;
    expect(plan?.transientTiles?.map((tile) => tile.key)).toEqual(authoritative.map((tile) => tile.key));
    expect(plan?.transientTiles).toHaveLength(count);
    expect(plan?.transientTiles?.[1].orientation).toBe('sideways');
    expect(plan?.hiddenMeldTileKeys).toEqual(authoritative.map((tile) => tile.key));
  });

  it('animates only the added kakan tile so the existing Pon remains mounted', () => {
    const scene = withBottomMeld(buildTableSceneState(createInitialGameState()), 'kakan');
    const action: MeldDeclaredPresentationEvent = {
      eventId: 'meld-kakan', sequence: 2, type: 'meld_declared', playerId: 0,
      meldType: 'kan', kanType: 'kakan',
    };
    const plan = resolveTableAnimation3DPlan(action, scene, new DiscardSource3DStore(), 'east-1');
    expect(plan?.transientTiles).toHaveLength(1);
    expect(plan?.hiddenMeldTileKeys).toEqual(['kakan-3']);
    expect(plan?.hiddenMeldTileKeys).not.toContain('kakan-0');
  });

  it('keeps Discard → Riichi → Kan → bottom DOM rinshan Draw serialized', async () => {
    const initial = createInitialGameState();
    const discarded = initial.players[0].hand[0];
    let scene = buildTableSceneState(withPlayer(initial, 0, { river: [discarded], riichi: true }));
    scene = withBottomMeld(scene, 'minkan');
    const harness = renderStateHarness();
    const target = new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
    );
    const scheduler = new AnimationScheduler();
    scheduler.setSkip(true);
    const settled: string[] = [];
    const controller = new HandAnimationController(target, scheduler, {
      onSettled: (action) => settled.push(action.eventId),
    });
    const actions = [
      discardEvent(0, discarded, 0, 10),
      { eventId: 'riichi-11', sequence: 11, type: 'riichi_declared', playerId: 0, riverIndex: 0 } as const,
      { eventId: 'kan-12', sequence: 12, type: 'meld_declared', playerId: 0, meldType: 'kan', kanType: 'minkan' } as const,
      drawEvent(0, 13),
    ];
    expect(actions.map((action) => controller.enqueue(action))).toEqual([true, true, true, true]);
    await controller.whenIdle();
    expect(settled).toEqual(actions.map((action) => action.eventId));
    expect(harness.get().active).toBeNull();
    expect(harness.get().hiddenMeldTileKeys.size).toBe(0);
    expect(harness.get().hiddenRiichiSeats.size).toBe(0);
    controller.dispose();
  });

  it('cleans riichi/meld masks on cancel and keeps speed-aware holds', async () => {
    const initial = createInitialGameState();
    let scene = buildTableSceneState(withPlayer(initial, 0, { riichi: true }));
    scene = withBottomMeld(scene, 'kakan');
    const harness = renderStateHarness();
    const target = new TableAnimation3DTarget(
      () => scene,
      new DiscardSource3DStore(),
      () => 'east-1',
      harness.setRenderState,
    );
    const scheduler = new AnimationScheduler();
    const controller = new HandAnimationController(target, scheduler);
    const riichi = {
      eventId: 'riichi-cancel', sequence: 20, type: 'riichi_declared', playerId: 0, riverIndex: 0,
    } as const;
    expect(controller.enqueue(riichi)).toBe(true);
    expect(harness.get().hiddenRiichiSeats.has('bottom')).toBe(true);
    controller.cancelAll();
    await controller.whenIdle();
    expect(harness.get().hiddenRiichiSeats.size).toBe(0);

    const kakan = {
      eventId: 'kakan-cancel', sequence: 21, type: 'meld_declared', playerId: 0,
      meldType: 'kan', kanType: 'kakan',
    } as const;
    expect(controller.enqueue(kakan)).toBe(true);
    expect(harness.get().hiddenMeldTileKeys).toEqual(new Set(['kakan-3']));
    controller.cancelAll();
    await controller.whenIdle();
    expect(harness.get().hiddenMeldTileKeys.size).toBe(0);
    expect(getTableAnimation3DHoldMs(riichi)).toBe(TABLE_ANIMATION_3D_CADENCE.riichiHoldMs);
    expect(getTableAnimation3DHoldMs(kakan)).toBe(TABLE_ANIMATION_3D_CADENCE.kanHoldMs);
    expect(effectiveAnimationDuration(getTableAnimation3DHoldMs(kakan), 2))
      .toBe(TABLE_ANIMATION_3D_CADENCE.kanHoldMs / 2);
    controller.dispose();
  });
});
