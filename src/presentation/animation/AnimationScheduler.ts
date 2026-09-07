export type AnimationRunStatus = 'completed' | 'cancelled' | 'skipped';

export interface AnimationContext {
  readonly signal: AbortSignal;
  readonly speed: number;
  readonly skip: boolean;
}

export interface AnimationTask {
  play(context: AnimationContext): Promise<void>;
  snapToEnd(): void;
  cleanup?(): void;
}

/** Finite frame task owned by AnimationScheduler; no consumer timer or permanent RAF. */
export function animationFrameTask(durationMs: number, update: (progress: number) => void): AnimationTask {
  return {
    snapToEnd: () => update(1),
    play: async (context) => {
      if (context.signal.aborted) return;
      update(0);
      if (typeof requestAnimationFrame !== 'function') {
        await waitForAnimationTime(durationMs, context);
        if (!context.signal.aborted) update(1);
        return;
      }
      const duration = effectiveAnimationDuration(durationMs, context.speed);
      if (duration === 0) { update(1); return; }
      await new Promise<void>((resolve, reject) => {
        const start = performance.now();
        let handle = 0;
        const cleanup = () => {
          cancelAnimationFrame(handle);
          context.signal.removeEventListener('abort', finish);
        };
        const finish = () => { cleanup(); resolve(); };
        const tick = (now: number) => {
          if (context.signal.aborted) { finish(); return; }
          const progress = Math.min(1, (now - start) / duration);
          try { update(progress); }
          catch (error) { cleanup(); reject(error); return; }
          if (progress === 1) finish();
          else handle = requestAnimationFrame(tick);
        };
        context.signal.addEventListener('abort', finish, { once: true });
        handle = requestAnimationFrame(tick);
      });
    },
  };
}

export class AnimationCancelledError extends Error {
  constructor() {
    super('Animation cancelled');
    this.name = 'AnimationCancelledError';
  }
}

export function effectiveAnimationDuration(baseDurationMs: number, speed: number): number {
  if (!Number.isFinite(baseDurationMs) || baseDurationMs < 0) {
    throw new RangeError('Animation duration must be a finite non-negative number');
  }
  assertValidSpeed(speed);
  return baseDurationMs / speed;
}

export function waitForAnimationTime(baseDurationMs: number, context: AnimationContext): Promise<void> {
  if (context.skip || baseDurationMs === 0) return Promise.resolve();
  if (context.signal.aborted) return Promise.reject(new AnimationCancelledError());

  const durationMs = effectiveAnimationDuration(baseDurationMs, context.speed);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', handleAbort);
      callback();
    };
    const handleAbort = () => finish(() => reject(new AnimationCancelledError()));
    const timer = setTimeout(() => finish(() => resolve()), durationMs);
    context.signal.addEventListener('abort', handleAbort, { once: true });
  });
}

export class AnimationScheduler {
  private speed = 1;
  private skip = false;
  private readonly activeControllers = new Set<AbortController>();
  private pendingTasks = 0;
  private runningTasks = 0;

  get pendingTaskCount(): number {
    return this.pendingTasks;
  }

  get runningTaskCount(): number {
    return this.runningTasks;
  }

  get activeRunCount(): number {
    return this.activeControllers.size;
  }

  setSpeed(speed: number): void {
    assertValidSpeed(speed);
    this.speed = speed;
  }

  setSkip(skip: boolean): void {
    this.skip = skip;
  }

  run(task: AnimationTask): Promise<AnimationRunStatus> {
    return this.runBatch([task], 'sequence');
  }

  sequence(tasks: readonly AnimationTask[]): Promise<AnimationRunStatus> {
    return this.runBatch(tasks, 'sequence');
  }

  parallel(tasks: readonly AnimationTask[]): Promise<AnimationRunStatus> {
    return this.runBatch(tasks, 'parallel');
  }

  cancelAll(): void {
    [...this.activeControllers].forEach((controller) => controller.abort());
  }

  private async runBatch(tasks: readonly AnimationTask[], mode: 'sequence' | 'parallel'): Promise<AnimationRunStatus> {
    if (tasks.length === 0) return 'completed';

    const controller = new AbortController();
    const context: AnimationContext = Object.freeze({
      signal: controller.signal,
      speed: this.speed,
      skip: this.skip,
    });
    this.activeControllers.add(controller);
    this.pendingTasks += tasks.length;
    let startedTasks = 0;

    const startTask = (task: AnimationTask) => {
      startedTasks += 1;
      return this.executeTask(task, context);
    };

    try {
      if (mode === 'sequence') {
        let skipped = false;
        for (const task of tasks) {
          if (controller.signal.aborted) return 'cancelled';
          const status = await startTask(task);
          if (status === 'cancelled') return 'cancelled';
          if (status === 'skipped') skipped = true;
        }
        return skipped ? 'skipped' : 'completed';
      }

      const results = await Promise.allSettled(tasks.map((task) => startTask(task).catch((error) => {
        if (!controller.signal.aborted) controller.abort();
        throw error;
      })));
      const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failure) throw failure.reason;
      const statuses = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      if (controller.signal.aborted || statuses.includes('cancelled')) return 'cancelled';
      return statuses.includes('skipped') ? 'skipped' : 'completed';
    } finally {
      this.pendingTasks -= tasks.length - startedTasks;
      this.activeControllers.delete(controller);
    }
  }

  private async executeTask(task: AnimationTask, context: AnimationContext): Promise<AnimationRunStatus> {
    this.pendingTasks -= 1;
    this.runningTasks += 1;

    try {
      if (context.skip) {
        task.snapToEnd();
        return 'skipped';
      }
      if (context.signal.aborted) return 'cancelled';
      return await playUntilCompleteOrCancelled(task, context);
    } finally {
      try {
        task.cleanup?.();
      } finally {
        this.runningTasks -= 1;
      }
    }
  }
}

async function playUntilCompleteOrCancelled(task: AnimationTask, context: AnimationContext): Promise<AnimationRunStatus> {
  let removeAbortListener: () => void = () => undefined;
  const cancelled = new Promise<AnimationRunStatus>((resolve) => {
    if (context.signal.aborted) {
      resolve('cancelled');
      return;
    }
    const handleAbort = () => resolve('cancelled');
    context.signal.addEventListener('abort', handleAbort, { once: true });
    removeAbortListener = () => context.signal.removeEventListener('abort', handleAbort);
  });
  const played = Promise.resolve()
    .then(() => task.play(context))
    .then((): AnimationRunStatus => 'completed');

  try {
    return await Promise.race([played, cancelled]);
  } catch (error) {
    if (context.signal.aborted) return 'cancelled';
    throw error;
  } finally {
    removeAbortListener();
  }
}

function assertValidSpeed(speed: number): void {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new RangeError('Animation speed must be a finite positive number');
  }
}
