/** Confirmed missing binary only. Transient IndexedDB errors must not erase choices. */
const listeners = new Set<(assetId: string) => void>();
export function subscribeMissingAppearanceAssets(listener: (assetId: string) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function reportMissingAppearanceAsset(assetId: string) {
  for (const listener of listeners) {
    try { listener(assetId); } catch { /* Keep rendering the builtin if storage is unavailable. */ }
  }
}
