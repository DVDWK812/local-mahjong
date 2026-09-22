import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SetStateAction } from 'react';
import { createInitialGameState } from '../../game/engine';
import { createTile } from '../../game/tileUtils';
import type { PlayerId } from '../../game/types';
import { GamePresentationEventObserver } from '../../presentation/gamePresentationEvents';
import { PresentationEventBus, type TileDiscardedPresentationEvent } from '../../presentation/PresentationEventBus';
import { createHandPresentationSnapshot, deterministicDiscardSlot, freezeHandDiscardHistory, handPresentationPhases, resolveHandPresentationSlots, type HandPresentationFrame } from '../../presentation/handAnimation/HandPresentationSnapshot';
import { AnimationScheduler } from '../../presentation/animation/AnimationScheduler';
import { HandAnimationController } from '../../presentation/handAnimation/HandAnimationController';
import { LocalHandSnapshot, LocalDiscardProxy } from '../../components/game/LocalHandSnapshot';
import { buildTableSceneState } from '../sceneState/buildTableSceneState';
import { getHandTileTransform } from '../coordinates/sceneTransforms';
import { resolveHandSnapshotLayout } from '../hand/handSnapshotLayout';
import { DiscardSource3DStore } from './DiscardSource3D';
import { TableAnimation3DTarget, type TableAnimation3DRenderState } from './useTableAnimation3D';
import { resolveTableAnimation3DMotion } from './tableAnimation3D';
import { discardHandLifecycle, resolveSnapshotDiscardMotion } from './discardHandLifecycle';
import { localHandContact } from '../../components/game/LocalAnimationHand';

function fixture(playerId: PlayerId, tsumogiri: boolean, sequence = 1, drawn = true) {
  const hand = Array.from({ length: 14 }, (_, i) => createTile((i % 9) as 0, i));
  const drawnTile = drawn ? hand[13] : null;
  const discardedTile = hand[tsumogiri ? 13 : 4];
  const finalHand = hand.filter((tile) => tile !== discardedTile);
  const event: TileDiscardedPresentationEvent = {
    type: 'tile_discarded', playerId, sequence, eventId: `snapshot-${playerId}-${sequence}`,
    tile: discardedTile, riverIndex: 0, isRiichiDiscard: false,
    handHistory: freezeHandDiscardHistory({ preDiscardHand: hand, drawnTile, discardedTile, finalHand, isTsumogiri: tsumogiri }),
  };
  const initial = createInitialGameState();
  const scene = buildTableSceneState({ ...initial, players: initial.players.map((player) => player.id === playerId
    ? { ...player, hand: finalHand, drawnTile: null, river: [discardedTile] } : player) });
  let state: TableAnimation3DRenderState = { active: null, hiddenHandKeys: new Set(), hiddenRiverKeys: new Set(), hiddenMeldTileKeys: new Set(), hiddenRiichiSeats: new Set() };
  const frames: HandPresentationFrame[] = [];
  const target = new TableAnimation3DTarget(() => scene, new DiscardSource3DStore(), () => 'session', (update: SetStateAction<TableAnimation3DRenderState>) => {
    state = typeof update === 'function' ? update(state) : update;
    if (state.active?.handPresentation) frames.push(state.active.handPresentation);
  });
  return { event, scene, target, frames, get: () => state };
}

afterEach(() => { vi.useRealTimers(); });

