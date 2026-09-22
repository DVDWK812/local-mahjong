import { afterEach, expect, it, vi } from 'vitest';
import { getBuiltInTestScenario } from '../game/testMode/builtInScenarios';
import { loadTestScenarioState } from '../game/testMode/scenario';
import { applyOfficialTestModeAction } from '../game/testMode/actions';
import { GamePresentationEventObserver } from './gamePresentationEvents';
import { PresentationEventBus, type PresentationEvent } from './PresentationEventBus';
import { buildTableSceneState } from '../presentation3d/sceneState/buildTableSceneState';
import { TableAnimation3DTarget, type TableAnimation3DRenderState } from '../presentation3d/animation/useTableAnimation3D';
import { DiscardSource3DStore } from '../presentation3d/animation/DiscardSource3D';
import { resolveTableAnimation3DPlan, resolveTableAnimation3DMotion } from '../presentation3d/animation/tableAnimation3D';
import { PresentationPacingGate } from './pacing/PresentationPacingGate';
import { AnimationScheduler } from './animation/AnimationScheduler';
import { RON_REVEAL_HOLD_MS, WinPresentationController } from './winAnimation/WinPresentationController';
import { presentationAudioCues } from './PresentationAudioCue';
import { returnToDrawnRect } from '../components/game/LocalAnimationHand';
import { getRiichiStickTransform } from '../presentation3d/riichi/RiichiStick3D';
import { createSeventeenPresentationFixture } from '../dev/seventeenPresentationFixtures';
import { declareSeventeenStepsRon, toSeventeenStepsGameState } from '../game/seventeenSteps';
import { winnerPresentationHands } from './winAnimation/winnerPresentationHands';
import { winningTileSlapTransform } from '../presentation3d/win/winPresentation3D';
import { getGroundedTileCenterY } from '../presentation3d/tile/tileGrounding';
import { getHandTileScale } from '../presentation3d/table/tablePresentationTuning';
import { resolveLocalHandSlots } from '../components/game/LocalHandSnapshot';
import { createHandPresentationSnapshot } from './handAnimation/HandPresentationSnapshot';
import { createFourGateFixture, gateAction } from '../dev/finalGate/scenarios';
import { WinPresentationConsumer } from './winAnimation/WinPresentationConsumer';
import { AudioPresentationConsumer } from '../audio/AudioPresentationConsumer';
import { EventOverlayController, type EventOverlayAction } from './eventOverlay/EventOverlayController';
import { EventOverlayConsumer } from './eventOverlay/EventOverlayConsumer';

afterEach(() => vi.useRealTimers());

it('local insertion retains the drawn source until grab, then goes directly to final slot without a second sweep', () => {
  const before = createFourGateFixture('AV-04');
  const after = applyOfficialTestModeAction(before, gateAction('AV-04', before));
  const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
  bus.subscribe(e => events.push(e)); new GamePresentationEventObserver(before, bus).observe(after);
  const event = events.find(e => e.type === 'tile_discarded')!;
  const snapshot = createHandPresentationSnapshot(event, true)!;
  const slots = (phase: 'gap-hold' | 'insert' | 'reorder', progress: number) => resolveLocalHandSlots({ snapshot, phase, progress });
  const drawnIndex = snapshot.visualHand.length - 1;
  expect(slots('gap-hold', 1)[drawnIndex].drawnGap).toBe(1);
  expect(slots('insert', 0.2)[drawnIndex].slot).toBe(drawnIndex);
  slots('insert', 0.5).filter(e => e.index !== drawnIndex && !e.hidden).forEach(e => expect(e.slot).toBe(e.index));
  const inserted = slots('insert', 1)[drawnIndex];
  expect(inserted.slot).toBe(inserted.finalIndex);
  expect(inserted.slot).not.toBe(snapshot.discardVisualSlot);
  expect(slots('reorder', 0)[drawnIndex]).toEqual(inserted);
  expect(slots('reorder', 1)[drawnIndex]).toEqual(inserted);
});

