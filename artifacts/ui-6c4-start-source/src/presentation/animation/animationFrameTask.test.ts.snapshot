import { afterEach, expect, it, vi } from 'vitest';
import { AnimationScheduler, animationFrameTask } from './AnimationScheduler';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function frames() {
  const pending = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { pending.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => pending.delete(handle));
  return { pending, tick: (time: number) => {
    const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach((callback) => callback(time));
  } };
}

it('scheduler-driven frames finish at the speed-adjusted endpoint and stop requesting frames', async () => {
  const clock = frames();
  const scheduler = new AnimationScheduler();
  scheduler.setSpeed(2);
  const progress: number[] = [];
  const run = scheduler.run(animationFrameTask(200, (p) => progress.push(p)));
  await Promise.resolve();
  clock.tick(50);
  expect(progress).toEqual([0, 0.5]);
  clock.tick(100);
  expect(await run).toBe('completed');
  expect(progress).toEqual([0, 0.5, 1]);
  expect(clock.pending.size).toBe(0);
  expect(scheduler.activeRunCount).toBe(0);
});

it('cancel removes the queued frame and never calls an old consumer again', async () => {
  const clock = frames();
  const scheduler = new AnimationScheduler();
  const update = vi.fn();
  const run = scheduler.run(animationFrameTask(200, update));
  await Promise.resolve();
  expect(clock.pending.size).toBe(1);
  scheduler.cancelAll();
  expect(await run).toBe('cancelled');
  clock.tick(200);
  expect(update.mock.calls).toEqual([[0]]);
  expect(clock.pending.size).toBe(0);
});

it('a throwing frame consumer releases resources and rejects to the controller fail-open path', async () => {
  const clock = frames();
  const scheduler = new AnimationScheduler();
  const run = scheduler.run(animationFrameTask(200, (p) => { if (p > 0) throw new Error('consumer failure'); }));
  const result = expect(run).rejects.toThrow('consumer failure');
  await Promise.resolve();
  clock.tick(50);
  await result;
  expect(clock.pending.size).toBe(0);
  expect(scheduler.activeRunCount).toBe(0);
});