describe('UI-6A phase-level hand snapshot', () => {
  for (const playerId of [0, 1, 2, 3] as const) for (const tsumogiri of [false, true]) {
    it(`seat ${playerId}: ${tsumogiri ? 'tsumogiri' : 'tedashi'} keeps the gap through river settle and hands off once`, async () => {
      const f = fixture(playerId, tsumogiri);
      expect(f.target.beforeEnqueue(f.event)).toBe(true);
      await f.target.prepare(f.event);
      const plan = f.get().active!.plan;
      const snapshot = plan.handSnapshot!;
      for (const phase of ['lift', 'carry', 'river-settle'] as const) {
        const frame = { snapshot, phase, progress: 0.7 };
        const motion = resolveSnapshotDiscardMotion(plan, frame);
        expect(motion.handVisible).toBe(true);
        expect(motion.handPosition).toEqual(motion.tilePosition);
      }
      expect(discardHandLifecycle({ snapshot, phase: 'complete', progress: 1 }).visible).toBe(false);
      const retractPhase = tsumogiri ? 'complete' : 'gap-hold';
      expect(discardHandLifecycle({ snapshot, phase: retractPhase, progress: 0.5 }).retract).toBe(0.5);
      const carryEnd = resolveTableAnimation3DMotion(plan, 'travel', 1);
      const settleStart = resolveTableAnimation3DMotion(plan, 'release', 0);
      settleStart.tilePosition.forEach((value, axis) => expect(value).toBeCloseTo(carryEnd.tilePosition[axis], 10));
      expect(settleStart.tileRotationX).toBe(carryEnd.tileRotationX);
      expect(settleStart.tileScale).toBe(carryEnd.tileScale);
      expect(snapshot.discardVisualSlot).toBe(tsumogiri ? 13 : playerId === 0 ? 4 : deterministicDiscardSlot(f.event.eventId, playerId, 13));
      expect(snapshot.visualHand[snapshot.discardVisualSlot].instanceId).toBe(f.event.handHistory!.discardedTile.instanceId);
      const seat = f.scene.seats[plan.seat];
      const tasks = f.target.animationTasks(f.event)!;
      const phases = handPresentationPhases(snapshot);
      let settled = false;
      tasks.forEach((task, index) => {
        task.snapToEnd();
        const frame = f.get().active!.handPresentation!;
        expect(frame.phase).toBe(phases[index].phase);
        const slots = resolveHandPresentationSlots(frame);
        expect(slots.filter((entry) => entry.hidden)).toHaveLength(1);
        expect(new Set(slots.filter((entry) => !entry.hidden).map((entry) => entry.tile.instanceId)).size).toBe(13);
        if (['lift', 'carry', 'river-settle', 'gap-hold'].includes(frame.phase)) {
          slots.forEach((entry) => expect(entry.slot).toBe(entry.index));
          expect(slots[13].drawnGap).toBe(1);
        }
        if (frame.phase === 'river-settle') {
          expect(f.get().hiddenRiverKeys.has(plan.hiddenRiverKey!)).toBe(true);
          settled = true;
        }
        if (['gap-hold', 'insert', 'reorder', 'complete'].includes(frame.phase)) {
          expect(settled).toBe(true);
          expect(f.get().hiddenRiverKeys.size).toBe(0);
        }
        if (frame.phase === 'insert') {
          expect(slots[13].slot).toBe(snapshot.discardVisualSlot);
          expect(slots[13].drawnGap).toBe(0);
        }
        if (frame.phase === 'complete') {
          const positions = resolveHandSnapshotLayout(seat, frame).filter((entry) => !entry.hidden);
          positions.forEach((entry) => expect(entry.transform.position).toEqual(getHandTileTransform(plan.seat, entry.finalIndex, 13, false).position));
        }
        if (tsumogiri) expect(frame.phase === 'insert' || frame.phase === 'reorder').toBe(false);
      });
      f.target.finish(f.event);
      expect(f.get().active).toBeNull();
      expect(f.get().hiddenRiverKeys.size).toBe(0);
    });
  }

  it('deterministic concealed slots never select the drawn slot; repeated tile types preserve exact local identity', () => {
    for (let i = 0; i < 100; i++) {
      const f = fixture(2, false, i);
      const a = createHandPresentationSnapshot(f.event, false)!;
      expect(a.discardVisualSlot).toBe(createHandPresentationSnapshot(f.event, false)!.discardVisualSlot);
      expect(a.discardVisualSlot).toBeLessThan(13);
    }
    expect(createHandPresentationSnapshot(fixture(0, false).event, true)!.discardVisualSlot).toBe(4);
  });

  it('DOM and 3D consumers retain the same gap; DOM proxy vanishes only when river takes ownership', () => {
    const snapshot = createHandPresentationSnapshot(fixture(0, false).event, true)!;
    const motion = { source: { left: 0, top: 0, width: 40, height: 60 }, destination: { left: 100, top: 100, width: 20, height: 30 } };
    for (const { phase } of handPresentationPhases(snapshot)) {
      const frame = { snapshot, phase, progress: 0.5 };
      const html = renderToStaticMarkup(<LocalHandSnapshot frame={frame} concealed={false} doraIndicators={[]} doraGlowEnabled={false} doraSweepEnabled={false} />);
      expect(html.match(/data-hand-gap="true"/g)).toHaveLength(1);
      expect(html).toContain('visibility:hidden');
      expect(html).not.toContain('<button');
      const proxy = renderToStaticMarkup(<LocalDiscardProxy frame={frame} motion={motion} />);
      expect(proxy.length > 0).toBe(['lift', 'carry', 'river-settle'].includes(phase));
    }
  });

  it('presentation observer freezes pre-discard history before authoritative compaction', () => {
    const initial = createInitialGameState();
    const player = initial.players[0];
    const tile = player.hand[4];
    const bus = new PresentationEventBus();
    const events: TileDiscardedPresentationEvent[] = [];
    bus.subscribe((event) => { if (event.type === 'tile_discarded') events.push(event); });
    const observer = new GamePresentationEventObserver(initial, bus, () => ({ presentationEvents: true, handAnimations: true }));
    const final = { ...initial, players: initial.players.map((p) => p.id === 0 ? { ...p, hand: p.hand.filter((t) => t.instanceId !== tile.instanceId), drawnTile: null, river: [{ ...tile, isTsumogiri: false }] } : p) };
    observer.observe(final);
    expect(events[0].handHistory!.preDiscardHand).toEqual(player.hand);
    expect(events[0].handHistory!.finalHand).toEqual(final.players[0].hand);
    expect(Object.isFrozen(events[0].handHistory!.preDiscardHand[0])).toBe(true);
    observer.observe(final);
    expect(events).toHaveLength(1);
  });

  for (const mode of ['skip', 'cancel', 'speed', 'dispose'] as const) {
    it(`${mode} during carry clears snapshot, masks, proxy and pending scheduler work`, async () => {
      vi.useFakeTimers();
      const f = fixture(0, false);
      const scheduler = new AnimationScheduler();
      const controller = new HandAnimationController(f.target, scheduler, { snapOnPlaybackChange: true });
      controller.enqueue(f.event);
      await vi.advanceTimersByTimeAsync(160);
      expect(f.get().active!.handPresentation!.phase).toBe('carry');
      if (mode === 'skip') controller.setSkip(true);
      else if (mode === 'speed') controller.setSpeed(4);
      else if (mode === 'dispose') controller.dispose();
      else controller.cancelAll();
      expect(f.get().active).toBeNull();
      await controller.whenIdle();
      expect(scheduler.activeRunCount).toBe(0);
      expect(f.get().hiddenRiverKeys.size).toBe(0);
      controller.dispose();
    });
  }

  it('fast mode and consecutive auto turns serialize, release and do not revive old snapshots', async () => {
    vi.useFakeTimers();
    const f = fixture(1, false);
    const scheduler = new AnimationScheduler();
    scheduler.setSpeed(4);
    const settled: string[] = [];
    const controller = new HandAnimationController(f.target, scheduler, { onSettled: (event) => settled.push(event.eventId) });
    const next = { ...f.event, eventId: 'next-auto', sequence: 2 };
    controller.enqueue(f.event);
    controller.enqueue(next);
    await vi.advanceTimersByTimeAsync(100);
    expect(f.get().active!.handPresentation!.phase).toBe('river-settle');
    await vi.runAllTimersAsync();
    await controller.whenIdle();
    expect(settled).toEqual([f.event.eventId, next.eventId]);
    expect(f.get().active).toBeNull();
    expect(scheduler.pendingTaskCount).toBe(0);
    controller.dispose();
  });

  it('cancel during asynchronous prepare cannot start a later ghost animation', async () => {
    let resolve!: (value: boolean) => void;
    const phase = vi.fn();
    const controller = new HandAnimationController({ prepare: () => new Promise((r) => { resolve = r; }), setPhase: phase, finish: vi.fn(), clear: vi.fn() });
    controller.enqueue(fixture(0, false).event);
    controller.cancelAll();
    resolve(true);
    await controller.whenIdle();
    expect(phase).not.toHaveBeenCalled();
  });

  it('local contact follows measured tile position and size at either viewport and after responsive movement', () => {
    for (const rect of [{ left: 980, top: 630, width: 44, height: 62 }, { left: 1420, top: 970, width: 56, height: 79 }]) {
      const point = localHandContact(rect);
      expect(point.x).toBe(rect.left + rect.width / 2);
      expect(point.y).toBe(rect.top + rect.height / 2);
      expect(localHandContact({ ...rect, left: rect.left - 100 }).x).toBe(point.x - 100);
      expect(point.width).toBe(rect.width * 1.9);
    }
  });
});