it('17-step official Ron feeds shared overlay, win controller and the production audio consumer once', async () => {
  vi.useFakeTimers();
  const initial = createSeventeenPresentationFixture('ron');
  const bus = new PresentationEventBus(); const gate = new PresentationPacingGate();
  const playSfx = vi.fn(); const audio = new AudioPresentationConsumer({ playSfx });
  const win = new WinPresentationController({ prepare: () => true, setPhase: () => {}, finish: () => {}, clear: () => {} },
    new AnimationScheduler(), gate, { onSettled: e => gate.complete(e.eventId) });
  const overlayPrepare = vi.fn((_action: EventOverlayAction) => true);
  const overlay = new EventOverlayController({ prepare: overlayPrepare, setPhase: () => {}, finish: () => {}, clear: () => {} },
    new AnimationScheduler(), gate, { onSettled: e => gate.complete(e.eventId) });
  const wins = new WinPresentationConsumer(bus, win, gate); wins.start();
  const overlays = new EventOverlayConsumer(overlay, gate, bus); overlays.start();
  const observer = new GamePresentationEventObserver(toSeventeenStepsGameState(initial), bus);
  const ended = toSeventeenStepsGameState(declareSeventeenStepsRon(initial, 0));
  observer.observe(ended); observer.observe(ended);
  await vi.advanceTimersByTimeAsync(500);
  expect(overlayPrepare).toHaveBeenCalledOnce();
  expect(overlayPrepare.mock.calls[0][0]).toMatchObject({ type: 'win_declared', winType: 'ron' });
  expect(playSfx).toHaveBeenCalledOnce(); expect(playSfx).toHaveBeenCalledWith('rong');
  expect(gate.pendingCount).toBeGreaterThan(0);
  await vi.runAllTimersAsync(); await win.whenIdle(); await overlay.whenIdle();
  expect(gate.pendingCount).toBe(0); expect(playSfx).toHaveBeenCalledOnce();
  wins.dispose(); overlays.dispose(); win.dispose(); overlay.dispose(); audio.dispose();
});

it.each(['skip', 'cancel'] as const)('Ron %s during the long hold releases pacing without replaying rong', async mode => {
  vi.useFakeTimers();
  const bus = new PresentationEventBus(); const event = bus.publish({ type: 'win_declared', playerId: 1, winType: 'ron' });
  if (event.type !== 'win_declared') throw Error('fixture');
  const gate = new PresentationPacingGate(); gate.begin(event);
  const sound = vi.fn(); const disconnect = presentationAudioCues.connect(sound);
  const controller = new WinPresentationController({ prepare: () => true, setPhase: () => {}, finish: () => {}, clear: () => {} },
    new AnimationScheduler(), gate, { onSettled: e => gate.complete(e.eventId) });
  controller.enqueue(event); await vi.advanceTimersByTimeAsync(500);
  if (mode === 'skip') controller.setSkip(true); else controller.cancelAll();
  await vi.runAllTimersAsync(); await controller.whenIdle();
  expect(gate.pendingCount).toBe(0); expect(sound).toHaveBeenCalledOnce();
  controller.dispose(); disconnect();
});

