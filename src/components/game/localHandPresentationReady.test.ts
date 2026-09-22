import { describe, expect, it, vi } from 'vitest';
import { waitForLocalHandPresentation } from './localHandPresentationReady';

function completeImage(decode: () => Promise<void>) {
  return {
    complete: true,
    decode,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLImageElement;
}

describe('local hand presentation readiness', () => {
  it('waits for decoded images and a committed layout frame', async () => {
    let finishDecode!: () => void;
    const decode = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishDecode = resolve; }))
      .mockResolvedValue(undefined);
    const image = completeImage(decode);
    const layout = vi.fn(async () => undefined);
    let settled = false;
    const ready = waitForLocalHandPresentation(() => [image], layout).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finishDecode();
    await ready;
    expect(layout).toHaveBeenCalledOnce();
  });

  it('fails open when an image decode rejects and ignores an empty hand', async () => {
    const failed = completeImage(async () => { throw new Error('decode failed'); });
    await expect(waitForLocalHandPresentation(() => [failed], async () => undefined)).resolves.toBe(true);
    await expect(waitForLocalHandPresentation(() => [], async () => undefined)).resolves.toBe(true);
  });

  it('cancels a pending image wait without reporting stale readiness', async () => {
    const listeners = new Map<string, EventListener>();
    const image = {
      complete: false,
      decode: vi.fn(async () => undefined),
      addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type: string) => listeners.delete(type)),
    } as unknown as HTMLImageElement;
    const controller = new AbortController();
    const ready = waitForLocalHandPresentation(() => [image], async () => undefined, controller.signal);
    controller.abort();
    await expect(ready).resolves.toBe(false);
    expect(image.decode).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
