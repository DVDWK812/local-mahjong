import { TextureLoader, type Texture } from 'three';
import { appearanceAssetUrlCache, type AppearanceAssetUrlCache } from '../../presentation/appearance/appearanceAssetResolver';
import type { AppearanceAssetRef } from '../../presentation/appearance/appearanceSettings';

export type AppearanceTextureKind = 'tile-back' | 'riichi-stick' | 'tile-face' | 'felt';
type Entry = { users: number; promise: Promise<Texture | undefined>; releaseUrl: () => void };
/** One decode/Texture per asset + UV convention, shared by all player and global slots. */
export class AppearanceTextureCache {
  private readonly entries = new Map<string, Entry>();
  constructor(
    private readonly configure: (texture: Texture, kind: AppearanceTextureKind) => Texture,
    private readonly urls: Pick<AppearanceAssetUrlCache, 'acquire'> = appearanceAssetUrlCache,
    private readonly decode: (url: string) => Promise<Texture> = url => new TextureLoader().loadAsync(url),
  ) {}
  acquire(ref: AppearanceAssetRef, kind: AppearanceTextureKind) {
    if (ref.kind !== 'local') return { promise: Promise.resolve(undefined), release: () => undefined };
    const key = `${kind}:${ref.assetId}`;
    let entry = this.entries.get(key);
    if (!entry) {
      const lease = this.urls.acquire(ref, '');
      entry = { users: 0, releaseUrl: lease.release, promise: lease.promise.then(async url => {
        if (!url) return undefined;
        const texture = await this.decode(url);
        try { return this.configure(texture, kind); }
        catch (error) { texture.dispose(); throw error; }
      }).catch(() => undefined) };
      this.entries.set(key, entry);
    }
    const current = entry;
    current.users++;
    let released = false;
    return { promise: current.promise, release: () => {
      if (released) return;
      released = true;
      current.users--;
      // Allow commit/StrictMode reacquisition before disposal; no frame loop.
      queueMicrotask(() => {
        if (current.users || this.entries.get(key) !== current) return;
        this.entries.delete(key);
        void current.promise.then(texture => { texture?.dispose(); current.releaseUrl(); });
      });
    } };
  }
}