it('multi-Ron retains sequential winner holds without the former 2.5-second pacing timeout', async () => {
  vi.useFakeTimers();
  const bus = new PresentationEventBus(); const gate = new PresentationPacingGate(); const prepared: number[] = [];
  const controller = new WinPresentationController({ prepare: e => { prepared.push(e.playerId); return true; }, setPhase: () => {}, finish: () => {}, clear: () => {} },
    new AnimationScheduler(), gate, { onSettled: e => gate.complete(e.eventId) });
  const consumer = new WinPresentationConsumer(bus, controller, gate); consumer.start();
  bus.publish({ type: 'win_declared', playerId: 1, winType: 'ron' });
  bus.publish({ type: 'win_declared', playerId: 2, winType: 'ron' });
  await vi.advanceTimersByTimeAsync(RON_REVEAL_HOLD_MS);
  expect(prepared).toEqual([1]); expect(gate.pendingCount).toBe(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(prepared).toEqual([1, 2]); expect(gate.pendingCount).toBe(1);
  await vi.runAllTimersAsync(); await controller.whenIdle();
  expect(gate.pendingCount).toBe(0); consumer.dispose(); controller.dispose();
});

it('cancelled asynchronous overlay preparation cannot resurrect a draw overlay', async () => {
  let resolvePrepare!: (value: boolean) => void;
  const prepared = new Promise<boolean>(resolve => { resolvePrepare = resolve; });
  const gate = new PresentationPacingGate(); const phase = vi.fn();
  const event = { type: 'round_end_announced' as const, eventId: 'cancel-draw-prepare', sequence: 1, settlementType: 'exhaustive-draw' as const };
  gate.begin(event);
  const controller = new EventOverlayController({ prepare: () => prepared, setPhase: phase, finish: () => {}, clear: () => {} },
    new AnimationScheduler(), gate, { onSettled: e => gate.complete(e.eventId) });
  controller.enqueue(event); await Promise.resolve(); controller.cancelAll(); resolvePrepare(true); await controller.whenIdle();
  expect(phase).not.toHaveBeenCalled(); expect(gate.pendingCount).toBe(0); controller.dispose();
});

it.each(['ankan', 'minkan'] as const)('%s reserves replacement draw ownership before its prepare, using official action', async kanType => {
  const before = loadTestScenarioState(getBuiltInTestScenario(`STAB-001-${kanType.toUpperCase()}`)!);
  const after = applyOfficialTestModeAction(before, { type: 'kan', playerId: 0, kanType, tileId: kanType === 'ankan' ? 0 : 5 });
  expect(after.players[0].drawnTile).not.toBeNull();
  const finalState = JSON.stringify(after);
  const bus = new PresentationEventBus(); const events: PresentationEvent[] = [];
  bus.subscribe(e => events.push(e));
  new GamePresentationEventObserver(before, bus).observe(after);
  expect(events.map(e => e.type)).toEqual(['meld_declared', 'dora_revealed', 'tile_drawn']);
  let render: TableAnimation3DRenderState = { active: null, hiddenHandKeys: new Set(), hiddenRiverKeys: new Set(), hiddenMeldTileKeys: new Set(), hiddenRiichiSeats: new Set() };
  const local: string[] = [];
  const target = new TableAnimation3DTarget(() => buildTableSceneState(after), new DiscardSource3DStore(), () => 'kan',
    update => { render = typeof update === 'function' ? update(render) : update; }, () => 0, () => undefined,
    frame => local.push(frame?.phase ?? 'clear'));
  const kan = events.find(e => e.type === 'meld_declared')!;
  const draw = events.find(e => e.type === 'tile_drawn')!;
  target.beforeEnqueue(kan); target.prepare(kan);
  target.beforeEnqueue(draw);
  expect(render.active?.plan.action.eventId).toBe(kan.eventId);
  expect(local).toEqual(['enter']); // masked while Kan still owns the table action
  target.finish(kan);
  expect(local).toEqual(['enter']);
  await target.prepare(draw);
  target.setPhase(draw, 'release'); target.setPhase(draw, 'retreat'); target.finish(draw);
  expect(local[local.length - 1]).toBe('clear');
  expect(render.active).toBeNull();
  expect(JSON.stringify(after)).toBe(finalState);
});

it('tedashi return has exact river/source endpoints and no hand-area waypoint', () => {
  const river = { left: 620, top: 310, width: 34, height: 42 };
  const drawn = { left: 1035, top: 650, width: 52, height: 70 };
  expect(returnToDrawnRect(river, drawn, 0)).toEqual(river);
  expect(returnToDrawnRect(river, drawn, 1)).toEqual(drawn);
  expect(returnToDrawnRect(river, drawn, 0.5).left).toBe((river.left + drawn.left) / 2);
});

it.each(['bottom', 'right', 'top', 'left'] as const)('riichi %s travel/release/static share the same stick target without tile grounding jump', seat => {
  const initial = loadTestScenarioState(getBuiltInTestScenario('STAB-001-ANKAN')!);
  const scene = buildTableSceneState(initial);
  const playerId = scene.seats[seat].playerId;
  const plan = resolveTableAnimation3DPlan({ type: 'riichi_declared', eventId: `stick-${seat}`, sequence: 1, playerId, riverIndex: 0, kind: 'riichi' }, scene, new DiscardSource3DStore(), 'stick')!;
  expect(plan.destination).toEqual(getRiichiStickTransform(seat).position);
  expect(resolveTableAnimation3DMotion(plan, 'travel', 1).tilePosition).toEqual(plan.destination);
  expect(resolveTableAnimation3DMotion(plan, 'release', 0).tilePosition).toEqual(plan.destination);
  expect(resolveTableAnimation3DMotion(plan, 'release', 1).tilePosition).toEqual(plan.destination);
  expect(resolveTableAnimation3DMotion(plan, 'release', 0).handPosition).toEqual(plan.destination);
});

it('Ron keeps its pacing participant throughout the configured 3-second hold, and sounds once', async () => {
  vi.useFakeTimers();
  const bus = new PresentationEventBus(); const event = bus.publish({ type: 'win_declared', playerId: 1, winType: 'ron' });
  if (event.type !== 'win_declared') throw Error('fixture');
  const gate = new PresentationPacingGate(); gate.begin(event);
  const phases: string[] = []; const cues = vi.fn(); const disconnect = presentationAudioCues.connect(cues);
  const controller = new WinPresentationController({ prepare: () => true, setPhase: (_, phase) => phases.push(phase), finish: () => {}, clear: () => {} },
    new AnimationScheduler(), gate, { onSettled: e => gate.complete(e.eventId) });
  controller.enqueue(event);
  await vi.advanceTimersByTimeAsync(440);
  expect(phases[phases.length - 1]).toBe('hold'); expect(gate.pendingCount).toBe(1);
  await vi.advanceTimersByTimeAsync(RON_REVEAL_HOLD_MS - 1);
  expect(gate.pendingCount).toBe(1); expect(cues).toHaveBeenCalledTimes(1);
  await vi.runAllTimersAsync(); await controller.whenIdle();
  expect(gate.pendingCount).toBe(0); expect(phases).not.toContain('slam'); expect(cues).toHaveBeenCalledTimes(1);
  controller.dispose(); disconnect();
});

it('17-step official Ron supplies exactly the authoritative fixed hand and winning discard, without candidates', () => {
  const before = createSeventeenPresentationFixture('ron');
  const after = declareSeventeenStepsRon(before, 0);
  expect(after.result?.type).toBe('ron');
  if (after.result?.type !== 'ron') throw Error('fixture');
  const result = JSON.stringify(after.result);
  const hands = winnerPresentationHands(toSeventeenStepsGameState(after), id => id === 0 ? 'bottom' : 'top');
  expect(hands).toHaveLength(1);
  expect(hands[0].tiles).toHaveLength(14);
  expect(hands[0].tiles.slice(0, 13)).toEqual(after.players[after.result.winnerId].fixedHand);
  expect(hands[0].tiles[13]).toEqual(after.result.winningTile);
  const concealedCandidates = new Set(after.players[1].discardCandidates.map(tile => tile.instanceId));
  expect(hands[0].tiles.some(tile => concealedCandidates.has(tile.instanceId))).toBe(false);
  expect(JSON.stringify(after.result)).toBe(result);
});

it.each(['bottom', 'right', 'top', 'left'] as const)('Tsumo %s places only the winning slot flat on the felt', seat => {
  const impact = winningTileSlapTransform(seat, 13, 14, 1);
  expect(impact.rotationX).toBe(0);
  expect(impact.position[1]).toBe(getGroundedTileCenterY(0, getHandTileScale(seat)));
  const source = winningTileSlapTransform(seat, 13, 14, 0);
  expect(source.rotationX).not.toBe(0);
  expect(impact.position).not.toEqual(source.position);
});
