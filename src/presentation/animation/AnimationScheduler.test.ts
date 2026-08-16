import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AnimationScheduler,
  effectiveAnimationDuration,
  waitForAnimationTime,
  type AnimationTask,
} from './AnimationScheduler';

function task(play: AnimationTask['play'], snapToEnd = vi.fn(), cleanup = vi.fn()): AnimationTask {
  return { play, snapToEnd, cleanup };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('AnimationScheduler', () => {
  it('run 执行一次任务并在完成后清理', async () => {
    const scheduler = new AnimationScheduler();
    const play = vi.fn(async () => undefined);
    const cleanup = vi.fn();

    await expect(scheduler.run(task(play, vi.fn(), cleanup))).resolves.toBe('completed');

    expect(play).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(scheduler.activeRunCount).toBe(0);
    expect(scheduler.pendingTaskCount).toBe(0);
    expect(scheduler.runningTaskCount).toBe(0);
  });

  it('sequence 严格按顺序执行', async () => {
    const scheduler = new AnimationScheduler();
    const events: string[] = [];
    const makeTask = (name: string) => task(async () => {
      events.push(`${name} start`);
      await Promise.resolve();
      events.push(`${name} end`);
    });

    await expect(scheduler.sequence([makeTask('A'), makeTask('B'), makeTask('C')])).resolves.toBe('completed');

    expect(events).toEqual(['A start', 'A end', 'B start', 'B end', 'C start', 'C end']);
  });

  it('parallel 同时启动并等待全部任务', async () => {
    const scheduler = new AnimationScheduler();
    const first = deferred();
    const second = deferred();
    const events: string[] = [];
    const running = scheduler.parallel([
      task(async () => { events.push('A start'); await first.promise; events.push('A end'); }),
      task(async () => { events.push('B start'); await second.promise; events.push('B end'); }),
    ]);

    await Promise.resolve();
    expect(events).toEqual(['A start', 'B start']);
    second.resolve();
    await Promise.resolve();
    expect(events).toContain('B end');
    expect(events).not.toContain('A end');
    first.resolve();

    await expect(running).resolves.toBe('completed');
  });

  it('cancelAll 中断当前任务，即使任务未主动响应 signal 也不会永久 pending', async () => {
    const scheduler = new AnimationScheduler();
    const cleanup = vi.fn();
    let signal: AbortSignal | undefined;
    const running = scheduler.run(task(async (context) => {
      signal = context.signal;
      await new Promise<void>(() => undefined);
    }, vi.fn(), cleanup));
    await Promise.resolve();

    scheduler.cancelAll();

    await expect(running).resolves.toBe('cancelled');
    expect(signal?.aborted).toBe(true);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(scheduler.activeRunCount).toBe(0);
    expect(scheduler.runningTaskCount).toBe(0);
  });

  it('cancelAll 阻止 sequence 中尚未开始的任务', async () => {
    const scheduler = new AnimationScheduler();
    const started: string[] = [];
    const running = scheduler.sequence([
      task(async (context) => { started.push('A'); await waitForAnimationTime(1000, context); }),
      task(async () => { started.push('B'); }),
      task(async () => { started.push('C'); }),
    ]);
    await Promise.resolve();

    scheduler.cancelAll();

    await expect(running).resolves.toBe('cancelled');
    expect(started).toEqual(['A']);
    expect(scheduler.pendingTaskCount).toBe(0);
  });

  it('cancelAll 后创建新 controller，Scheduler 可以复用', async () => {
    const scheduler = new AnimationScheduler();
    const first = scheduler.run(task(async () => new Promise<void>(() => undefined)));
    await Promise.resolve();
    scheduler.cancelAll();
    await expect(first).resolves.toBe('cancelled');

    let nextSignal: AbortSignal | undefined;
    await expect(scheduler.run(task(async (context) => { nextSignal = context.signal; }))).resolves.toBe('completed');

    expect(nextSignal?.aborted).toBe(false);
  });

  it('parallel cancel 会让全部运行任务收到 abort', async () => {
    const scheduler = new AnimationScheduler();
    const signals: AbortSignal[] = [];
    const running = scheduler.parallel(Array.from({ length: 3 }, () => task(async (context) => {
      signals.push(context.signal);
      await waitForAnimationTime(1000, context);
    })));
    await Promise.resolve();

    scheduler.cancelAll();

    await expect(running).resolves.toBe('cancelled');
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(scheduler.runningTaskCount).toBe(0);
  });

  it('Skip 不执行 play，直接 snapToEnd，并保留后续复用能力', async () => {
    const scheduler = new AnimationScheduler();
    const play = vi.fn(async () => undefined);
    const snapToEnd = vi.fn();
    const cleanup = vi.fn();
    const animation = task(play, snapToEnd, cleanup);
    scheduler.setSkip(true);

    await expect(scheduler.run(animation)).resolves.toBe('skipped');
    expect(play).not.toHaveBeenCalled();
    expect(snapToEnd).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();

    scheduler.setSkip(false);
    await expect(scheduler.run(animation)).resolves.toBe('completed');
    expect(play).toHaveBeenCalledOnce();
  });

  it('speed 是播放倍率，统一换算等待时间', async () => {
    vi.useFakeTimers();
    const scheduler = new AnimationScheduler();
    scheduler.setSpeed(2);
    let finished = false;
    const running = scheduler.run(task(async (context) => {
      await waitForAnimationTime(1000, context);
      finished = true;
    }));
    await Promise.resolve();

    expect(effectiveAnimationDuration(1000, 2)).toBe(500);
    expect(effectiveAnimationDuration(1000, 0.5)).toBe(2000);
    vi.advanceTimersByTime(499);
    await Promise.resolve();
    expect(finished).toBe(false);
    vi.advanceTimersByTime(1);
    await expect(running).resolves.toBe('completed');
    expect(finished).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sequence 任务异常会 reject、停止后续任务，并允许下一批继续', async () => {
    const scheduler = new AnimationScheduler();
    const later = vi.fn(async () => undefined);

    await expect(scheduler.sequence([
      task(async () => { throw new Error('sequence failed'); }),
      task(later),
    ])).rejects.toThrow('sequence failed');

    expect(later).not.toHaveBeenCalled();
    await expect(scheduler.run(task(async () => undefined))).resolves.toBe('completed');
    expect(scheduler.pendingTaskCount).toBe(0);
    expect(scheduler.runningTaskCount).toBe(0);
  });

  it('parallel 中一个任务异常会 reject 并取消兄弟任务', async () => {
    vi.useFakeTimers();
    const scheduler = new AnimationScheduler();
    let siblingSignal: AbortSignal | undefined;
    const siblingCleanup = vi.fn();

    await expect(scheduler.parallel([
      task(async () => { throw new Error('parallel failed'); }),
      task(async (context) => {
        siblingSignal = context.signal;
        await waitForAnimationTime(1000, context);
      }, vi.fn(), siblingCleanup),
    ])).rejects.toThrow('parallel failed');

    expect(siblingSignal?.aborted).toBe(true);
    expect(siblingCleanup).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(scheduler.activeRunCount).toBe(0);
  });

  it('取消等待会清理 timer 和 abort listener', async () => {
    vi.useFakeTimers();
    const scheduler = new AnimationScheduler();
    const running = scheduler.run(task(async (context) => waitForAnimationTime(1000, context)));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);

    scheduler.cancelAll();
    await expect(running).resolves.toBe('cancelled');

    expect(vi.getTimerCount()).toBe(0);
    expect(scheduler.pendingTaskCount).toBe(0);
    expect(scheduler.runningTaskCount).toBe(0);
  });

  it('大量短任务完成后不保留队列或 controller', async () => {
    const scheduler = new AnimationScheduler();
    const shortTask = task(async () => undefined);

    await Promise.all(Array.from({ length: 100 }, () => scheduler.run(shortTask)));

    expect(scheduler.pendingTaskCount).toBe(0);
    expect(scheduler.runningTaskCount).toBe(0);
    expect(scheduler.activeRunCount).toBe(0);
  });

  it('拒绝无效 speed，Skip 使用独立 API', () => {
    const scheduler = new AnimationScheduler();
    expect(() => scheduler.setSpeed(0)).toThrow(RangeError);
    expect(() => scheduler.setSpeed(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
