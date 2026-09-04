import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { appearanceAssetUrlCache } from './appearanceAssetResolver';
import { TILE_APPEARANCE_IDS, type AppearanceAssetRef, type AppearanceSettings, type TileAppearanceId } from './appearanceSettings';
import { getTileAssetKeyById } from '../../game/tileAssets';
import type { TileId } from '../../game/types';

export function resolveTileAppearanceId(id: TileId, red = false): TileAppearanceId {
  if (red && id === 4) return 'red5m';
  if (red && id === 13) return 'red5p';
  if (red && id === 22) return 'red5s';
  return getTileAssetKeyById(id);
}
type Sources = Partial<Record<TileAppearanceId, { source: string; sideColor: string }>>;
const Context = createContext<Sources>({});
/** Opt-in only around 3D DOM consumers; legacy tiles never read custom assets. */
export function TileFaceDomAppearance({ settings, children }: { settings?: AppearanceSettings; children: ReactNode }) {
  const signature = JSON.stringify(settings ? TILE_APPEARANCE_IDS.map(key => settings.tileFaces[key].face) : []);
  const [loaded, setLoaded] = useState<{ signature: string; sources: string[] }>({ signature: '', sources: [] });
  useEffect(() => {
    let active = true;
    const leases = (JSON.parse(signature) as AppearanceAssetRef[]).map(ref => appearanceAssetUrlCache.acquire(ref, ''));
    void Promise.all(leases.map(lease => lease.promise)).then(sources => {
      if (active) setLoaded({ signature, sources });
    });
    return () => { active = false; leases.forEach(lease => lease.release()); };
  }, [signature]);
  const sources: Sources = settings ? Object.fromEntries(TILE_APPEARANCE_IDS.map((key, i) => [key, {
    source: loaded.signature === signature ? loaded.sources[i] ?? '' : '',
    sideColor: settings.tileFaces[key].sideColor,
  }])) : {};
  return <Context.Provider value={sources}>{children}</Context.Provider>;
}
export function useTileFaceDomAppearance(id?: TileId, red = false) {
  const resources = useContext(Context);
  return id === undefined ? undefined : resources[resolveTileAppearanceId(id, red)];
}
