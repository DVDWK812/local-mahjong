import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresentationAudioCues, presentationAudioCues, type PresentationAudioCue } from './PresentationAudioCue';
import { PresentationEventBus } from './PresentationEventBus';
import { AnimationScheduler, animationFrameTask } from './animation/AnimationScheduler';
import { HandAnimationController, type HandAnimationAction, type HandAnimationTarget } from './handAnimation/HandAnimationController';
import { WinPresentationController } from './winAnimation/WinPresentationController';
import { PresentationPacingGate } from './pacing/PresentationPacingGate';

const bus = new PresentationEventBus();
const discard = () => bus.publish({ type: 'tile_discarded', playerId: 0, tile: { id: 0, red: false }, riverIndex: 0, isRiichiDiscard: false }) as HandAnimationAction;
const target = (): HandAnimationTarget => ({ prepare: () => true, setPhase: vi.fn(), finish: vi.fn(), clear: vi.fn() });
afterEach(() => vi.useRealTimers());

describe('semantic audio lifecycle', () => {
  it('deduplicates across sink/StrictMode rebuild, rejects closed and old-generation callbacks', () => {
    const cues = new PresentationAudioCues();
    const sink = vi.fn();
    const disconnect = cues.connect(sink);
    const event = discard();
    const run = cues.run(event);
    run.emit('discard-impact', 'river-settle', 0);
    run.emit('discard-impact', 'river-settle', 1);
    const stale = cues.run(discard());
    disconnect();
    const close = cues.connect(sink);
    stale.emit('discard-impact', 'river-settle', 0);
    cues.run(event).emit('discard-impact', 'river-settle', 0);
    const cancelled = cues.run(discard());
    cancelled.close(); cancelled.emit('discard-impact', 'river-settle', 0);
    expect(sink).toHaveBeenCalledTimes(1);
    close();
  });

  it.each([1, 2])('draw contact and meld/riichi final landing follow scheduler at %ix speed', async speed => {
    vi.useFakeTimers();
    const log: Array<{ cue: PresentationAudioCue; time: number }> = [];
    const disconnect = presentationAudioCues.connect(cue => log.push({ cue, time: Date.now() }));
    const scheduler = new AnimationScheduler(); scheduler.setSpeed(speed);
    const controller = new HandAnimationController(target(), scheduler);
    const start = Date.now();
    controller.enqueue(bus.publish({ type: 'tile_drawn', playerId: 0 }) as HandAnimationAction);
    await vi.advanceTimersByTimeAsync(149 / speed);
    expect(log).toHaveLength(0);
    await vi.runAllTimersAsync(); await controller.whenIdle();
    expect(log[0].cue.kind).toBe('draw-contact');
    expect(log[0].time - start).toBe(150 / speed);
    for (const meldType of ['chi', 'pon', 'kan'] as const) {
      const before = Date.now();
      controller.enqueue(bus.publish({ type: 'meld_declared', playerId: 1, meldType }) as HandAnimationAction);
      await vi.runAllTimersAsync(); await controller.whenIdle();
      expect(log[log.length - 1]?.cue.kind).toBe('meld-impact');
      expect(log[log.length - 1]!.time - before).toBe(570 / speed);
    }
    controller.enqueue(discard());
    controller.enqueue(bus.publish({ type: 'riichi_declared', playerId: 0, riverIndex: 0 }) as HandAnimationAction);
    await vi.runAllTimersAsync(); await controller.whenIdle();
    expect(log.slice(-2).map(item => item.cue.kind)).toEqual(['discard-impact', 'riichi-stick-impact']);
    expect(log[log.length - 1]!.time).toBeGreaterThan(log[log.length - 2]!.time);
    controller.dispose(); disconnect();
  });

  it.each(['snapshot', 'candidate'] as const)('%s impact belongs to settle start, never capture or click', async profile => {
    vi.useFakeTimers();
    const played = vi.fn();
    const disconnect = presentationAudioCues.connect(played);
    const phase = profile === 'snapshot' ? 'river-settle' : 'release';
    const t = target();
    t.animationTasks = (_action, onFrame) => [
      animationFrameTask(240, () => undefined, p => onFrame?.('travel', p, profile)),
      animationFrameTask(110, () => undefined, p => onFrame?.(phase, p, profile)),
    ];
    const controller = new HandAnimationController(t);
    controller.enqueue(discard());
    expect(played).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(239);
    expect(played).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(played).toHaveBeenCalledTimes(1);
    expect(played.mock.calls[0][0]).toMatchObject({ kind: 'discard-impact', phase, progress: 0 });
    await vi.runAllTimersAsync();
    expect(played).toHaveBeenCalledTimes(1);
    controller.dispose(); disconnect();
  });

  it.each(['skip', 'cancel', 'dispose'] as const)('%s before/after impact never replays or delays sound', async operation => {
    vi.useFakeTimers();
    const played = vi.fn(); const disconnect = presentationAudioCues.connect(played);
    for (const afterImpact of [false, true]) {
      const controller = new HandAnimationController(target(), new AnimationScheduler(), { snapOnPlaybackChange: true });
      controller.enqueue(discard());
      await vi.advanceTimersByTimeAsync(afterImpact ? 600 : 100);
      const count = played.mock.calls.length;
      if (operation === 'skip') controller.setSkip(true);
      else if (operation === 'cancel') controller.cancelAll();
      else controller.dispose();
      await vi.runAllTimersAsync(); await controller.whenIdle();
      expect(played).toHaveBeenCalledTimes(count);
      controller.dispose();
    }
    expect(played).toHaveBeenCalledTimes(1);
    disconnect();
  });

  it('skip suppresses all snap frames; reduced motion commits one impact', async () => {
    const played = vi.fn(); const disconnect = presentationAudioCues.connect(played);
    const skipped = new HandAnimationController(target()); skipped.setSkip(true);
    skipped.enqueue(discard()); await skipped.whenIdle();
    expect(played).not.toHaveBeenCalled();
    const reduced = new HandAnimationController(target()); reduced.setReducedMotion(true);
    reduced.enqueue(discard()); await reduced.whenIdle();
    expect(played).toHaveBeenCalledTimes(1);
    expect(played.mock.calls[0][0].phase).toBe('reduced-motion-settled');
    skipped.dispose(); reduced.dispose(); disconnect();
  });

  it('cancel during async prepare cannot revive an old generation', async () => {
    let ready!: (value: boolean) => void;
    const played = vi.fn(); const disconnect = presentationAudioCues.connect(played);
    const t = target(); t.prepare = () => new Promise(resolve => { ready = resolve; });
    const controller = new HandAnimationController(t);
    controller.enqueue(discard()); controller.cancelAll(); ready(true);
    await controller.whenIdle(); expect(played).not.toHaveBeenCalled();
    controller.dispose(); disconnect();
  });

  it.each(['ron', 'tsumo'] as const)('%s win waits for earlier discard barrier and commits at Ron reveal / Tsumo slap impact', async winType => {
    vi.useFakeTimers();
    const played = vi.fn(); const disconnect = presentationAudioCues.connect(played);
    const gate = new PresentationPacingGate(); const source = discard(); gate.begin(source);
    const t = { prepare: () => true, setPhase: vi.fn(), finish: vi.fn(), clear: vi.fn() };
    const controller = new WinPresentationController(t, new AnimationScheduler(), gate);
    const event = bus.publish({ type: 'win_declared', playerId: 0, winType });
    if (event.type !== 'win_declared') throw new Error('fixture');
    controller.enqueue(event);
    await vi.advanceTimersByTimeAsync(100); expect(played).not.toHaveBeenCalled();
    gate.complete(source.eventId);
    await vi.runAllTimersAsync(); await controller.whenIdle();
    expect(played).toHaveBeenCalledTimes(1);
    expect(played.mock.calls[0][0]).toMatchObject({ kind: 'win-impact', phase: winType === 'ron' ? 'push' : 'slam' });
    controller.dispose(); disconnect();
  });

  it('audio exception is fail-open for controller and pacing', async () => {
    vi.useFakeTimers();
    const disconnect = presentationAudioCues.connect(() => { throw new Error('audio unavailable'); });
    const gate = new PresentationPacingGate(); const event = discard(); gate.begin(event);
    const controller = new HandAnimationController(target(), new AnimationScheduler(), { onSettled: e => gate.complete(e.eventId) });
    controller.enqueue(event); await vi.runAllTimersAsync(); await controller.whenIdle();
    expect(gate.pendingCount).toBe(0);
    controller.dispose(); disconnect();
  });
});
