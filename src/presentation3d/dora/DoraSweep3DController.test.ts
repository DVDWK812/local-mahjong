import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLE_PRESENTATION_TUNING } from '../table/tablePresentationTuning';
import {
  DoraSweep3DController,
  DoraSweep3DDeadlineScheduler,
  type DoraSweep3DTarget,
} from './DoraSweep3DController';

function targets(count: number): DoraSweep3DTarget[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `tile-${index}`,
    variant: index === 0 ? 'combined' : 'normal',
  }));
}

function mutableRepeatTuning(): { repeatEnabled: 0 | 1; repeatIntervalMs: number } {
  return TABLE_PRESENTATION_TUNING.doraSweep3D as unknown as {
    repeatEnabled: 0 | 1;
    repeatIntervalMs: number;
  };
}

describe('UI-5F.3 Dora sweep pulse lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mutableRepeatTuning().repeatEnabled = 1;
    mutableRepeatTuning().repeatIntervalMs = 5000;
  });

  afterEach(() => {
    mutableRepeatTuning().repeatEnabled = 1;
    mutableRepeatTuning().repeatIntervalMs = 5000;
    vi.useRealTimers();
  });

  it('pulses immediately, stays idle before 5000ms, then pulses at 5000ms and 10000ms', () => {
    const controller = new DoraSweep3DController();
    const deadlines: number[] = [];
    controller.registerVisible({ key: 'river-1', variant: 'normal' }, 0);
    const scheduler = new DoraSweep3DDeadlineScheduler(
      controller,
      (result) => deadlines.push(result.startTime),
      () => Date.now(),
    );
    scheduler.arm();

    expect(controller.get('river-1')).toMatchObject({ progress: 0, startTime: 0 });
    controller.advance(TABLE_PRESENTATION_TUNING.doraSweep3D.normalDurationMs);
    expect(controller.activeCount).toBe(0);

    vi.advanceTimersByTime(4999);
    expect(deadlines).toEqual([]);
    expect(controller.activeCount).toBe(0);

    vi.advanceTimersByTime(1);
    expect(deadlines).toEqual([5000]);
    expect(controller.get('river-1')?.startTime).toBe(5000);
    controller.advance(5000 + TABLE_PRESENTATION_TUNING.doraSweep3D.normalDurationMs);
    expect(controller.activeCount).toBe(0);

    vi.advanceTimersByTime(5000);
    expect(deadlines).toEqual([5000, 10000]);
    expect(controller.get('river-1')?.startTime).toBe(10000);
  });

  it.each([1, 4, 8])('supports %i simultaneous visible Dora and cleans active shells', (count) => {
    const controller = new DoraSweep3DController();
    targets(count).forEach((target) => controller.registerVisible(target, 0));
    expect(controller.visibleCount).toBe(count);
    expect(controller.activeCount).toBe(count);
    expect(controller.snapshots()).toHaveLength(count);
    expect(controller.advance(TABLE_PRESENTATION_TUNING.doraSweep3D.combinedDurationMs)).toBe(0);
    expect(controller.snapshots()).toEqual([]);
    expect(controller.nextPulseAt).toBe(5000);
  });

  it('uses one nearest-deadline scheduler for staggered Dora', () => {
    const controller = new DoraSweep3DController();
    const batches: Array<{ time: number; count: number }> = [];
    const scheduler = new DoraSweep3DDeadlineScheduler(
      controller,
      (result) => batches.push({ time: result.startTime, count: result.startedCount }),
      () => Date.now(),
    );
    controller.registerVisible({ key: 'river-1', variant: 'normal' }, 0);
    scheduler.arm();
    vi.advanceTimersByTime(1000);
    controller.registerVisible({ key: 'meld-1', variant: 'combined' }, 1000);
    scheduler.arm();

    vi.advanceTimersByTime(5000);
    expect(batches).toEqual([{ time: 5000, count: 1 }, { time: 6000, count: 1 }]);
  });

  it('removing a Tile cancels its active sweep and pending repeat', () => {
    const controller = new DoraSweep3DController();
    const onDeadline = vi.fn();
    controller.registerVisible({ key: 'river-1', variant: 'normal' }, 0);
    const scheduler = new DoraSweep3DDeadlineScheduler(controller, onDeadline, () => Date.now());
    scheduler.arm();
    expect(scheduler.pending).toBe(true);

    controller.unregisterVisible('river-1');
    scheduler.arm();
    expect(controller.activeCount).toBe(0);
    expect(controller.visibleCount).toBe(0);
    expect(scheduler.pending).toBe(false);
    vi.advanceTimersByTime(12000);
    expect(onDeadline).not.toHaveBeenCalled();
  });

  it('session reset and unmount-style cancellation clear the one-shot timeout', () => {
    const controller = new DoraSweep3DController();
    const onDeadline = vi.fn();
    controller.registerVisible({ key: 'hand-1', variant: 'normal' }, 0);
    const scheduler = new DoraSweep3DDeadlineScheduler(controller, onDeadline, () => Date.now());
    scheduler.arm();
    scheduler.cancel();
    controller.clear();

    expect(scheduler.pending).toBe(false);
    expect(controller.visibleCount).toBe(0);
    expect(controller.activeCount).toBe(0);
    vi.advanceTimersByTime(12000);
    expect(onDeadline).not.toHaveBeenCalled();
  });

  it('repeatEnabled=0 retains a single immediate pulse without a timeout', () => {
    mutableRepeatTuning().repeatEnabled = 0;
    const controller = new DoraSweep3DController();
    const onDeadline = vi.fn();
    controller.registerVisible({ key: 'river-1', variant: 'normal' }, 0);
    const scheduler = new DoraSweep3DDeadlineScheduler(controller, onDeadline, () => Date.now());
    scheduler.arm();

    expect(controller.activeCount).toBe(1);
    expect(controller.nextPulseAt).toBeNull();
    expect(scheduler.pending).toBe(false);
    controller.advance(TABLE_PRESENTATION_TUNING.doraSweep3D.normalDurationMs);
    vi.advanceTimersByTime(12000);
    expect(onDeadline).not.toHaveBeenCalled();
  });

  it('event settle starts immediately and resets the next deadline from that start', () => {
    const controller = new DoraSweep3DController();
    controller.registerVisible({ key: 'meld-1', variant: 'combined' }, 0, false);
    controller.trigger({ eventId: 'meld-event', targets: [{ key: 'meld-1', variant: 'combined' }] }, 250);

    expect(controller.get('meld-1')).toMatchObject({ eventId: 'meld-event', startTime: 250 });
    expect(controller.get('meld-1')?.durationMs).toBe(
      TABLE_PRESENTATION_TUNING.doraSweep3D.combinedDurationMs,
    );
    expect(controller.nextPulseAt).toBe(5250);
    expect(controller.cancel('meld-event')).toBe(0);
  });

  it('does not restart a visibility pulse when its settle event arrives moments later', () => {
    const controller = new DoraSweep3DController();
    controller.registerVisible({ key: 'river-1', variant: 'normal' }, 100);
    controller.trigger({
      eventId: 'discard-event',
      targets: [{ key: 'river-1', variant: 'normal' }],
    }, 200);

    expect(controller.get('river-1')).toMatchObject({ startTime: 100 });
    expect(controller.nextPulseAt).toBe(5100);
  });
});
