type PresentationImage = Pick<
  HTMLImageElement,
  'addEventListener' | 'complete' | 'decode' | 'removeEventListener'
>;

function waitForLoadOrError(image: PresentationImage, signal?: AbortSignal): Promise<void> {
  if (image.complete || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const settle = () => {
      image.removeEventListener('load', settle);
      image.removeEventListener('error', settle);
      signal?.removeEventListener('abort', settle);
      resolve();
    };
    image.addEventListener('load', settle);
    image.addEventListener('error', settle);
    signal?.addEventListener('abort', settle, { once: true });
  });
}

async function settleImage(image: PresentationImage, signal?: AbortSignal): Promise<void> {
  await waitForLoadOrError(image, signal);
  if (signal?.aborted) return;
  try {
    await image.decode();
  } catch {
    // Tile owns its builtin/placeholder fallback. A failed decode must not deadlock presentation.
  }
}

export function waitForNextPresentationFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export async function waitForLocalHandPresentation(
  getImages: () => readonly PresentationImage[],
  waitForLayout: () => Promise<void> = waitForNextPresentationFrame,
  signal?: AbortSignal,
): Promise<boolean> {
  await Promise.all(getImages().map((image) => settleImage(image, signal)));
  if (signal?.aborted) return false;
  await waitForLayout();
  if (signal?.aborted) return false;
  // A failed custom source can switch to the builtin in the same commit. Settle that replacement too.
  await Promise.all(getImages().map((image) => settleImage(image, signal)));
  return !signal?.aborted;
}
