import { describe, expect, it, vi } from 'vitest';
import { DemandFrameInvalidator, TABLE_ANIMATION_MAX_RENDER_FPS } from './DemandFrameInvalidator';
import { PaintCommitBarrier } from './PaintCommitBarrier';

describe('UI-5E.2.4 3D animation runtime controls', () => {
  it('coalesces redraw requests, caps them at 60 fps, and cancels the pending RAF', () => {
    let nextHandle = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    const requestFrame = (callback: FrameRequestCallback) => {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    };
    const cancelFrame = vi.fn((handle: number) => { callbacks.delete(handle); });
    const invalidate = vi.fn();
    const invalidator = new DemandFrameInvalidator(
      1000 / TABLE_ANIMATION_MAX_RENDER_FPS,
      requestFrame,
      cancelFrame,
    );

    invalidator.markInvalidated(0);
    invalidator.request(invalidate);
    invalidator.request(invalidate);
    expect(invalidator.hasPendingFrame).toBe(true);
    expect(callbacks.size).toBe(1);

    callbacks.get(1)?.(5);
    callbacks.delete(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(1);
    callbacks.get(2)?.(1000 / TABLE_ANIMATION_MAX_RENDER_FPS);
    callbacks.delete(2);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidator.hasPendingFrame).toBe(false);

    invalidator.request(invalidate);
    invalidator.cancelPending();
    expect(invalidator.hasPendingFrame).toBe(false);
    expect(cancelFrame).toHaveBeenCalledWith(3);
    expect(callbacks.size).toBe(0);
  });

  it('does not release a DOM snapshot until two paint frames have completed', async () => {
    let nextHandle = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    const requestFrame = (callback: FrameRequestCallback) => {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    };
    const cancelFrame = (handle: number) => callbacks.delete(handle);
    const barrier = new PaintCommitBarrier(requestFrame, cancelFrame);
    let released = false;
    const waiting = barrier.wait().then(() => { released = true; });

    expect(barrier.pendingCount).toBe(1);
    callbacks.get(1)?.(0);
    callbacks.delete(1);
    await Promise.resolve();
    expect(released).toBe(false);
    callbacks.get(2)?.(16);
    callbacks.delete(2);
    await waiting;
    expect(released).toBe(true);
    expect(barrier.pendingCount).toBe(0);
  });

  it('cancels and settles an outstanding paint wait during unmount cleanup', async () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    const cancelFrame = vi.fn((handle: number) => { callbacks.delete(handle); });
    const barrier = new PaintCommitBarrier((callback) => {
      callbacks.set(1, callback);
      return 1;
    }, cancelFrame);
    const waiting = barrier.wait();

    barrier.cancelPending();
    await waiting;
    expect(cancelFrame).toHaveBeenCalledWith(1);
    expect(callbacks.size).toBe(0);
    expect(barrier.pendingCount).toBe(0);
  });
});
